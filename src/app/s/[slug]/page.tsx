import type { CSSProperties } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { connection } from "next/server";

import type { PhotoPage } from "@/contracts/album";
import type { GalleryAlbum, GalleryState, SharePolicy } from "@/contracts/share";
import { ShareAccessGate } from "@/features/share/share-access-gate";
import { ShareGallery } from "@/features/share/share-gallery";
import { authorizeShareRequest } from "@/server/shares/access-context";
import { resolveShareAccess } from "@/server/shares/access";
import { listFavorites } from "@/server/shares/favorites";
import { listShareGallery } from "@/server/shares/gallery";
import { resolveStripMetadata } from "@/server/shares/policy";
import { getShareRepository } from "@/server/shares/runtime";

export const instant = false;

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
};

interface SharePagePayload {
  state: GalleryState;
  initialPage: PhotoPage;
  initialFavoriteIds: string[];
}

async function loadSharePayload(slug: string): Promise<SharePagePayload> {
  const emptyPage: PhotoPage = { photos: [], nextCursor: null, total: 0 };
  const repository = getShareRepository();
  const share = await repository.findBySlug(slug);

  if (!share) {
    return {
      state: { access: "unavailable", album: null, policy: null },
      initialPage: emptyPage,
      initialFavoriteIds: [],
    };
  }

  const reqHeaders = await headers();
  const request = new Request("http://localhost", { headers: reqHeaders });
  const authorization = await authorizeShareRequest(repository, request, share);
  const access = resolveShareAccess(share, new Date(), authorization.authorized);

  if (access !== "ok") {
    return {
      state: { access, album: null, policy: null },
      initialPage: emptyPage,
      initialFavoriteIds: [],
    };
  }

  const album: GalleryAlbum = {
    slug: share.albumSlug,
    title: share.albumTitle,
    photoCount: share.photoCount,
    branding: share.albumBranding,
    photographerName: share.photographerName,
  };

  const policy: SharePolicy = {
    mode: share.mode,
    allowDownload: share.allowDownload,
    allowedQualities: share.allowedQualities,
    stripMetadata: resolveStripMetadata(share, share.organizationStripMetadata),
    expiresAt: share.expiresAt?.toISOString() ?? null,
  };

  const [galleryResult, favoritesResult] = await Promise.all([
    listShareGallery(repository, request, slug, new URLSearchParams({ filter: "all", limit: "50" })),
    share.mode === "magic_link"
      ? listFavorites(repository, request, slug)
      : Promise.resolve(null),
  ]);

  return {
    state: { access, album, policy },
    initialPage: galleryResult.ok ? galleryResult.page : emptyPage,
    initialFavoriteIds: favoritesResult && favoritesResult.ok ? favoritesResult.favorites.photoIds : [],
  };
}

export default async function SharePage({ params, searchParams }: PageProps) {
  await connection();

  const [{ slug }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const initialToken =
    typeof resolvedSearchParams.token === "string" ? resolvedSearchParams.token : null;

  const { state, initialPage, initialFavoriteIds } = await loadSharePayload(slug);
  const brandTitle = state.album?.branding?.title?.trim() || "Potokuadrat";
  const brandAccent = state.album?.branding?.accent?.trim();
  const brandStyle = brandAccent
    ? ({ "--brand-accent": brandAccent } as CSSProperties)
    : undefined;

  return (
    <main className="folio-frame" style={brandStyle}>
      <header className="site-navbar">
        <div className="navbar-inner">
          <Link className="navbar-brand" href="/" aria-label={brandTitle}>
            <span className="brand-stamp" aria-hidden="true">
              {brandTitle.charAt(0).toUpperCase()}
            </span>
            <span>{brandTitle}</span>
          </Link>

          {state.album?.photographerName && (
            <div className="navbar-actions">
              <span className="navbar-user">{state.album.photographerName}</span>
            </div>
          )}
        </div>
      </header>

      <div className="folio-page">
        {state.access !== "ok" || !state.album || !state.policy ? (
          <ShareAccessGate
            slug={slug}
            access={state.access === "ok" ? "unavailable" : state.access}
            initialToken={initialToken}
          />
        ) : (
          <ShareGallery
            slug={slug}
            album={state.album}
            policy={state.policy}
            initialPage={initialPage}
            initialFavoriteIds={initialFavoriteIds}
          />
        )}
      </div>
    </main>
  );
}
