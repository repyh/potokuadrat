import type { DownloadQuality } from "@/contracts/share";
import { getDriveRuntime } from "@/server/drive";
import { baseName, makeContentDisposition } from "@/server/drive/download";
import { seedThumbnail } from "@/server/drive/seed-thumbnails";
import { authorizeShareRequest } from "@/server/shares/access-context";
import { resolveShareMedia } from "@/server/shares/media";
import { canDownload, resolveStripMetadata } from "@/server/shares/policy";
import { getShareRepository } from "@/server/shares/runtime";

const DOWNLOAD_CACHE_CONTROL = "private, max-age=0, must-revalidate";

type Context = { params: Promise<{ slug: string; photoId: string }> };

function isQuality(value: string): value is DownloadQuality {
  return value === "original" || value === "web";
}

async function handle(request: Request, { params }: Context): Promise<Response> {
  const { slug, photoId } = await params;
  const url = new URL(request.url);
  const quality = url.searchParams.get("quality") ?? "original";

  if (!isQuality(quality)) {
    return Response.json({ error: "Unsupported download quality." }, { status: 400 });
  }

  const repository = getShareRepository();
  const resolved = await resolveShareMedia(repository, slug, photoId, {
    authorize: async (share) =>
      (await authorizeShareRequest(repository, request, share)).authorized,
  });
  if (!resolved.ok) {
    return Response.json({ error: resolved.error }, { status: resolved.status });
  }

  const { share, photo } = resolved;
  if (!canDownload(share, quality)) {
    return Response.json(
      { error: "This share does not allow that download quality." },
      { status: 403 },
    );
  }

  const portrait = Boolean(photo.width && photo.height && photo.height > photo.width);
  const name = baseName(photo.name);

  // Development seed: no Drive credentials needed.
  if (photo.driveFileId.startsWith("seed-photo-")) {
    const seed = seedThumbnail(photo.driveFileId, quality === "web" ? 2048 : 1600, portrait);
    if (seed) {
      const headers = new Headers({
        "content-type": seed.contentType,
        "content-disposition": makeContentDisposition(
          quality === "web" ? `${name}-2048.svg` : `${name}.svg`,
        ),
        "cache-control": DOWNLOAD_CACHE_CONTROL,
        "x-content-type-options": "nosniff",
      });
      headers.set("content-length", String(seed.body.length));
      return new Response(request.method === "HEAD" ? null : new Uint8Array(seed.body), {
        status: 200,
        headers,
      });
    }
  }

  if (quality === "web") {
    const mode = resolveStripMetadata(share, share.organizationStripMetadata) ? "clean" : "raw";
    let cached;
    try {
      cached = await getDriveRuntime().cache.get(
        { id: photo.driveFileId, thumbnailLink: null },
        2048,
        mode,
      );
    } catch (error) {
      console.error("[share] web download unavailable:", error);
      return Response.json({ error: "Web download unavailable." }, { status: 502 });
    }

    const headers = new Headers({
      "content-type": "image/jpeg",
      "content-disposition": makeContentDisposition(`${name}-2048.jpg`),
      "cache-control": DOWNLOAD_CACHE_CONTROL,
      "x-content-type-options": "nosniff",
    });
    headers.set("content-length", String(cached.body.length));

    return new Response(request.method === "HEAD" ? null : new Uint8Array(cached.body), {
      status: 200,
      headers,
    });
  }

  let upstream: Response;
  try {
    upstream = await getDriveRuntime().client.openOriginal(photo.driveFileId);
  } catch (error) {
    console.error("[share] original download failed:", error);
    return Response.json({ error: "Download unavailable." }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    if (upstream.body) {
      await upstream.body.cancel().catch(() => {});
    }
    return Response.json({ error: "Download unavailable." }, { status: 502 });
  }

  const headers = new Headers({
    "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
    "content-disposition": makeContentDisposition(photo.name),
    "cache-control": DOWNLOAD_CACHE_CONTROL,
    "x-content-type-options": "nosniff",
  });
  const length = upstream.headers.get("content-length");
  if (length) {
    headers.set("content-length", length);
  }

  if (request.method === "HEAD") {
    await upstream.body.cancel().catch(() => {});
    return new Response(null, { status: 200, headers });
  }

  return new Response(upstream.body, { status: 200, headers });
}

export async function GET(request: Request, context: Context): Promise<Response> {
  return handle(request, context);
}

export async function HEAD(request: Request, context: Context): Promise<Response> {
  return handle(request, context);
}
