import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { connection } from "next/server";

import type { PhotoPage } from "@/contracts/album";
import type { GalleryAlbum, GalleryState, SharePolicy } from "@/contracts/share";
import { BrandMark } from "@/components/brand-mark";
import { ShareAccessGate } from "@/features/share/share-access-gate";
import { ShareGallery } from "@/features/share/share-gallery";
import { getAnalyticsService } from "@/server/analytics/runtime";
import { authorizeShareRequest } from "@/server/shares/access-context";
import { resolveShareAccess } from "@/server/shares/access";
import { resolveEffectiveBranding } from "@/server/shares/branding";
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
  photographerName: string | null;
}

export async function generateMetadata({
  params,
}: Pick<PageProps, "params">): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  const share = await getShareRepository().findBySlug(slug);
  if (!share) {
    return { title: "Unavailable — Potokuadrat" };
  }

  const resolvedBranding = resolveEffectiveBranding({
    share: share.shareBranding,
    album: share.albumBranding,
    organization: {
      name: share.organizationName,
      title: share.organizationTitle,
      logo: share.organizationLogo,
      accent: share.organizationAccent,
      footerEnabled: share.organizationFooterEnabled,
    },
  });

  return {
    title: `${share.albumTitle} — ${resolvedBranding.title}`,
    ...(resolvedBranding.logo ? { icons: { icon: resolvedBranding.logo } } : {}),
  };
}

async function loadSharePayload(slug: string): Promise<SharePagePayload> {
  const emptyPage: PhotoPage = { photos: [], nextCursor: null, total: 0 };
  const repository = getShareRepository();
  const share = await repository.findBySlug(slug);

  if (!share) {
    return {
      state: { access: "unavailable", album: null, policy: null, resolvedBranding: null },
      initialPage: emptyPage,
      initialFavoriteIds: [],
      photographerName: null,
    };
  }

  const resolvedBranding = resolveEffectiveBranding({
    share: share.shareBranding,
    album: share.albumBranding,
    organization: {
      name: share.organizationName,
      title: share.organizationTitle,
      logo: share.organizationLogo,
      accent: share.organizationAccent,
      footerEnabled: share.organizationFooterEnabled,
    },
  });

  const reqHeaders = await headers();
  const request = new Request("http://localhost", { headers: reqHeaders });
  const authorization = await authorizeShareRequest(repository, request, share);
  const access = resolveShareAccess(share, new Date(), authorization.authorized);

  if (access !== "ok") {
    return {
      state: { access, album: null, policy: null, resolvedBranding },
      initialPage: emptyPage,
      initialFavoriteIds: [],
      photographerName: share.photographerName,
    };
  }

  // A gallery that is actually shown counts as one view. Gates and error states do not.
  await getAnalyticsService().recordGalleryView(share.id, reqHeaders);

  const album: GalleryAlbum = {
    slug: share.albumSlug,
    title: share.albumTitle,
    photoCount: share.photoCount,
    branding: {
      title: resolvedBranding.title,
      logo: resolvedBranding.logo ?? undefined,
      accent: resolvedBranding.accent ?? undefined,
      welcomeMessage: resolvedBranding.welcomeMessage ?? undefined,
    },
    resolvedBranding,
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
    state: { access, album, policy, resolvedBranding },
    initialPage: galleryResult.ok ? galleryResult.page : emptyPage,
    initialFavoriteIds: favoritesResult && favoritesResult.ok ? favoritesResult.favorites.photoIds : [],
    photographerName: share.photographerName,
  };
}

export default async function SharePage({ params, searchParams }: PageProps) {
  await connection();

  const [{ slug }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const initialToken =
    typeof resolvedSearchParams.token === "string" ? resolvedSearchParams.token : null;

  const { state, initialPage, initialFavoriteIds, photographerName } = await loadSharePayload(slug);
  const resolvedBranding = state.album?.resolvedBranding ?? state.resolvedBranding ?? null;
  const brandTitle = resolvedBranding?.title ?? "Potokuadrat";
  const brandLogo = resolvedBranding?.logo ?? null;
  const brandAccent = resolvedBranding?.accent ?? null;
  const footerEnabled = resolvedBranding?.footerEnabled ?? true;
  const brandStyle = brandAccent
    ? ({ "--brand-accent": brandAccent } as CSSProperties)
    : undefined;

  return (
    <main className="folio-frame" style={brandStyle}>
      <header className="site-navbar">
        <div className="navbar-inner">
          <Link className="navbar-brand" href="/" aria-label={brandTitle}>
            <BrandMark title={brandTitle} logo={brandLogo} />
            <span>{brandTitle}</span>
          </Link>

          {photographerName && (
            <div className="navbar-actions">
              <span className="navbar-user">{photographerName}</span>
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

      {footerEnabled && (
        <footer className="share-folio-footer">
          <span>{brandTitle}</span>
          {photographerName && <span>Delivered by {photographerName}</span>}
        </footer>
      )}
    </main>
  );
}
