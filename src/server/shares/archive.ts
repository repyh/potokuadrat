import "server-only";

import { Readable } from "node:stream";

import yazl from "yazl";

import type { DownloadQuality, DownloadScope } from "@/contracts/share";
import type { DriveClient } from "@/server/drive/client";
import { baseName } from "@/server/drive/download";
import { createLimiter } from "@/server/drive/limiter";
import { seedThumbnail } from "@/server/drive/seed-thumbnails";
import type { ThumbnailCache, ThumbMode } from "@/server/drive/thumb-cache";

import { resolveShareRequest } from "./access-context";
import { canDownload, resolveStripMetadata } from "./policy";
import type { SharePhotoRecord, ShareRepository } from "./repository";

export const MAX_ARCHIVE_PHOTOS = 500;
export const MAX_ARCHIVE_BYTES = 2 * 1024 ** 3;
export const ARCHIVE_TOO_LARGE =
  "This selection is too large for one archive. Download photos individually or narrow the selection.";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ArchiveQuery {
  quality: DownloadQuality;
  scope: DownloadScope;
  /** Explicit selection from `?ids=`, already narrowed to the share. */
  photoIds: string[] | null;
}

export type ArchiveQueryResult =
  | { ok: true; query: ArchiveQuery }
  | { ok: false; error: string };

export function parseArchiveQuery(searchParams: URLSearchParams): ArchiveQueryResult {
  const qualityRaw = searchParams.get("quality") ?? "original";
  if (qualityRaw !== "original" && qualityRaw !== "web") {
    return { ok: false, error: "Unsupported download quality." };
  }

  const scopeRaw = searchParams.get("scope") ?? "all";
  if (scopeRaw !== "all" && scopeRaw !== "favorites") {
    return { ok: false, error: "Unsupported download scope." };
  }

  const idsRaw = searchParams.get("ids");
  let photoIds: string[] | null = null;
  if (idsRaw !== null) {
    const parts = idsRaw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length === 0 || parts.some((part) => !UUID_PATTERN.test(part))) {
      return { ok: false, error: "Invalid photo ids." };
    }

    photoIds = [...new Set(parts)];
  }

  return { ok: true, query: { quality: qualityRaw, scope: scopeRaw, photoIds } };
}

/**
 * Zip entry names stay flat and unique. Drive names never reach the archive with a path
 * separator, so an extractor cannot write outside the target folder.
 */
export function safeEntryName(filename: string): string {
  const flat = String(filename || "photo")
    .replace(/[\\/]/g, "_")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/^\.+/, "")
    .trim();

  return flat || "photo";
}

export function entryNameFor(photo: SharePhotoRecord, quality: DownloadQuality): string {
  const name = safeEntryName(baseName(photo.name));

  if (photo.driveFileId.startsWith("seed-photo-")) {
    return safeEntryName(quality === "web" ? `${name}-2048.svg` : `${name}.svg`);
  }

  return safeEntryName(quality === "web" ? `${name}-2048.jpg` : photo.name);
}

export interface ArchiveEntry {
  photo: SharePhotoRecord;
  name: string;
}

/** Two photos may share a filename; the archive keeps every one of them. */
export function uniqueEntryNames(entries: ArchiveEntry[]): ArchiveEntry[] {
  const seen = new Map<string, number>();

  return entries.map((entry) => {
    const count = seen.get(entry.name) ?? 0;
    seen.set(entry.name, count + 1);

    if (count === 0) {
      return entry;
    }

    const dot = entry.name.lastIndexOf(".");
    const base = dot > 0 ? entry.name.slice(0, dot) : entry.name;
    const extension = dot > 0 ? entry.name.slice(dot) : "";
    return { ...entry, name: `${base} (${count + 1})${extension}` };
  });
}

export type ArchivePlanResult =
  | { ok: true; entries: ArchiveEntry[]; bytes: number }
  | { ok: false; status: 413; error: string };

/**
 * Applies the archive caps before any bytes are streamed. The stored original size is
 * an upper bound for both qualities, so the byte cap cannot be bypassed by web files.
 */
export function buildArchivePlan(
  photos: SharePhotoRecord[],
  quality: DownloadQuality,
): ArchivePlanResult {
  if (photos.length > MAX_ARCHIVE_PHOTOS) {
    return { ok: false, status: 413, error: ARCHIVE_TOO_LARGE };
  }

  let bytes = 0;
  const entries: ArchiveEntry[] = [];

  for (const photo of photos) {
    bytes += photo.bytes ?? 0;
    entries.push({ photo, name: entryNameFor(photo, quality) });
  }

  if (bytes > MAX_ARCHIVE_BYTES) {
    return { ok: false, status: 413, error: ARCHIVE_TOO_LARGE };
  }

  return { ok: true, entries: uniqueEntryNames(entries), bytes };
}

export interface ArchiveDrive {
  client: Pick<DriveClient, "openOriginal">;
  cache: Pick<ThumbnailCache, "get">;
  config: { concurrency: number };
}

function seeded(photo: SharePhotoRecord): boolean {
  return photo.driveFileId.startsWith("seed-photo-");
}

async function openSource(
  photo: SharePhotoRecord,
  quality: DownloadQuality,
  mode: ThumbMode,
  drive: ArchiveDrive,
): Promise<Readable> {
  const portrait = Boolean(photo.width && photo.height && photo.height > photo.width);

  // Development seed: no Drive credentials needed.
  if (seeded(photo)) {
    const seed = seedThumbnail(photo.driveFileId, quality === "web" ? 2048 : 1600, portrait);
    if (!seed) {
      throw new Error(`Seed media missing for ${photo.driveFileId}`);
    }
    return Readable.from(seed.body);
  }

  if (quality === "web") {
    const cached = await drive.cache.get(
      { id: photo.driveFileId, thumbnailLink: null },
      2048,
      mode,
    );
    return Readable.from(cached.body);
  }

  const upstream = await drive.client.openOriginal(photo.driveFileId);
  if (!upstream.ok || !upstream.body) {
    await upstream.body?.cancel().catch(() => {});
    throw new Error(`Drive returned ${upstream.status} for ${photo.driveFileId}`);
  }

  return Readable.from(upstream.body as unknown as AsyncIterable<Uint8Array>);
}

export type ShareArchiveResult =
  | { ok: true; filename: string; stream: ReadableStream<Uint8Array> }
  | { ok: false; status: number; error: string };

/**
 * Authorizes a share, selects its photos, and starts a streamed zip. Entries are pulled
 * lazily by yazl, so Drive is read one file at a time and nothing is written to disk.
 */
export async function prepareShareArchive(
  repository: ShareRepository,
  request: Request,
  slug: string,
  searchParams: URLSearchParams,
  drive: ArchiveDrive,
): Promise<ShareArchiveResult> {
  const resolved = await resolveShareRequest(repository, request, slug);
  if (!resolved.ok) {
    return resolved;
  }

  const parsed = parseArchiveQuery(searchParams);
  if (!parsed.ok) {
    return { ok: false, status: 400, error: parsed.error };
  }

  const { quality, scope, photoIds } = parsed.query;
  const { share, sessionId } = resolved;

  if (!canDownload(share, quality)) {
    return {
      ok: false,
      status: 403,
      error: "This share does not allow that download quality.",
    };
  }

  // Public and password shares keep favorites in the browser, so the client sends ids.
  if (scope === "favorites" && !photoIds && !sessionId) {
    return {
      ok: false,
      status: 400,
      error: "Downloading favorites needs a magic-link session or an explicit ids list.",
    };
  }

  const photos = await repository.listShareArchivePhotos(share, {
    clientSessionId: sessionId,
    photoIds,
    favoritesOnly: scope === "favorites",
  });

  if (photos.length === 0) {
    return { ok: false, status: 404, error: "No photos to download." };
  }

  const planned = buildArchivePlan(photos, quality);
  if (!planned.ok) {
    return { ok: false, status: planned.status, error: planned.error };
  }

  const zip = new yazl.ZipFile();
  const output = zip.outputStream as Readable;
  const mode: ThumbMode = resolveStripMetadata(share, share.organizationStripMetadata)
    ? "clean"
    : "raw";
  const limiter = createLimiter(Math.max(1, drive.config.concurrency));

  zip.on("error", (error) => {
    console.error("[share] zip archive failed:", error);
    output.destroy(error instanceof Error ? error : new Error(String(error)));
  });

  for (const entry of planned.entries) {
    zip.addReadStreamLazy(entry.name, {}, (callback) => {
      limiter(() => openSource(entry.photo, quality, mode, drive)).then(
        (stream) => callback(null, stream),
        (error: unknown) => callback(error, null as unknown as NodeJS.ReadableStream),
      );
    });
  }

  zip.end();

  const abort = () => output.destroy();
  if (request.signal.aborted) {
    output.destroy();
  } else {
    request.signal.addEventListener("abort", abort, { once: true });
  }

  return {
    ok: true,
    filename: `${share.albumSlug}-${quality}.zip`,
    stream: Readable.toWeb(output) as ReadableStream<Uint8Array>,
  };
}
