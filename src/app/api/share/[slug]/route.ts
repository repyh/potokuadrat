import type {
  GalleryAlbum,
  GalleryPreview,
  GalleryState,
  SharePolicy,
} from "@/contracts/share";

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
  let preview: GalleryPreview | null = null;

  if (access === "ok") {
    album = {
      slug: share.albumSlug,
      title: share.albumTitle,
      photoCount: share.photoCount,
      totalBytes: share.totalBytes ?? 0,
      orientationCounts: {
        landscape: share.landscapeCount ?? 0,
        portrait: share.portraitCount ?? 0,
      },
      footerEnabled: share.organizationFooterEnabled ?? true,
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
  } else {
    preview = {
      title: share.albumTitle,
      branding: share.albumBranding,
      photographerName: share.photographerName,
      footerEnabled: share.organizationFooterEnabled ?? true,
    };
  }

  const body: GalleryState = { access, album, policy, preview };
  return Response.json(body, { headers: { "cache-control": "no-store" } });
}
