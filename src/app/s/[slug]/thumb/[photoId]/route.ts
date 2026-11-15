import { isThumbWidth } from "@/server/drive/client";
import { getDriveRuntime } from "@/server/drive";
import { baseName, makeContentDisposition } from "@/server/drive/download";
import { seedThumbnail } from "@/server/drive/seed-thumbnails";
import { authorizeShareRequest } from "@/server/shares/access-context";
import { resolveShareMedia } from "@/server/shares/media";
import { resolveStripMetadata } from "@/server/shares/policy";
import { getShareRepository } from "@/server/shares/runtime";

const CACHE_CONTROL = "public, max-age=31536000, immutable";

type Context = { params: Promise<{ slug: string; photoId: string }> };

async function handle(request: Request, { params }: Context): Promise<Response> {
  const { slug, photoId } = await params;
  const url = new URL(request.url);
  const width = Number(url.searchParams.get("w") ?? 400);

  if (!isThumbWidth(width)) {
    return Response.json({ error: "Unsupported thumbnail width." }, { status: 400 });
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
  const portrait = Boolean(photo.width && photo.height && photo.height > photo.width);

  if (photo.driveFileId.startsWith("seed-photo-")) {
    const seed = seedThumbnail(photo.driveFileId, width, portrait);
    if (seed) {
      const headers = new Headers({
        "content-type": seed.contentType,
        "cache-control": CACHE_CONTROL,
        etag: seed.etag,
        "x-content-type-options": "nosniff",
      });
      if (url.searchParams.get("download") === "1") {
        headers.set(
          "content-disposition",
          makeContentDisposition(`${baseName(photo.name)}-${width}.svg`),
        );
      }
      if (request.headers.get("if-none-match") === seed.etag) {
        return new Response(null, { status: 304, headers });
      }
      headers.set("content-length", String(seed.body.length));
      return new Response(request.method === "HEAD" ? null : new Uint8Array(seed.body), {
        status: 200,
        headers,
      });
    }
  }

  const mode = resolveStripMetadata(share, share.organizationStripMetadata) ? "clean" : "raw";

  let cached;
  try {
    cached = await getDriveRuntime().cache.get(
      { id: photo.driveFileId, thumbnailLink: null },
      width,
      mode,
    );
  } catch (error) {
    console.error("[share] thumbnail unavailable:", error);
    return Response.json({ error: "Thumbnail unavailable." }, { status: 502 });
  }

  const headers = new Headers({
    "content-type": "image/jpeg",
    "cache-control": CACHE_CONTROL,
    etag: cached.etag,
    "x-content-type-options": "nosniff",
  });

  if (url.searchParams.get("download") === "1") {
    headers.set(
      "content-disposition",
      makeContentDisposition(`${baseName(photo.name)}-${width}.jpg`),
    );
  }

  if (request.headers.get("if-none-match") === cached.etag) {
    return new Response(null, { status: 304, headers });
  }

  headers.set("content-length", String(cached.body.length));
  return new Response(request.method === "HEAD" ? null : new Uint8Array(cached.body), {
    status: 200,
    headers,
  });
}

export async function GET(request: Request, context: Context): Promise<Response> {
  return handle(request, context);
}

export async function HEAD(request: Request, context: Context): Promise<Response> {
  return handle(request, context);
}
