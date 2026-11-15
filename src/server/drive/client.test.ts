import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { buildJpeg } from "@/test/jpeg";

import { createDriveClient, parseDriveFolderInput, thumbnailUrl, type DriveClientOptions } from "./client";

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const serviceAccount = {
  client_email: "gallery@example.iam.gserviceaccount.com",
  private_key: privateKey,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

type Handler = (url: URL) => Response | Promise<Response>;

function makeClient(handler: Handler, overrides: Partial<DriveClientOptions> = {}) {
  const calls: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    calls.push(url.toString());
    return handler(url);
  }) as unknown as typeof fetch;

  const client = createDriveClient({
    serviceAccount,
    fetchImpl,
    sleep: async () => {},
    now: () => 1_700_000_000_000,
    ...overrides,
  });

  return { client, calls };
}

const tokenResponse = () => json({ access_token: "tkn", expires_in: 3600 });

describe("listImages", () => {
  const folderFile = {
    id: "subfolder01",
    name: "Sub",
    mimeType: "application/vnd.google-apps.folder",
  };
  const fileA = {
    id: "fileA0000001",
    name: "TOP2.jpg",
    mimeType: "image/jpeg",
    size: "200",
    modifiedTime: "2026-11-01T10:00:00.000Z",
    thumbnailLink: "https://lh3.example/a=s220",
    imageMediaMetadata: { width: 4000, height: 6000, time: "2026-10-30T08:00:00.000Z" },
  };
  const fileB = {
    id: "fileB0000002",
    name: "TOP10.jpg",
    mimeType: "image/jpeg",
    size: "100",
    thumbnailLink: "https://lh3.example/b=s220",
    imageMediaMetadata: { width: 6000, height: 4000 },
  };
  const video = { id: "video000003", name: "clip.mp4", mimeType: "video/mp4" };
  const fileRaw = {
    id: "fileC0000004",
    name: "DSC01234.ARW",
    mimeType: "application/octet-stream",
    size: "23800000",
    thumbnailLink: "https://lh3.example/c=s220",
  };

  function handler(listing: Record<string, unknown[]>): Handler {
    return (url) => {
      if (url.hostname === "oauth2.googleapis.com") {
        return tokenResponse();
      }
      if (url.pathname.endsWith("/files")) {
        const parent = url.searchParams.get("q") ?? "";
        const key = parent.includes("rootfolder01") ? "root" : "sub";
        const pages = listing[key] ?? [];
        const pageToken = url.searchParams.get("pageToken");
        const index = pageToken ? Number(pageToken.replace("p", "")) - 1 : 0;
        return json(pages[index] ?? { files: [] });
      }
      throw new Error(`unexpected call ${url}`);
    };
  }

  it("paginates, recurses, dedupes, and filters non-images", async () => {
    const { client, calls } = makeClient(
      handler({
        root: [
          { nextPageToken: "p2", files: [folderFile, fileA, video] },
          { files: [fileA, fileB, fileRaw] },
        ],
        sub: [{ files: [{ ...fileA, id: "fileD0000005", name: "SUB1.jpg" }] }],
      }),
      { maxDepth: 1 },
    );

    const photos = await client.listImages("rootfolder01");

    expect(photos.map((photo) => photo.name)).toEqual(["TOP2.jpg", "TOP10.jpg", "DSC01234.ARW", "SUB1.jpg"]);
    expect(photos[0]).toMatchObject({
      id: "fileA0000001",
      width: 4000,
      height: 6000,
      bytes: 200,
      modifiedTime: "2026-11-01T10:00:00.000Z",
      takenAt: "2026-10-30T08:00:00.000Z",
      thumbnailLink: "https://lh3.example/a=s220",
    });
    expect(photos[2].mimeType).toBe("application/octet-stream");

    const listCalls = calls.filter((call) => call.includes("/files?"));
    expect(listCalls.some((call) => call.includes("pageToken=p2"))).toBe(true);
    expect(listCalls.some((call) => call.includes("subfolder01"))).toBe(true);
  });

  it("does not enter subfolders when maxDepth is zero", async () => {
    const { client, calls } = makeClient(
      handler({ root: [{ files: [folderFile, fileA] }], sub: [{ files: [] }] }),
      { maxDepth: 0 },
    );

    const photos = await client.listImages("rootfolder01");

    expect(photos).toHaveLength(1);
    expect(calls.some((call) => call.includes("subfolder01"))).toBe(false);
  });

  it("retries a 403 rate-limit response", async () => {
    let attempts = 0;
    const sleep = vi.fn(async () => {});
    const { client } = makeClient(
      (url) => {
        if (url.hostname === "oauth2.googleapis.com") {
          return tokenResponse();
        }
        attempts += 1;
        return attempts === 1
          ? json({ error: { errors: [{ reason: "rateLimitExceeded" }] } }, 403)
          : json({ files: [fileA] });
      },
      { sleep },
    );

    const photos = await client.listImages("rootfolder01");

    expect(photos).toHaveLength(1);
    expect(attempts).toBe(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("does not retry a permission 403", async () => {
    let attempts = 0;
    const sleep = vi.fn(async () => {});
    const { client } = makeClient(
      (url) => {
        if (url.hostname === "oauth2.googleapis.com") {
          return tokenResponse();
        }
        attempts += 1;
        return json({ error: { message: "Forbidden" } }, 403);
      },
      { sleep },
    );

    await expect(client.listImages("rootfolder01")).rejects.toThrow(/403/);
    expect(attempts).toBe(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("asks Drive only for files modified after a timestamp", async () => {
    let query = "";
    const { client } = makeClient((url) => {
      if (url.hostname === "oauth2.googleapis.com") {
        return tokenResponse();
      }
      query = url.searchParams.get("q") ?? "";
      return json({ files: [fileA] });
    });

    await client.listImages("rootfolder01", {
      modifiedAfter: new Date("2026-11-10T10:00:00Z"),
    });

    expect(query).toContain("modifiedTime > '2026-11-10T10:00:00.000Z'");
  });

  it("caches the access token between calls", async () => {
    const { client, calls } = makeClient(handler({ root: [{ files: [fileA] }], sub: [] }));

    await client.listImages("rootfolder01");
    await client.listImages("rootfolder01");

    const tokenCalls = calls.filter((call) => call.includes("oauth2.googleapis.com"));
    expect(tokenCalls).toHaveLength(1);
  });

  it("retries a 429 with backoff", async () => {
    let attempts = 0;
    const sleep = vi.fn(async () => {});
    const { client } = makeClient(
      (url) => {
        if (url.hostname === "oauth2.googleapis.com") {
          return tokenResponse();
        }
        attempts += 1;
        return attempts === 1 ? json({ error: "rate limited" }, 429) : json({ files: [fileA] });
      },
      { sleep },
    );

    const photos = await client.listImages("rootfolder01");

    expect(photos).toHaveLength(1);
    expect(attempts).toBe(2);
    expect(sleep).toHaveBeenCalledWith(250);
  });
});

describe("fetchThumbnail", () => {
  const photo = { id: "fileA0000001", thumbnailLink: "https://lh3.example/a=s220" };
  const jpeg = buildJpeg();

  it("refreshes an expired thumbnail link once", async () => {
    let thumbnailCalls = 0;
    const { client, calls } = makeClient((url) => {
      if (url.hostname === "oauth2.googleapis.com") {
        return tokenResponse();
      }
      if (url.hostname === "lh3.example") {
        thumbnailCalls += 1;
        if (thumbnailCalls === 1) {
          return new Response("<html>expired</html>", {
            status: 200,
            headers: { "content-type": "text/html" },
          });
        }
        return new Response(new Uint8Array(jpeg), {
          headers: { "content-type": "image/jpeg" },
        });
      }
      if (url.pathname.endsWith("/fileA0000001")) {
        return json({ id: photo.id, name: "TOP2.jpg", thumbnailLink: "https://lh3.example/b=s220" });
      }
      throw new Error(`unexpected call ${url}`);
    });

    const result = await client.fetchThumbnail(photo, 1600);

    expect(result.contentType).toBe("image/jpeg");
    expect(result.body.equals(jpeg)).toBe(true);
    expect(calls.filter((call) => call.includes("lh3.example/a=s1600"))).toHaveLength(1);
    expect(calls.filter((call) => call.includes("lh3.example/b=s1600"))).toHaveLength(1);
  });

  it("rejects invalid ids and unsupported widths", async () => {
    const { client } = makeClient(() => json({}));

    await expect(client.fetchThumbnail({ id: "../etc/passwd", thumbnailLink: null }, 400)).rejects.toThrow(
      /Invalid Drive file id/,
    );
    await expect(
      client.fetchThumbnail({ id: "fileA0000001", thumbnailLink: "https://lh3.example/a" }, 999 as never),
    ).rejects.toThrow(/Unsupported thumbnail width/);
  });
});

describe("openOriginal", () => {
  it("asks Drive for media with the access token", async () => {
    const { client, calls } = makeClient((url) => {
      if (url.hostname === "oauth2.googleapis.com") {
        return tokenResponse();
      }
      return new Response("bytes", { headers: { "content-type": "image/jpeg" } });
    });

    const response = await client.openOriginal("fileA0000001");

    expect(response.status).toBe(200);
    expect(calls.some((call) => call.includes("alt=media"))).toBe(true);
    expect(calls.some((call) => call.includes("supportsAllDrives=true"))).toBe(true);
  });
});

describe("thumbnailUrl", () => {
  it("replaces whatever size suffix Drive used", () => {
    expect(thumbnailUrl("https://lh3.example/a=s220", 1600)).toBe("https://lh3.example/a=s1600");
    expect(thumbnailUrl("https://lh3.example/a=w220-h220", 400)).toBe("https://lh3.example/a=s400");
    expect(thumbnailUrl("https://lh3.example/a=h220", 800)).toBe("https://lh3.example/a=s800");
    expect(thumbnailUrl("https://lh3.example/a", 2048)).toBe("https://lh3.example/a=s2048");
  });
});

describe("parseDriveFolderInput", () => {
  const id = "1XtiPMDZ5FWFJv8IqWNjnZDqwJD9LmURQ";

  it("accepts a raw id", () => {
    expect(parseDriveFolderInput(id)).toBe(id);
    expect(parseDriveFolderInput(`  ${id}  `)).toBe(id);
  });

  it("accepts folder links, including multi-account paths and share parameters", () => {
    expect(parseDriveFolderInput(`https://drive.google.com/drive/folders/${id}?usp=sharing`)).toBe(id);
    expect(parseDriveFolderInput(`https://drive.google.com/drive/u/1/folders/${id}`)).toBe(id);
    expect(parseDriveFolderInput(`https://drive.google.com/open?id=${id}`)).toBe(id);
  });

  it("rejects other hosts, other paths, and short ids", () => {
    expect(parseDriveFolderInput(`https://example.com/drive/folders/${id}`)).toBeNull();
    expect(parseDriveFolderInput("https://drive.google.com/drive/my-drive")).toBeNull();
    expect(parseDriveFolderInput("short-id")).toBeNull();
    expect(parseDriveFolderInput("")).toBeNull();
  });
});

describe("folder discovery", () => {
  it("lists shared folders with their owner", async () => {
    const { client } = makeClient((url) => {
      if (url.hostname === "oauth2.googleapis.com") {
        return tokenResponse();
      }
      return json({
        files: [
          {
            id: "folderA0001",
            name: "Wedding 2026",
            owners: [{ displayName: "Atelier Kusuma" }],
          },
        ],
      });
    });

    const folders = await client.listSharedFolders();

    expect(folders).toEqual([
      {
        id: "folderA0001",
        name: "Wedding 2026",
        source: "shared",
        ownerName: "Atelier Kusuma",
      },
    ]);
  });

  it("lists shared drives", async () => {
    const { client } = makeClient((url) => {
      if (url.hostname === "oauth2.googleapis.com") {
        return tokenResponse();
      }
      return json({ drives: [{ id: "driveA0001", name: "Studio Archive" }] });
    });

    const drives = await client.listSharedDrives();

    expect(drives).toEqual([
      {
        id: "driveA0001",
        name: "Studio Archive",
        source: "shared_drive",
        ownerName: null,
      },
    ]);
  });
});
