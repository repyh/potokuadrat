import { getAdminSession } from "@/server/auth/api";
import { getAlbumRepository } from "@/server/albums/runtime";
import { albumIdSchema } from "@/server/albums/validation";
import { getDriveRuntime } from "@/server/drive";
import { isThumbWidth } from "@/server/drive/client";
import { isSeedMedia, seedMedia } from "@/server/drive/seed-media";

const CACHE_CONTROL = "private, max-age=3600";

type Context = { params: Promise<{ id: string; photoId: string }> };

async function handle(request: Request, { params }: Context): Promise<Response> {
  const session = await getAdminSession();
  if (!session) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id, photoId } = await params;
  const parsedAlbum = albumIdSchema.safeParse(id);
  const parsedPhoto = albumIdSchema.safeParse(photoId);
  if (!parsedAlbum.success || !parsedPhoto.success) {
    return Response.json({ error: "Photo not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const width = Number(url.searchParams.get("w") ?? 400);
  if (!isThumbWidth(width)) {
    return Response.json({ error: "Unsupported thumbnail width." }, { status: 400 });
  }

  const repository = getAlbumRepository();
  const album = await repository.getAlbum(parsedAlbum.data);
  if (!album || album.ownerUserId !== session.user.id) {
    return Response.json({ error: "Photo not found." }, { status: 404 });
  }

  const photo = await repository.findAlbumPhotoMedia(parsedAlbum.data, parsedPhoto.data);
  if (!photo) {
    return Response.json({ error: "Photo not found." }, { status: 404 });
  }

  if (isSeedMedia(photo.driveFileId)) {
    try {
      const seed = await seedMedia(photo.driveFileId, width);
      if (seed) {
        const headers = new Headers({
          "content-type": seed.contentType,
          "cache-control": CACHE_CONTROL,
          etag: seed.etag,
          "x-content-type-options": "nosniff",
        });
        if (request.headers.get("if-none-match") === seed.etag) {
          return new Response(null, { status: 304, headers });
        }
        headers.set("content-length", String(seed.body.length));
        return new Response(request.method === "HEAD" ? null : new Uint8Array(seed.body), {
          status: 200,
          headers,
        });
      }
    } catch (error) {
      console.error("[admin] seed media unavailable:", error);
      return Response.json({ error: "Seed media unavailable." }, { status: 502 });
    }
  }

  let cached;
  try {
    cached = await getDriveRuntime().cache.get(
      { id: photo.driveFileId, thumbnailLink: null },
      width,
      "raw",
    );
  } catch (error) {
    console.error("[admin] thumbnail unavailable:", error);
    return Response.json({ error: "Thumbnail unavailable." }, { status: 502 });
  }

  const headers = new Headers({
    "content-type": "image/jpeg",
    "cache-control": CACHE_CONTROL,
    etag: cached.etag,
    "x-content-type-options": "nosniff",
  });

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
