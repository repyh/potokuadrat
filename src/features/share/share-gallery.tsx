"use client";

import { memo, useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

import type { Photo, PhotoFilter, PhotoPage } from "@/contracts/album";
import type { DownloadQuality, GalleryAlbum, SharePolicy } from "@/contracts/share";
import { Alert, Button, EmptyState } from "@/components/ui";

import { countFavorites, loadAllRemainingPhotos, resolveGalleryTotal } from "./gallery-pages";
import { ShareGridSkeleton } from "./share-grid-skeleton";
import { useShareFavorites } from "./use-share-favorites";

const ShareLightbox = dynamic(
  () => import("./share-lightbox").then((mod) => mod.ShareLightbox),
  { ssr: false },
);

const ShareDownloadDialog = dynamic(
  () => import("./share-download-dialog").then((mod) => mod.ShareDownloadDialog),
  { ssr: false },
);

export function buildShareThumbSrcSet(
  slug: string,
  photoId: string,
  widths: readonly number[] = [400, 800],
): string {
  const encodedSlug = encodeURIComponent(slug);
  const encodedPhotoId = encodeURIComponent(photoId);
  return widths
    .map((width) => `/s/${encodedSlug}/thumb/${encodedPhotoId}?w=${width} ${width}w`)
    .join(", ");
}

interface SharePhotoTileProps {
  slug: string;
  photo: Photo;
  index: number;
  isFavorite: boolean;
  showDownloadCta: boolean;
  preferredQuality: DownloadQuality;
  onOpen: (index: number) => void;
  onToggleFavorite: (photoId: string) => void;
}

const SharePhotoTile = memo(function SharePhotoTile({
  slug,
  photo,
  index,
  isFavorite,
  showDownloadCta,
  preferredQuality,
  onOpen,
  onToggleFavorite,
}: SharePhotoTileProps) {
  const aspectRatio =
    photo.width && photo.height ? `${photo.width} / ${photo.height}` : "4 / 3";

  return (
    <article className="share-tile">
      <button
        type="button"
        onClick={() => onOpen(index)}
        className="share-tile-media"
        style={{ aspectRatio }}
        aria-label={`Open ${photo.name}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/s/${encodeURIComponent(slug)}/thumb/${encodeURIComponent(photo.id)}?w=400`}
          srcSet={buildShareThumbSrcSet(slug, photo.id)}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
          width={photo.width ?? undefined}
          height={photo.height ?? undefined}
          alt={photo.name}
          loading={index < 4 ? "eager" : "lazy"}
          fetchPriority={index === 0 ? "high" : "auto"}
          decoding="async"
          className="share-tile-img"
        />
      </button>

      <div className="share-tile-overlay">
        <button
          type="button"
          onClick={() => onToggleFavorite(photo.id)}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? `Remove ${photo.name} from favorites` : `Favorite ${photo.name}`}
          className={`share-fav-btn ${isFavorite ? "is-active" : ""}`.trim()}
        >
          <svg viewBox="0 0 20 20" fill={isFavorite ? "currentColor" : "none"} aria-hidden="true">
            <path
              d="M10 17.25s-6.5-4.1-6.5-9.05A3.7 3.7 0 0 1 7.2 4.5c1.25 0 2.25.63 2.8 1.56A3.4 3.4 0 0 1 12.8 4.5a3.7 3.7 0 0 1 3.7 3.7c0 4.95-6.5 9.05-6.5 9.05Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {showDownloadCta && (
          <a
            href={`/s/${encodeURIComponent(slug)}/download/${encodeURIComponent(photo.id)}?quality=${preferredQuality}`}
            download
            aria-label={`Download ${photo.name}`}
            className="share-dl-btn"
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M10 3.5v9.25m0 0-3.5-3.5M10 12.75l3.5-3.5M4 15.75h12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        )}
      </div>
    </article>
  );
});

export interface ShareGalleryProps {
  slug: string;
  album: GalleryAlbum;
  policy: SharePolicy;
  initialPage: PhotoPage;
  initialFavoriteIds?: string[];
}

export const FILTER_LABELS: Record<PhotoFilter, string> = {
  all: "All",
  favorites: "Favorites",
  landscape: "Landscape",
  portrait: "Portrait",
};

export function resolvePreferredQuality(allowedQualities: DownloadQuality[]): DownloadQuality {
  return allowedQualities.includes("original") ? "original" : (allowedQualities[0] ?? "web");
}

export function formatExpiry(expiresAt: string | null): string | null {
  if (!expiresAt) {
    return null;
  }
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function ShareGallery({
  slug,
  album,
  policy,
  initialPage,
  initialFavoriteIds = [],
}: ShareGalleryProps) {
  const [filter, setFilter] = useState<PhotoFilter>("all");
  const [photos, setPhotos] = useState<Photo[]>(initialPage.photos);
  const [allPhotos, setAllPhotos] = useState<Photo[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(initialPage.nextCursor);
  const [filterTotal, setFilterTotal] = useState<number>(initialPage.total);
  const [loadingFilter, setLoadingFilter] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const filterRequestRef = useRef(0);

  const { favoriteIds, favoriteList, toggleFavorite, error: favoriteError } =
    useShareFavorites(slug, policy.mode, initialFavoriteIds);

  const preferredQuality: DownloadQuality = resolvePreferredQuality(policy.allowedQualities);

  const visiblePhotos = useMemo(() => {
    if (filter === "favorites") {
      return photos.filter((photo) => favoriteIds.has(photo.id));
    }
    return photos;
  }, [favoriteIds, filter, photos]);

  // Once every album page is cached, the local favorite count is exact. Before that,
  // public/password shares may only have the local set, which #51 allows as a total.
  const favoriteCount = useMemo(
    () => (allPhotos ? countFavorites(allPhotos, favoriteIds) : favoriteIds.size),
    [allPhotos, favoriteIds],
  );

  const displayedTotal = resolveGalleryTotal({
    filter,
    mode: policy.mode,
    serverTotal: filterTotal,
    favoriteCount,
  });

  const requestPhotoPage = useCallback(
    async (
      filterValue: PhotoFilter,
      cursor: string | null,
      fallback: string,
    ): Promise<PhotoPage> => {
      const params = new URLSearchParams({ filter: filterValue, limit: "50" });
      if (cursor) {
        params.set("cursor", cursor);
      }

      const response = await fetch(
        `/api/share/${encodeURIComponent(slug)}/photos?${params.toString()}`,
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? fallback);
      }

      return (await response.json()) as PhotoPage;
    },
    [slug],
  );

  const handleFilterChange = useCallback(
    async (nextFilter: PhotoFilter) => {
      const requestId = ++filterRequestRef.current;
      const isCurrent = () => requestId === filterRequestRef.current;

      setFilter(nextFilter);
      setFetchError(null);
      setLightboxIndex(null);

      if (nextFilter === "all") {
        setPhotos(initialPage.photos);
        setNextCursor(initialPage.nextCursor);
        setFilterTotal(initialPage.total);
        return;
      }

      // For public/password favorites, load every album page once so the local
      // filter covers the whole share. The cache lets a revisit skip the refetch.
      if (nextFilter === "favorites" && policy.mode !== "magic_link") {
        if (allPhotos) {
          setPhotos(allPhotos);
          setNextCursor(null);
          return;
        }

        if (!initialPage.nextCursor) {
          setAllPhotos(initialPage.photos);
          setPhotos(initialPage.photos);
          setNextCursor(null);
          return;
        }

        setLoadingFilter(true);
        try {
          const loaded = await loadAllRemainingPhotos(initialPage, (cursor) =>
            requestPhotoPage("all", cursor, "Unable to load all photos for favorites."),
          );
          if (!isCurrent()) {
            return;
          }
          setAllPhotos(loaded);
          setPhotos(loaded);
          setNextCursor(null);
        } catch (error) {
          if (!isCurrent()) {
            return;
          }
          setFetchError(
            error instanceof Error
              ? error.message
              : "Unable to load all photos for favorites.",
          );
        } finally {
          if (isCurrent()) {
            setLoadingFilter(false);
          }
        }
        return;
      }

      setLoadingFilter(true);
      try {
        const page = await requestPhotoPage(
          nextFilter,
          null,
          "Unable to filter photos right now.",
        );
        if (!isCurrent()) {
          return;
        }
        setPhotos(page.photos);
        setNextCursor(page.nextCursor);
        setFilterTotal(page.total);
      } catch (error) {
        if (!isCurrent()) {
          return;
        }
        setFetchError(error instanceof Error ? error.message : "Unable to load filtered photos.");
      } finally {
        if (isCurrent()) {
          setLoadingFilter(false);
        }
      }
    },
    [allPhotos, initialPage, policy.mode, requestPhotoPage],
  );

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) {
      return;
    }

    const requestId = filterRequestRef.current;
    setLoadingMore(true);
    setFetchError(null);

    const serverFilter: PhotoFilter =
      filter === "favorites" && policy.mode !== "magic_link" ? "all" : filter;

    try {
      const page = await requestPhotoPage(
        serverFilter,
        nextCursor,
        "Unable to load more photos.",
      );
      if (requestId !== filterRequestRef.current) {
        return;
      }
      setPhotos((prev) => [...prev, ...page.photos]);
      setNextCursor(page.nextCursor);
      setFilterTotal(page.total);
    } catch (error) {
      if (requestId !== filterRequestRef.current) {
        return;
      }
      setFetchError(error instanceof Error ? error.message : "Unable to load more photos.");
    } finally {
      setLoadingMore(false);
    }
  }, [filter, loadingMore, nextCursor, policy.mode, requestPhotoPage]);

  const handleToggleFavorite = useCallback(
    async (photoId: string) => {
      const wasFavorite = favoriteIds.has(photoId);
      const saved = await toggleFavorite(photoId);

      // Magic-link favorites are server-filtered; keep the denominator in step when
      // one is removed from the open Favorites view. Public/password totals come from
      // the cached album and update automatically.
      if (saved && wasFavorite && filter === "favorites" && policy.mode === "magic_link") {
        setFilterTotal((total) => Math.max(0, total - 1));
      }
    },
    [favoriteIds, filter, policy.mode, toggleFavorite],
  );

  const handleFavoriteClick = useCallback(
    (photoId: string) => {
      void handleToggleFavorite(photoId);
    },
    [handleToggleFavorite],
  );

  const expiryLabel = formatExpiry(policy.expiresAt);
  const showDownloadCta = policy.allowDownload && policy.allowedQualities.length > 0;
  const activeError = fetchError ?? favoriteError;

  return (
    <section className="share-folio" aria-labelledby="album-heading">
      <header className="share-header">
        <div className="share-header-copy">
          <p className="hero-eyebrow">
            {album.photographerName ?? "Client folio"} ·{" "}
            <span className="tabular-nums">{album.photoCount}</span> photos
            {expiryLabel ? ` · Available until ${expiryLabel}` : ""}
          </p>
          <h1 id="album-heading">{album.title}</h1>
          {album.branding?.welcomeMessage && (
            <p className="auth-lede">{album.branding.welcomeMessage}</p>
          )}
        </div>

        {showDownloadCta && (
          <div className="share-header-actions">
            <Button
              variant="primary"
              size="md"
              onClick={() => setDownloadOpen(true)}
              disabled={album.photoCount === 0}
            >
              Download all
            </Button>
          </div>
        )}
      </header>

      <div className="share-toolbar" role="region" aria-label="Gallery filters">
        <div className="share-filter-row" role="tablist" aria-label="Filter photographs">
          {(Object.keys(FILTER_LABELS) as PhotoFilter[]).map((key) => {
            const isActive = filter === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => void handleFilterChange(key)}
                className={`share-filter-chip ${isActive ? "is-active" : ""}`.trim()}
              >
                <span>{FILTER_LABELS[key]}</span>
                {key === "favorites" && (
                  <span className="share-filter-count tabular-nums">
                    {favoriteCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p className="share-toolbar-count tabular-nums">
          Showing {visiblePhotos.length} of {displayedTotal}
        </p>
      </div>

      {activeError && (
        <Alert tone="danger" title="Something went wrong">
          {activeError}
        </Alert>
      )}

      {loadingFilter ? (
        <ShareGridSkeleton label="Loading photographs" />
      ) : visiblePhotos.length === 0 ? (
        <EmptyState
          title={
            filter === "favorites"
              ? "No favorite photos yet"
              : "No photographs match this filter"
          }
          description={
            filter === "favorites"
              ? "Tap the heart button on any photograph to build your favorites selection."
              : "Try switching back to All photographs to view the full folio."
          }
          action={
            filter !== "all" ? (
              <Button variant="secondary" onClick={() => void handleFilterChange("all")}>
                Show all photos
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="share-grid">
            {visiblePhotos.map((photo, index) => (
              <SharePhotoTile
                key={photo.id}
                slug={slug}
                photo={photo}
                index={index}
                isFavorite={favoriteIds.has(photo.id)}
                showDownloadCta={showDownloadCta}
                preferredQuality={preferredQuality}
                onOpen={setLightboxIndex}
                onToggleFavorite={handleFavoriteClick}
              />
            ))}
          </div>

          {nextCursor && (
            <div className="share-load-more">
              <Button
                variant="secondary"
                loading={loadingMore}
                onClick={() => void handleLoadMore()}
              >
                Load more photos
              </Button>
            </div>
          )}
        </>
      )}

      {lightboxIndex !== null && (
        <ShareLightbox
          slug={slug}
          photos={visiblePhotos}
          activeIndex={lightboxIndex}
          favoriteIds={favoriteIds}
          allowDownload={showDownloadCta}
          preferredQuality={preferredQuality}
          onClose={() => setLightboxIndex(null)}
          onNavigate={(nextIndex) => setLightboxIndex(nextIndex)}
          onToggleFavorite={handleFavoriteClick}
        />
      )}

      {showDownloadCta && downloadOpen && (
        <ShareDownloadDialog
          open={downloadOpen}
          onClose={() => setDownloadOpen(false)}
          slug={slug}
          mode={policy.mode}
          allowedQualities={policy.allowedQualities}
          totalCount={album.photoCount}
          favoriteIds={favoriteList}
        />
      )}
    </section>
  );
}
