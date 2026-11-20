import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { createLimiter } from "./limiter";
import { SEED_PHOTOS, seedPhotoFor, type SeedPhoto } from "./seed-photos";

const SEED_PHOTO_PATTERN = /^seed-photo-(\d{2})$/;
const DEFAULT_DIR = ".cache/seed";
const UNSPLASH_BASE = "https://images.unsplash.com";
const FETCH_TIMEOUT_MS = 15_000;
const WARM_CONCURRENCY = 6;

export interface SeedMedia {
  body: Buffer;
  contentType: "image/jpeg";
  etag: string;
}

export interface WarmSeedMediaResult {
  fetched: number;
  failed: Array<{ driveFileId: string; width: number; error: string }>;
}

/**
 * Development-only media for the seeded album. It keeps the gallery usable without
 * Google credentials. Never enabled in a production build.
 */
export function isSeedMedia(driveFileId: string): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    SEED_PHOTO_PATTERN.test(driveFileId) &&
    seedPhotoFor(driveFileId) !== undefined
  );
}

function cacheDir(): string {
  return process.env.SEED_MEDIA_DIR?.trim() || DEFAULT_DIR;
}

function fileFor(photo: SeedPhoto, width: number): string {
  return join(cacheDir(), `${photo.driveFileId}-${width}.jpg`);
}

function etagFor(bytes: number, mtimeMs: number): string {
  return `"seed-${bytes}-${Math.floor(mtimeMs)}"`;
}

function cropHeight(photo: SeedPhoto, width: number): number {
  return Math.max(1, Math.round((width * photo.height) / photo.width));
}

/**
 * Unsplash crops the photo to the seeded aspect ratio, so the response always fits
 * the `width` / `height` the gallery laid out for. The id comes from a fixed list,
 * never from a request, so this cannot be pointed at another host.
 */
export function seedMediaUrl(photo: SeedPhoto, width: number): string {
  const url = new URL(`${UNSPLASH_BASE}/${photo.unsplashId}`);
  url.searchParams.set("w", String(width));
  url.searchParams.set("h", String(cropHeight(photo, width)));
  url.searchParams.set("fit", "crop");
  url.searchParams.set("crop", "entropy");
  url.searchParams.set("q", "80");
  url.searchParams.set("fm", "jpg");
  return url.toString();
}

async function readCached(file: string): Promise<SeedMedia | null> {
  const info = await stat(file).catch(() => null);
  if (!info?.isFile() || info.size === 0) {
    return null;
  }

  const body = await readFile(file).catch(() => null);
  if (!body?.length) {
    return null;
  }

  return { body, contentType: "image/jpeg", etag: etagFor(body.length, info.mtimeMs) };
}

async function download(photo: SeedPhoto, width: number): Promise<Buffer> {
  const response = await fetch(seedMediaUrl(photo, width), {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Unsplash returned ${response.status} for ${photo.driveFileId}.`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/jpeg")) {
    throw new Error(
      `Unsplash returned a non-JPEG response (${contentType || "no content type"}) for ${photo.driveFileId}.`,
    );
  }

  const body = Buffer.from(await response.arrayBuffer());
  if (body.length === 0) {
    throw new Error(`Unsplash returned an empty body for ${photo.driveFileId}.`);
  }

  return body;
}

async function persist(file: string, body: Buffer): Promise<SeedMedia> {
  await mkdir(dirname(file), { recursive: true });

  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, body);
  await rename(temp, file);

  const info = await stat(file);
  return { body, contentType: "image/jpeg", etag: etagFor(body.length, info.mtimeMs) };
}

const inflight = new Map<string, Promise<SeedMedia>>();

/**
 * Resolves the JPEG for a seeded photo at `width`, caching it under `SEED_MEDIA_DIR`
 * (default `.cache/seed/`). Returns `null` for ids that are not seed media. Concurrent
 * misses for the same file share one upstream request.
 */
export async function seedMedia(driveFileId: string, width: number): Promise<SeedMedia | null> {
  if (!isSeedMedia(driveFileId)) {
    return null;
  }

  const photo = seedPhotoFor(driveFileId);
  if (!photo) {
    return null;
  }

  if (!Number.isInteger(width) || width < 1) {
    throw new Error(`Unsupported seed media width: ${width}.`);
  }

  const file = fileFor(photo, width);
  const cached = await readCached(file);
  if (cached) {
    return cached;
  }

  const pending = inflight.get(file);
  if (pending) {
    return pending;
  }

  const task = (async () => persist(file, await download(photo, width)))().finally(() => {
    inflight.delete(file);
  });

  inflight.set(file, task);
  return task;
}

/**
 * Fills the cache ahead of a dev session. Failures are collected, not thrown: the
 * routes still fetch lazily when a file is missing.
 */
export async function warmSeedMedia(
  widths: readonly number[],
  concurrency = WARM_CONCURRENCY,
): Promise<WarmSeedMediaResult> {
  const limiter = createLimiter(concurrency);
  const tasks = SEED_PHOTOS.flatMap((photo) =>
    widths.map(async (width) => {
      try {
        await limiter(() => seedMedia(photo.driveFileId, width));
        return { ok: true as const, width };
      } catch (error) {
        return {
          ok: false as const,
          width,
          driveFileId: photo.driveFileId,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  const results = await Promise.all(tasks);
  const failed = results.flatMap((result) =>
    result.ok ? [] : [{ driveFileId: result.driveFileId, width: result.width, error: result.error }],
  );

  return { fetched: results.length - failed.length, failed };
}
