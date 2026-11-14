import "server-only";

import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  isSafeDriveFileId,
  isThumbWidth,
  type DriveClient,
  type DrivePhoto,
  type ThumbWidth,
} from "./client";
import { stripJpegMetadata } from "./strip";

export type ThumbMode = "clean" | "raw";

export interface CachedThumbnail {
  body: Buffer;
  etag: string;
  contentType: "image/jpeg";
  file: string;
  fromCache: boolean;
}

export interface ThumbnailCacheOptions {
  dir: string;
  drive: Pick<DriveClient, "fetchThumbnail">;
  /** Default: 5 GB. */
  maxBytes?: number;
  /** Default: 200 000 files. */
  maxFiles?: number;
}

export interface ThumbnailCache {
  get(
    photo: Pick<DrivePhoto, "id" | "thumbnailLink">,
    width: ThumbWidth,
    mode: ThumbMode,
  ): Promise<CachedThumbnail>;
  /** Removes the oldest entries until both caps hold. Returns how many files were deleted. */
  enforceLimits(): Promise<number>;
}

const DEFAULT_MAX_BYTES = 5 * 1024 ** 3;
const DEFAULT_MAX_FILES = 200_000;
const LIMIT_CHECK_EVERY_WRITES = 50;

function etagFor(bytes: number, mtimeMs: number): string {
  return `"${bytes}-${Math.floor(mtimeMs)}"`;
}

/**
 * Disk-local thumbnail cache. The cache key includes width and metadata mode, so a
 * clean thumbnail and a raw one never share bytes or an ETag. Entries are safe to
 * delete at any time.
 */
export function createThumbnailCache(options: ThumbnailCacheOptions): ThumbnailCache {
  const dir = options.dir;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const inflight = new Map<string, Promise<CachedThumbnail>>();
  let writesSinceCheck = 0;

  function fileFor(id: string, width: ThumbWidth, mode: ThumbMode): string {
    return join(dir, `${id}-${width}-${mode}.jpg`);
  }

  async function readCached(file: string): Promise<CachedThumbnail | null> {
    const info = await stat(file).catch(() => null);
    if (!info?.isFile()) {
      return null;
    }

    const body = await readFile(file).catch(() => null);
    if (!body) {
      return null;
    }

    return {
      body,
      etag: etagFor(body.length, info.mtimeMs),
      contentType: "image/jpeg",
      file,
      fromCache: true,
    };
  }

  async function enforceLimits(): Promise<number> {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    const files: Array<{ name: string; size: number; mtimeMs: number }> = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".jpg")) {
        continue;
      }
      const info = await stat(join(dir, entry.name)).catch(() => null);
      if (info) {
        files.push({ name: entry.name, size: info.size, mtimeMs: info.mtimeMs });
      }
    }

    let totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    let totalFiles = files.length;

    if (totalFiles <= maxFiles && totalBytes <= maxBytes) {
      return 0;
    }

    files.sort((a, b) => a.mtimeMs - b.mtimeMs || a.name.localeCompare(b.name));

    let removed = 0;
    for (const file of files) {
      if (totalFiles <= maxFiles && totalBytes <= maxBytes) {
        break;
      }
      await unlink(join(dir, file.name)).catch(() => {});
      totalFiles -= 1;
      totalBytes -= file.size;
      removed += 1;
    }

    return removed;
  }

  async function get(
    photo: Pick<DrivePhoto, "id" | "thumbnailLink">,
    width: ThumbWidth,
    mode: ThumbMode,
  ): Promise<CachedThumbnail> {
    if (!isSafeDriveFileId(photo.id)) {
      throw new Error(`Invalid Drive file id: ${photo.id}`);
    }
    if (!isThumbWidth(width)) {
      throw new Error(`Unsupported thumbnail width: ${width}`);
    }

    const file = fileFor(photo.id, width, mode);
    const cached = await readCached(file);
    if (cached) {
      return cached;
    }

    const pending = inflight.get(file);
    if (pending) {
      return pending;
    }

    const task = (async (): Promise<CachedThumbnail> => {
      const upstream = await options.drive.fetchThumbnail(photo, width);
      if (!upstream.contentType.startsWith("image/")) {
        throw new Error(`Drive returned ${upstream.contentType || "no type"} for ${photo.id}`);
      }

      const body = mode === "clean" ? stripJpegMetadata(upstream.body) : Buffer.from(upstream.body);
      await mkdir(dir, { recursive: true });

      const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(temp, body);
      await rename(temp, file);

      const info = await stat(file);
      writesSinceCheck += 1;
      if (writesSinceCheck >= LIMIT_CHECK_EVERY_WRITES) {
        writesSinceCheck = 0;
        await enforceLimits();
      }

      return {
        body,
        etag: etagFor(body.length, info.mtimeMs),
        contentType: "image/jpeg",
        file,
        fromCache: false,
      };
    })().finally(() => {
      inflight.delete(file);
    });

    inflight.set(file, task);
    return task;
  }

  return { get, enforceLimits };
}
