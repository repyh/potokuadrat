import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SEED_PHOTOS } from "./seed-photos";
import { isSeedMedia, seedMedia, seedMediaUrl, warmSeedMedia } from "./seed-media";

const JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0xff, 0xd9,
]);

let dir: string;

function jpegResponse(body: Buffer = JPEG): Response {
  return new Response(new Uint8Array(body), {
    status: 200,
    headers: { "content-type": "image/jpeg" },
  });
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "potokuadrat-seed-media-"));
  vi.stubEnv("SEED_MEDIA_DIR", dir);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await rm(dir, { recursive: true, force: true });
});

describe("isSeedMedia", () => {
  it("accepts seeded photo ids outside production builds", () => {
    expect(isSeedMedia("seed-photo-01")).toBe(true);
    expect(isSeedMedia(SEED_PHOTOS.at(-1)?.driveFileId ?? "")).toBe(true);
  });

  it("rejects real Drive ids and ids the seed does not define", () => {
    expect(isSeedMedia("1XtiPMDZ5FWFJv8IqWNjnZDqwJD9LmURQ")).toBe(false);
    expect(isSeedMedia("seed-photo-99")).toBe(false);
    expect(isSeedMedia("seed-photo-100")).toBe(false);
  });

  it("is disabled in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isSeedMedia("seed-photo-01")).toBe(false);
  });
});

describe("seedMediaUrl", () => {
  it("crops to the seeded aspect ratio", () => {
    const landscape = new URL(seedMediaUrl(SEED_PHOTOS[0], 400));
    expect(landscape.origin).toBe("https://images.unsplash.com");
    expect(landscape.pathname).toBe(`/${SEED_PHOTOS[0].unsplashId}`);
    expect(landscape.searchParams.get("w")).toBe("400");
    expect(landscape.searchParams.get("h")).toBe("267");
    expect(landscape.searchParams.get("fit")).toBe("crop");
    expect(landscape.searchParams.get("fm")).toBe("jpg");

    const portrait = new URL(seedMediaUrl(SEED_PHOTOS[2], 400));
    expect(portrait.searchParams.get("h")).toBe("600");
  });
});

describe("seedMedia", () => {
  it("fetches a JPEG once, writes it to the cache, and reuses it", async () => {
    const fetchMock = vi.fn(async () => jpegResponse());
    vi.stubGlobal("fetch", fetchMock);

    const first = await seedMedia("seed-photo-01", 400);
    expect(first?.contentType).toBe("image/jpeg");
    expect(first?.body.equals(JPEG)).toBe(true);
    expect(first?.etag).toMatch(/^"seed-/);

    expect(await readdir(dir)).toEqual(["seed-photo-01-400.jpg"]);
    const stored = await readFile(join(dir, "seed-photo-01-400.jpg"));
    expect(stored.equals(JPEG)).toBe(true);

    const second = await seedMedia("seed-photo-01", 400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second?.etag).toBe(first?.etag);
  });

  it("serves an existing cache file without calling Unsplash", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await writeFile(join(dir, "seed-photo-02-800.jpg"), JPEG);
    const cached = await seedMedia("seed-photo-02", 800);

    expect(cached?.body.equals(JPEG)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shares one upstream request between concurrent misses", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchMock = vi.fn(async () => {
      await gate;
      return jpegResponse();
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = seedMedia("seed-photo-03", 400);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const second = seedMedia("seed-photo-03", 400);

    release();
    const results = await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results[0]?.body.equals(JPEG)).toBe(true);
    expect(results[1]?.body.equals(JPEG)).toBe(true);
  });

  it("rejects non-JPEG and failed upstream responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>nope</html>", { status: 200 })),
    );
    await expect(seedMedia("seed-photo-04", 400)).rejects.toThrow(/non-JPEG/i);

    vi.stubGlobal("fetch", vi.fn(async () => new Response("gone", { status: 404 })));
    await expect(seedMedia("seed-photo-04", 400)).rejects.toThrow(/404/);
  });

  it("returns null for unknown ids and in production", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(seedMedia("1XtiPMDZ5FWFJv8IqWNjnZDqwJD9LmURQ", 400)).resolves.toBeNull();
    await expect(seedMedia("seed-photo-99", 400)).resolves.toBeNull();

    vi.stubEnv("NODE_ENV", "production");
    await expect(seedMedia("seed-photo-01", 400)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("warmSeedMedia", () => {
  it("fills every width and reports failures without throwing", async () => {
    const failing = SEED_PHOTOS[0].unsplashId;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        return url.includes(failing) ? new Response("nope", { status: 500 }) : jpegResponse();
      }),
    );

    const result = await warmSeedMedia([400]);

    expect(result.fetched).toBe(SEED_PHOTOS.length - 1);
    expect(result.failed).toEqual([
      {
        driveFileId: "seed-photo-01",
        width: 400,
        error: expect.stringMatching(/500/),
      },
    ]);
    expect((await readdir(dir)).sort()).toContain("seed-photo-02-400.jpg");
  });
});
