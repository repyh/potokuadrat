import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildJpeg, jpegMarkers, segment } from "@/test/jpeg";

import { createThumbnailCache } from "./thumb-cache";

const withMetadata = buildJpeg([segment(0xe1, "Exif\0\0GPS 1.234,5.678")]);
const photo = { id: "fileA0000001", thumbnailLink: "https://lh3.example/a=s220" };

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "potokuadrat-thumbs-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function fakeDrive(body: Buffer = withMetadata) {
  return {
    fetchThumbnail: vi.fn(async () => ({ body, contentType: "image/jpeg" })),
  };
}

describe("createThumbnailCache", () => {
  it("strips metadata on the clean variant and writes it once", async () => {
    const drive = fakeDrive();
    const cache = createThumbnailCache({ dir, drive });

    const first = await cache.get(photo, 400, "clean");

    expect(first.fromCache).toBe(false);
    expect(jpegMarkers(first.body)).not.toContain(0xe1);
    expect(first.body.includes(Buffer.from("GPS"))).toBe(false);
    expect(await readdir(dir)).toEqual(["fileA0000001-400-clean.jpg"]);
    expect(drive.fetchThumbnail).toHaveBeenCalledTimes(1);
  });

  it("serves the second request from disk with the same ETag", async () => {
    const drive = fakeDrive();
    const cache = createThumbnailCache({ dir, drive });

    const first = await cache.get(photo, 400, "clean");
    const second = await cache.get(photo, 400, "clean");

    expect(second.fromCache).toBe(true);
    expect(second.etag).toBe(first.etag);
    expect(second.body.equals(first.body)).toBe(true);
    expect(drive.fetchThumbnail).toHaveBeenCalledTimes(1);
  });

  it("keeps the raw variant in a separate cache entry", async () => {
    const drive = fakeDrive();
    const cache = createThumbnailCache({ dir, drive });

    const clean = await cache.get(photo, 400, "clean");
    const raw = await cache.get(photo, 400, "raw");

    expect(jpegMarkers(raw.body)).toContain(0xe1);
    expect(raw.body.includes(Buffer.from("GPS"))).toBe(true);
    expect(raw.etag).not.toBe(clean.etag);
    expect((await readdir(dir)).sort()).toEqual([
      "fileA0000001-400-clean.jpg",
      "fileA0000001-400-raw.jpg",
    ]);
    expect(drive.fetchThumbnail).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent requests for the same entry", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const drive = {
      fetchThumbnail: vi.fn(async () => {
        await gate;
        return { body: withMetadata, contentType: "image/jpeg" };
      }),
    };
    const cache = createThumbnailCache({ dir, drive });

    const first = cache.get(photo, 800, "clean");
    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = cache.get(photo, 800, "clean");
    release();

    const [a, b] = await Promise.all([first, second]);

    expect(a.body.equals(b.body)).toBe(true);
    expect(drive.fetchThumbnail).toHaveBeenCalledTimes(1);
  });

  it("rejects unsafe ids and unsupported widths", async () => {
    const cache = createThumbnailCache({ dir, drive: fakeDrive() });

    await expect(
      cache.get({ id: "../etc/passwd", thumbnailLink: null }, 400, "clean"),
    ).rejects.toThrow(/Invalid Drive file id/);
    await expect(
      cache.get({ id: "fileA0000001", thumbnailLink: null }, 999 as never, "clean"),
    ).rejects.toThrow(/Unsupported thumbnail width/);
  });

  it("evicts the oldest entries down to the file cap", async () => {
    const cache = createThumbnailCache({ dir, drive: fakeDrive(), maxFiles: 2 });

    for (const id of ["file00000001", "file00000002", "file00000003"]) {
      await cache.get({ id, thumbnailLink: null }, 400, "clean");
    }

    expect(await readdir(dir)).toHaveLength(3);

    const removed = await cache.enforceLimits();

    expect(removed).toBe(1);
    expect(await readdir(dir)).toHaveLength(2);
  });
});
