import "server-only";

import { createLimiter } from "./limiter";
import { isImageFile } from "./mime";
import { makeAssertion, TOKEN_URL, type ServiceAccount } from "./jwt";

export const API_BASE = "https://www.googleapis.com/drive/v3/";
export const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";
export const THUMB_WIDTHS = [400, 800, 1600, 2048] as const;
export type ThumbWidth = (typeof THUMB_WIDTHS)[number];

const FILE_ID_PATTERN = /^[A-Za-z0-9_-]{10,}$/;
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export function isThumbWidth(value: number): value is ThumbWidth {
  return (THUMB_WIDTHS as readonly number[]).includes(value);
}

export function isSafeDriveFileId(value: string): boolean {
  return FILE_ID_PATTERN.test(value);
}

export interface DrivePhoto {
  id: string;
  name: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  modifiedTime: string | null;
  takenAt: string | null;
  thumbnailLink: string | null;
}

export interface DriveFolder {
  id: string;
  name: string;
}

export class DriveError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "DriveError";
    this.status = status;
  }
}

export interface DriveClientOptions {
  serviceAccount: ServiceAccount | (() => Promise<ServiceAccount>);
  fetchImpl?: typeof fetch;
  now?: () => number;
  /** Nested folder levels below the listed folder. The spec default is 5. */
  maxDepth?: number;
  concurrency?: number;
  retryAttempts?: number;
  retryBaseMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export interface ListImagesOptions {
  recursive?: boolean;
  maxDepth?: number;
}

export interface DriveClient {
  getFolder(folderId: string): Promise<DriveFolder>;
  listImages(folderId: string, options?: ListImagesOptions): Promise<DrivePhoto[]>;
  getFile(fileId: string): Promise<DrivePhoto>;
  fetchThumbnail(
    photo: Pick<DrivePhoto, "id" | "thumbnailLink">,
    width: ThumbWidth,
  ): Promise<{ body: Buffer; contentType: string }>;
  openOriginal(fileId: string): Promise<Response>;
}

interface RawDriveFile {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: string;
  modifiedTime?: string;
  thumbnailLink?: string;
  imageMediaMetadata?: {
    width?: number;
    height?: number;
    time?: string;
  } | null;
}

interface ListPage {
  nextPageToken?: string;
  files?: RawDriveFile[];
}

const FILE_FIELDS =
  "id,name,mimeType,size,modifiedTime,thumbnailLink,imageMediaMetadata(width,height,time)";

function numberOrNull(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toPhoto(file: RawDriveFile): DrivePhoto {
  return {
    id: file.id as string,
    name: file.name as string,
    mimeType: file.mimeType ?? null,
    width: numberOrNull(file.imageMediaMetadata?.width),
    height: numberOrNull(file.imageMediaMetadata?.height),
    bytes: file.size ? Number(file.size) : null,
    modifiedTime: file.modifiedTime ?? null,
    takenAt: file.imageMediaMetadata?.time ?? null,
    thumbnailLink: file.thumbnailLink ?? null,
  };
}

/**
 * Drive resizes thumbnails through a suffix on `thumbnailLink`. The suffix differs by
 * file, so replace whatever is there instead of appending a second one.
 */
export function thumbnailUrl(link: string, width: ThumbWidth): string {
  return /=[swh]\d+(?:-h\d+)?$/.test(link)
    ? link.replace(/=[swh]\d+(?:-h\d+)?$/, `=s${width}`)
    : `${link}=s${width}`;
}

export function createDriveClient(options: DriveClientOptions): DriveClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const defaultMaxDepth = options.maxDepth ?? 5;
  const retryAttempts = Math.max(1, options.retryAttempts ?? 3);
  const retryBaseMs = options.retryBaseMs ?? 250;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const limit = createLimiter(options.concurrency ?? 4);

  let token: { value: string; expiresAt: number } | null = null;
  let accountPromise: Promise<ServiceAccount> | null = null;

  function loadAccount(): Promise<ServiceAccount> {
    if (!accountPromise) {
      accountPromise =
        typeof options.serviceAccount === "function"
          ? options.serviceAccount()
          : Promise.resolve(options.serviceAccount);
      accountPromise.catch(() => {
        accountPromise = null;
      });
    }
    return accountPromise;
  }

  async function requestWithRetry(url: string, init: RequestInit): Promise<Response> {
    let attempt = 0;

    for (;;) {
      let response: Response;
      try {
        response = await fetchImpl(url, init);
      } catch (error) {
        if (attempt + 1 >= retryAttempts) {
          throw new DriveError(`Drive request failed: ${(error as Error).message}`);
        }
        await sleep(retryBaseMs * 2 ** attempt);
        attempt += 1;
        continue;
      }

      if (!RETRYABLE_STATUS.has(response.status) || attempt + 1 >= retryAttempts) {
        return response;
      }

      const retryAfter = Number(response.headers.get("retry-after"));
      if (response.body) {
        await response.body.cancel().catch(() => {});
      }
      await sleep(
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : retryBaseMs * 2 ** attempt,
      );
      attempt += 1;
    }
  }

  async function accessToken(): Promise<string> {
    if (token && now() < token.expiresAt) {
      return token.value;
    }

    const account = await loadAccount();
    const response = await requestWithRetry(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: makeAssertion(account, now()),
      }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (!response.ok || !data.access_token) {
      throw new DriveError(
        `Drive auth failed (${response.status}): ${
          data.error_description ?? data.error ?? "unknown"
        }`,
        response.status,
      );
    }

    token = {
      value: data.access_token,
      expiresAt: now() + Math.max(0, (data.expires_in ?? 3600) - 60) * 1000,
    };
    return token.value;
  }

  async function apiJson<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(path, API_BASE);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await requestWithRetry(url.toString(), {
      headers: { authorization: `Bearer ${await accessToken()}` },
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new DriveError(
        `Drive ${response.status} on ${url.pathname}: ${detail.slice(0, 200)}`,
        response.status,
      );
    }

    return (await response.json()) as T;
  }

  async function getFolder(folderId: string): Promise<DriveFolder> {
    return apiJson<DriveFolder>(`files/${encodeURIComponent(folderId)}`, {
      fields: "id,name",
      supportsAllDrives: "true",
    });
  }

  async function getFile(fileId: string): Promise<DrivePhoto> {
    const file = await apiJson<RawDriveFile>(`files/${encodeURIComponent(fileId)}`, {
      fields: FILE_FIELDS,
      supportsAllDrives: "true",
    });
    return toPhoto(file);
  }

  async function listImages(
    folderId: string,
    listOptions: ListImagesOptions = {},
  ): Promise<DrivePhoto[]> {
    const recursive = listOptions.recursive ?? true;
    const maxDepth = listOptions.maxDepth ?? defaultMaxDepth;
    const seenFiles = new Set<string>();
    const seenFolders = new Set<string>([folderId]);
    const photos: DrivePhoto[] = [];
    const queue: Array<{ id: string; depth: number }> = [{ id: folderId, depth: 0 }];

    while (queue.length > 0) {
      const folder = queue.shift() as { id: string; depth: number };
      let pageToken: string | undefined;

      do {
        const page = await apiJson<ListPage>("files", {
          q: `'${folder.id}' in parents and trashed = false`,
          fields: `nextPageToken,files(${FILE_FIELDS})`,
          pageSize: "1000",
          supportsAllDrives: "true",
          includeItemsFromAllDrives: "true",
          ...(pageToken ? { pageToken } : {}),
        });

        for (const file of page.files ?? []) {
          if (!file.id || !file.name) {
            continue;
          }

          if (file.mimeType === DRIVE_FOLDER_MIME) {
            if (recursive && folder.depth < maxDepth && !seenFolders.has(file.id)) {
              seenFolders.add(file.id);
              queue.push({ id: file.id, depth: folder.depth + 1 });
            }
            continue;
          }

          if (seenFiles.has(file.id) || !isImageFile({ name: file.name, mimeType: file.mimeType })) {
            continue;
          }

          seenFiles.add(file.id);
          photos.push(toPhoto(file));
        }

        pageToken = page.nextPageToken;
      } while (pageToken);
    }

    return photos;
  }

  async function fetchThumbnail(
    photo: Pick<DrivePhoto, "id" | "thumbnailLink">,
    width: ThumbWidth,
  ): Promise<{ body: Buffer; contentType: string }> {
    if (!isThumbWidth(width)) {
      throw new DriveError(`Unsupported thumbnail width: ${width}`);
    }
    if (!isSafeDriveFileId(photo.id)) {
      throw new DriveError(`Invalid Drive file id: ${photo.id}`);
    }

    return limit(async () => {
      let link = photo.thumbnailLink;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (!link) {
          link = (await getFile(photo.id)).thumbnailLink;
        }
        if (!link) {
          break;
        }

        const response = await requestWithRetry(thumbnailUrl(link, width), {
          headers: { authorization: `Bearer ${await accessToken()}` },
        });
        const contentType = response.headers.get("content-type") ?? "";

        if (response.ok && contentType.startsWith("image/")) {
          return { body: Buffer.from(await response.arrayBuffer()), contentType };
        }

        if (response.body) {
          await response.body.cancel().catch(() => {});
        }
        // A stale thumbnailLink answers with HTML; fetch a fresh link once.
        link = null;
      }

      throw new DriveError(`Drive has no thumbnail for ${photo.id}`);
    });
  }

  async function openOriginal(fileId: string): Promise<Response> {
    if (!isSafeDriveFileId(fileId)) {
      throw new DriveError(`Invalid Drive file id: ${fileId}`);
    }

    const url = new URL(`files/${encodeURIComponent(fileId)}`, API_BASE);
    url.searchParams.set("alt", "media");
    url.searchParams.set("supportsAllDrives", "true");

    return fetchImpl(url.toString(), {
      headers: { authorization: `Bearer ${await accessToken()}` },
    });
  }

  return { getFolder, listImages, getFile, fetchThumbnail, openOriginal };
}
