"use client";

import { useState, useMemo, useCallback } from "react";
import type { Photo, PhotoFilter, PhotoPage, GalleryState } from "./types";
import { FolioSpine } from "./folio-spine";
import { FilterBar } from "./filter-bar";
import { PhotoCard } from "./photo-card";
import { Lightbox } from "./lightbox";

export interface GalleryViewProps {
  slug: string;
  state: GalleryState;
  initialPage: PhotoPage;
}

export function GalleryView({ slug, state, initialPage }: GalleryViewProps) {
  const [photos, setPhotos] = useState<Photo[]>(initialPage.photos);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialPage.nextCursor,
  );
  const [activeFilter, setActiveFilter] = useState<PhotoFilter>("all");
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Lazy-initialize favorites from localStorage to prevent synchronous setState in effect
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem(`pk_favs_${slug}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return new Set(parsed);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
    return new Set();
  });

  // Save favorites to localStorage
  const toggleFavorite = useCallback(
    (photoId: string) => {
      setFavorites((prev) => {
        const next = new Set(prev);
        if (next.has(photoId)) {
          next.delete(photoId);
        } else {
          next.add(photoId);
        }
        try {
          localStorage.setItem(
            `pk_favs_${slug}`,
            JSON.stringify(Array.from(next)),
          );
        } catch {
          // Ignore
        }
        return next;
      });
    },
    [slug],
  );

  // Filter photos
  const filteredPhotos = useMemo(() => {
    switch (activeFilter) {
      case "landscape":
        return photos.filter((p) => p.orientation === "landscape");
      case "portrait":
        return photos.filter((p) => p.orientation === "portrait");
      case "favorites":
        return photos.filter((p) => favorites.has(p.id));
      case "all":
      default:
        return photos;
    }
  }, [photos, activeFilter, favorites]);

  // Compute counts for filter bar
  const counts = useMemo(
    () => ({
      all: initialPage.total || photos.length,
      landscape: photos.filter((p) => p.orientation === "landscape").length,
      portrait: photos.filter((p) => p.orientation === "portrait").length,
      favorites: favorites.size,
    }),
    [photos, initialPage.total, favorites],
  );

  // Load more via cursor pagination
  const handleLoadMore = async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const url = `/api/share/${encodeURIComponent(slug)}/photos?cursor=${encodeURIComponent(nextCursor)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data: PhotoPage = await res.json();
        setPhotos((prev) => [...prev, ...data.photos]);
        setNextCursor(data.nextCursor);
      }
    } catch {
      // Ignore network errors
    } finally {
      setIsLoadingMore(false);
    }
  };

  if (!state.album) {
    return null;
  }

  return (
    <div className="folio-frame bg-[var(--ground)] min-h-screen p-3 sm:p-6 md:p-8 flex justify-center">
      <div className="w-full max-w-7xl bg-[var(--paper)] border border-[var(--line)] shadow-lg grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr] min-h-[85vh]">
        
        {/* Folio Spine (Desktop left / Mobile top) */}
        <FolioSpine slug={slug} album={state.album} policy={state.policy} />

        {/* Gallery Content Area */}
        <div className="p-4 sm:p-6 lg:p-8 flex flex-col justify-between overflow-hidden">
          <div>
            {/* Header / Filter Toolbar */}
            <div className="pb-4 mb-6 border-b border-[var(--line)] flex flex-wrap items-center justify-between gap-3">
              <FilterBar
                activeFilter={activeFilter}
                counts={counts}
                onFilterChange={setActiveFilter}
              />
              <span className="text-[11px] font-mono text-[var(--quiet)] tabular-nums">
                Showing {filteredPhotos.length} of {photos.length} frames
              </span>
            </div>

            {/* Photo Grid */}
            {filteredPhotos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {filteredPhotos.map((photo, index) => (
                  <PhotoCard
                    key={photo.id}
                    slug={slug}
                    photo={photo}
                    isFavorite={favorites.has(photo.id)}
                    onSelect={() => setLightboxIndex(index)}
                    onToggleFavorite={() => toggleFavorite(photo.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="py-16 text-center border border-dashed border-[var(--line)] bg-[var(--ground)]/40 p-8">
                <p className="font-[var(--font-display)] text-lg text-[var(--ink)] mb-1">
                  {activeFilter === "favorites"
                    ? "No favorites saved yet"
                    : "No photographs match this filter"}
                </p>
                <p className="text-xs text-[var(--quiet)] max-w-sm mx-auto">
                  {activeFilter === "favorites"
                    ? "Click the star icon on any photo to pin it to your personal favorites collection."
                    : "Select 'All' to browse the complete photographic folio."}
                </p>
              </div>
            )}
          </div>

          {/* Footer & Pagination */}
          <div className="pt-8 mt-8 border-t border-[var(--line)] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--quiet)]">
            <span>The Open Photographic Folio · Crisp square borders</span>

            {nextCursor && (
              <button
                type="button"
                disabled={isLoadingMore}
                onClick={handleLoadMore}
                className="px-6 py-2.5 bg-[var(--ink)] text-[var(--paper)] hover:bg-[var(--accent)] hover:text-[var(--ink)] transition-colors font-bold uppercase tracking-wider text-xs cursor-pointer disabled:opacity-50"
              >
                {isLoadingMore ? "Loading frames…" : "Load More Frames"}
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Lightbox Overlay */}
      {lightboxIndex !== null && (
        <Lightbox
          slug={slug}
          photos={filteredPhotos}
          currentIndex={lightboxIndex}
          isOpen={lightboxIndex !== null}
          isFavorite={
            filteredPhotos[lightboxIndex]
              ? favorites.has(filteredPhotos[lightboxIndex].id)
              : false
          }
          policy={state.policy}
          onClose={() => setLightboxIndex(null)}
          onNavigate={(newIndex) => setLightboxIndex(newIndex)}
          onToggleFavorite={() => {
            const current = filteredPhotos[lightboxIndex];
            if (current) toggleFavorite(current.id);
          }}
        />
      )}
    </div>
  );
}
