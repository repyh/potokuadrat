"use client";

import { useCallback, useMemo, useState } from "react";

import type { Photo, PhotoFilter, PhotoPage } from "@/contracts/album";
import type { DownloadQuality, GalleryAlbum, SharePolicy } from "@/contracts/share";
import { Alert, Button, EmptyState } from "@/components/ui";

import { ShareDownloadDialog } from "./share-download-dialog";
import { ShareGridSkeleton } from "./share-grid-skeleton";
import { ShareLightbox } from "./share-lightbox";
import { useShareFavorites } from "./use-share-favorites";

export interface ShareGalleryProps {
  slug: string;
  album: GalleryAlbum;
  policy: SharePolicy;
  initialPage: PhotoPage;
  initialFavoriteIds?: string[];
}

const FILTER_LABELS: Record<PhotoFilter, string> = {
  all: "All",
  favorites: "Favorites",
  landscape: "Landscape",
  portrait: "Portrait",
};

function formatExpiry(expiresAt: string | null): string | null {
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
  const [nextCursor, setNextCursor] = useState<string | null>(initialPage.nextCursor);
  const [loadingFilter, setLoadingFilter] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);

  const { favoriteIds, favoriteList, toggleFavorite, error: favoriteError } =
    useShareFavorites(slug, policy.mode, initialFavoriteIds);

  const preferredQuality: DownloadQuality = policy.allowedQualities.includes("original")
    ? "original"
    : (policy.allowedQualities[0] ?? "web");

  const visiblePhotos = useMemo(() => {
    if (filter === "favorites" && policy.mode !== "magic_link") {
      return photos.filter((photo) => favoriteIds.has(photo.id));
    }
    return photos;
  }, [favoriteIds, filter, photos, policy.mode]);

  const handleFilterChange = useCallback(
    async (nextFilter: PhotoFilter) => {
      setFilter(nextFilter);
      setFetchError(null);
      setLightboxIndex(null);

      if (nextFilter === "favorites" && policy.mode !== "magic_link") {
        return;
      }

      if (nextFilter === "all") {
        setPhotos(initialPage.photos);
        setNextCursor(initialPage.nextCursor);
        return;
      }

      setLoadingFilter(true);
      try {
        const params = new URLSearchParams({ filter: nextFilter, limit: "50" });
        const response = await fetch(
          `/api/share/${encodeURIComponent(slug)}/photos?${params.toString()}`,
        );

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          setFetchError(body?.error ?? "Unable to filter photos right now.");
          return;
        }

        const page = (await response.json()) as PhotoPage;
        setPhotos(page.photos);
        setNextCursor(page.nextCursor);
      } catch {
        setFetchError("Unable to load filtered photos.");
      } finally {
        setLoadingFilter(false);
      }
    },
    [initialPage.nextCursor, initialPage.photos, policy.mode, slug],
  );

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) {
      return;
    }

    setLoadingMore(true);
    setFetchError(null);

    const serverFilter: PhotoFilter =
      filter === "favorites" && policy.mode !== "magic_link" ? "all" : filter;

    try {
      const params = new URLSearchParams({
        filter: serverFilter,
        cursor: nextCursor,
        limit: "50",
      });
      const response = await fetch(
        `/api/share/${encodeURIComponent(slug)}/photos?${params.toString()}`,
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setFetchError(body?.error ?? "Unable to load more photos.");
        return;
      }

      const page = (await response.json()) as PhotoPage;
      setPhotos((prev) => [...prev, ...page.photos]);
      setNextCursor(page.nextCursor);
    } catch {
      setFetchError("Unable to load more photos.");
    } finally {
      setLoadingMore(false);
    }
  }, [filter, loadingMore, nextCursor, policy.mode, slug]);

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
                    {favoriteList.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p className="share-toolbar-count tabular-nums">
          Showing {visiblePhotos.length} of {album.photoCount}
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
            {visiblePhotos.map((photo, index) => {
              const isFav = favoriteIds.has(photo.id);
              const aspectRatio =
                photo.width && photo.height ? `${photo.width} / ${photo.height}` : "4 / 3";

              return (
                <article key={photo.id} className="share-tile">
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(index)}
                    className="share-tile-media"
                    style={{ aspectRatio }}
                    aria-label={`Open ${photo.name}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/s/${encodeURIComponent(slug)}/thumb/${encodeURIComponent(photo.id)}?w=400`}
                      alt={photo.name}
                      loading="lazy"
                      className="share-tile-img"
                    />
                  </button>

                  <div className="share-tile-overlay">
                    <button
                      type="button"
                      onClick={() => void toggleFavorite(photo.id)}
                      aria-pressed={isFav}
                      aria-label={isFav ? `Remove ${photo.name} from favorites` : `Favorite ${photo.name}`}
                      className={`share-fav-btn ${isFav ? "is-active" : ""}`.trim()}
                    >
                      <svg viewBox="0 0 20 20" fill={isFav ? "currentColor" : "none"} aria-hidden="true">
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
            })}
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

      <ShareLightbox
        slug={slug}
        photos={visiblePhotos}
        activeIndex={lightboxIndex}
        favoriteIds={favoriteIds}
        allowDownload={showDownloadCta}
        preferredQuality={preferredQuality}
        onClose={() => setLightboxIndex(null)}
        onNavigate={(nextIndex) => setLightboxIndex(nextIndex)}
        onToggleFavorite={(photoId) => void toggleFavorite(photoId)}
      />

      {showDownloadCta && (
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
