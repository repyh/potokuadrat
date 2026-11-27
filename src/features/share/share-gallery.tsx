"use client";

import { memo, useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

import type { Photo, PhotoFilter, PhotoPage, PhotoSort } from "@/contracts/album";
import type { DownloadQuality, GalleryAlbum, SharePolicy } from "@/contracts/share";
import { Alert, Button, EmptyState, Select } from "@/components/ui";

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
  brandTitle?: string;
}

export const FILTER_LABELS: Record<PhotoFilter, string> = {
  all: "All",
  favorites: "Favorites",
  landscape: "Landscape",
  portrait: "Portrait",
};

export const SORT_LABELS: Record<PhotoSort, string> = {
  manual: "Manual",
  name: "Name",
  taken: "Date taken",
};

export function formatShareBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb >= 100 ? Math.round(kb) : kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  if (mb < 1024) {
    return `${mb >= 100 ? Math.round(mb) : mb.toFixed(1)} MB`;
  }
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

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
  brandTitle,
}: ShareGalleryProps) {
  const [filter, setFilter] = useState<PhotoFilter>("all");
  const [sort, setSort] = useState<PhotoSort>("manual");
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
      sortValue: PhotoSort,
      cursor: string | null,
      fallback: string,
    ): Promise<PhotoPage> => {
      const params = new URLSearchParams({
        filter: filterValue,
        sort: sortValue,
        limit: "50",
      });
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

  const loadSelection = useCallback(
    async (nextFilter: PhotoFilter, nextSort: PhotoSort, resetCache: boolean) => {
      const requestId = ++filterRequestRef.current;
      const isCurrent = () => requestId === filterRequestRef.current;

      setFetchError(null);
      setLightboxIndex(null);
      if (resetCache) {
        setAllPhotos(null);
      }

      if (nextFilter === "all" && nextSort === "manual") {
        setPhotos(initialPage.photos);
        setNextCursor(initialPage.nextCursor);
        setFilterTotal(initialPage.total);
        setLoadingFilter(false);
        return;
      }

      // For public/password favorites, load every album page once so the local
      // filter covers the whole share in the active sort order.
      if (nextFilter === "favorites" && policy.mode !== "magic_link") {
        if (!resetCache && allPhotos) {
          setPhotos(allPhotos);
          setNextCursor(null);
          setLoadingFilter(false);
          return;
        }

        if (nextSort === "manual" && !initialPage.nextCursor) {
          setAllPhotos(initialPage.photos);
          setPhotos(initialPage.photos);
          setNextCursor(null);
          setLoadingFilter(false);
          return;
        }

        setLoadingFilter(true);
        try {
          const seedPage =
            nextSort === "manual"
              ? initialPage
              : await requestPhotoPage(
                  "all",
                  nextSort,
                  null,
                  "Unable to load sorted photos for favorites.",
                );
          if (!isCurrent()) {
            return;
          }
          const loaded = await loadAllRemainingPhotos(seedPage, (cursor) =>
            requestPhotoPage("all", nextSort, cursor, "Unable to load all photos for favorites."),
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
          nextSort,
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

  const handleFilterChange = useCallback(
    async (nextFilter: PhotoFilter) => {
      setFilter(nextFilter);
      await loadSelection(nextFilter, sort, false);
    },
    [loadSelection, sort],
  );

  const handleSortChange = useCallback(
    async (nextSort: PhotoSort) => {
      setSort(nextSort);
      await loadSelection(filter, nextSort, true);
    },
    [filter, loadSelection],
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
        sort,
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
  }, [filter, loadingMore, nextCursor, policy.mode, requestPhotoPage, sort]);

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
  const totalSizeLabel = formatShareBytes(album.totalBytes);
  const activeDestination: "photos" | "favorites" | "downloads" = downloadOpen
    ? "downloads"
    : filter === "favorites"
      ? "favorites"
      : "photos";

  const filterCounts: Record<PhotoFilter, number> = {
    all: album.photoCount,
    favorites: favoriteCount,
    landscape: album.orientationCounts.landscape,
    portrait: album.orientationCounts.portrait,
  };

  return (
    <section
      className={`share-folio-shell ${showDownloadCta ? "has-mobile-bar" : ""}`.trim()}
      aria-labelledby="album-heading"
    >
      <aside className="share-spine" aria-label="Album folio">
        <div className="share-spine-top">
          <div className="share-spine-identity">
            {(album.photographerName || brandTitle) && (
              <p className="share-spine-kicker">
                {album.photographerName ?? brandTitle}
              </p>
            )}
            <h1 id="album-heading" className="share-spine-title">
              {album.title}
            </h1>
            <p className="share-spine-meta tabular-nums">
              <span>{album.photoCount} photos</span>
              <span aria-hidden="true">·</span>
              <span>{totalSizeLabel}</span>
            </p>
            {expiryLabel && (
              <p className="share-spine-expiry">Available until {expiryLabel}</p>
            )}
            {album.branding?.welcomeMessage && (
              <p className="share-spine-note">{album.branding.welcomeMessage}</p>
            )}
          </div>

          <nav className="share-spine-nav" aria-label="Folio destinations">
            <button
              type="button"
              aria-current={activeDestination === "photos" ? "page" : undefined}
              onClick={() => void handleFilterChange("all")}
              className={`share-dest ${activeDestination === "photos" ? "is-active" : ""}`.trim()}
            >
              <span className="share-dest-label">
                <span className="share-dest-marker" aria-hidden="true" />
                <span>Photos</span>
              </span>
              <span className="share-dest-count tabular-nums">{album.photoCount}</span>
            </button>

            <button
              type="button"
              aria-current={activeDestination === "favorites" ? "page" : undefined}
              onClick={() => void handleFilterChange("favorites")}
              className={`share-dest ${activeDestination === "favorites" ? "is-active" : ""}`.trim()}
            >
              <span className="share-dest-label">
                <span className="share-dest-marker" aria-hidden="true" />
                <span>Favorites</span>
              </span>
              <span className="share-dest-count tabular-nums">{favoriteCount}</span>
            </button>

            {showDownloadCta && (
              <button
                type="button"
                aria-current={activeDestination === "downloads" ? "page" : undefined}
                onClick={() => setDownloadOpen(true)}
                disabled={album.photoCount === 0}
                className={`share-dest ${activeDestination === "downloads" ? "is-active" : ""}`.trim()}
              >
                <span className="share-dest-label">
                  <span className="share-dest-marker" aria-hidden="true" />
                  <span>Downloads</span>
                </span>
                <span className="share-dest-count tabular-nums">{totalSizeLabel}</span>
              </button>
            )}
          </nav>
        </div>

        {showDownloadCta && (
          <div className="share-spine-foot">
            <Button
              variant="primary"
              size="md"
              onClick={() => setDownloadOpen(true)}
              disabled={album.photoCount === 0}
            >
              Download all →
            </Button>
          </div>
        )}
      </aside>

      <div className="share-folio-main">
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
                  <span className="share-filter-count tabular-nums">
                    {filterCounts[key]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="share-toolbar-end">
            <div className="share-sort-select">
              <Select
                aria-label="Sort photographs"
                value={sort}
                disabled={loadingFilter}
                onChange={(event) => void handleSortChange(event.target.value as PhotoSort)}
                options={(Object.keys(SORT_LABELS) as PhotoSort[]).map((key) => ({
                  value: key,
                  label: SORT_LABELS[key],
                }))}
              />
            </div>

            <p className="share-toolbar-count tabular-nums">
              Showing {visiblePhotos.length} of {displayedTotal}
            </p>
          </div>
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

      </div>

      {showDownloadCta && (
        <div className="share-mobile-bar">
          <span className="share-mobile-bar-meta tabular-nums">
            {album.photoCount} photos · {totalSizeLabel}
          </span>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setDownloadOpen(true)}
            disabled={album.photoCount === 0}
          >
            Download
          </Button>
        </div>
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
          onToggleFavorite={(photoId) => void handleToggleFavorite(photoId)}
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
