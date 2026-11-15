import type { GalleryAlbum, GalleryState, SharePolicy } from "@/contracts/share";

import { authorizeShareRequest } from "@/server/shares/access-context";
import { resolveShareAccess } from "@/server/shares/access";
import { resolveStripMetadata } from "@/server/shares/policy";
import { getShareRepository } from "@/server/shares/runtime";

type Context = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Context): Promise<Response> {
  const { slug } = await params;
  const repository = getShareRepository();
  const share = await repository.findBySlug(slug);

  if (!share) {
    return Response.json({ error: "Share not found." }, { status: 404 });
  }

  const authorization = await authorizeShareRequest(repository, request, share);
  const access = resolveShareAccess(share, new Date(), authorization.authorized);

  let album: GalleryAlbum | null = null;
  let policy: SharePolicy | null = null;

  if (access === "ok") {
    album = {
      slug: share.albumSlug,
      title: share.albumTitle,
      photoCount: share.photoCount,
      branding: share.albumBranding,
      photographerName: share.photographerName,
    };

    policy = {
      mode: share.mode,
      allowDownload: share.allowDownload,
      allowedQualities: share.allowedQualities,
      stripMetadata: resolveStripMetadata(share, share.organizationStripMetadata),
      expiresAt: share.expiresAt?.toISOString() ?? null,
    };
  }

  const body: GalleryState = { access, album, policy };
  return Response.json(body, { headers: { "cache-control": "no-store" } });
}
