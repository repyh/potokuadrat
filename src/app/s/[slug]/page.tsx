import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { connection } from "next/server";

import type { GalleryAlbum, GalleryState, SharePolicy } from "@/contracts/share";
import type { PhotoPage } from "@/contracts/album";
import { GalleryView } from "@/features/gallery/gallery-view";
import { ShareAccessGate } from "@/features/gallery/share-access-gate";
import { resolveShareAccess } from "@/server/shares/access";
import { authorizeShareRequest } from "@/server/shares/access-context";
import { listFavorites } from "@/server/shares/favorites";
import { listShareGallery } from "@/server/shares/gallery";
import { resolveStripMetadata } from "@/server/shares/policy";
import { getShareRepository } from "@/server/shares/runtime";

export const instant = false;

type Context = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
};

export async function generateMetadata({ params }: Pick<Context, "params">): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  const repository = getShareRepository();
  const share = await repository.findBySlug(slug);

  if (!share) {
    return { title: "Gallery — Potokuadrat" };
  }

  return {
    title: `${share.albumTitle} — Potokuadrat`,
    description: `Photographic folio for ${share.albumTitle}`,
  };
}

export default async function ShareGalleryPage({ params, searchParams }: Context) {
  await connection();

  const [{ slug }, resolvedSearch] = await Promise.all([params, searchParams]);
  const initialToken =
    typeof resolvedSearch.token === "string" ? resolvedSearch.token : null;

  const repository = getShareRepository();
  const share = await repository.findBySlug(slug);

  if (!share) {
    notFound();
  }

  const cookieHeader = (await headers()).get("cookie");
  const request = new Request("http://localhost", {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });

  const authorization = await authorizeShareRequest(repository, request, share);
  const access = resolveShareAccess(share, new Date(), authorization.authorized);

  let album: GalleryAlbum | null = null;
  let policy: SharePolicy | null = null;
  let initialPage: PhotoPage = { photos: [], nextCursor: null, total: 0 };
  let initialFavoriteIds: string[] = [];

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

    const [galleryResult, favoritesResult] = await Promise.all([
      listShareGallery(repository, request, slug, new URLSearchParams()),
      share.mode === "magic_link"
        ? listFavorites(repository, request, slug)
        : Promise.resolve(null),
    ]);

    if (galleryResult.ok) {
      initialPage = galleryResult.page;
    }
    if (favoritesResult && favoritesResult.ok) {
      initialFavoriteIds = favoritesResult.favorites.photoIds;
    }
  }

  const state: GalleryState = { access, album, policy };

  if (access !== "ok") {
    return (
      <ShareAccessGate
        slug={slug}
        access={access}
        initialToken={initialToken}
      />
    );
  }

  if (!album) {
    notFound();
  }

  return (
    <GalleryView
      slug={slug}
      state={state}
      initialPage={initialPage}
      initialFavoriteIds={initialFavoriteIds}
    />
  );
}
