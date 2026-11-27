"use client";

import { useEffect, useRef } from "react";

import type { Photo } from "@/contracts/album";
import type { DownloadQuality } from "@/contracts/share";

export interface ShareLightboxProps {
  slug: string;
  photos: Photo[];
  activeIndex: number | null;
  favoriteIds: Set<string>;
  allowDownload: boolean;
  preferredQuality: DownloadQuality;
  onClose: () => void;
  onNavigate: (nextIndex: number) => void;
  onToggleFavorite: (photoId: string) => void;
}

function formatBytes(bytes: number | null): string | null {
  if (!bytes || bytes <= 0) {
    return null;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ShareLightbox({
  slug,
  photos,
  activeIndex,
  favoriteIds,
  allowDownload,
  preferredQuality,
  onClose,
  onNavigate,
  onToggleFavorite,
}: ShareLightboxProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const photo = activeIndex !== null ? photos[activeIndex] ?? null : null;

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) {
      return;
    }
    if (photo && !el.open) {
      el.showModal();
    } else if (!photo && el.open) {
      el.close();
    }
  }, [photo]);

  useEffect(() => {
    if (activeIndex === null) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && activeIndex > 0) {
        event.preventDefault();
        onNavigate(activeIndex - 1);
      } else if (event.key === "ArrowRight" && activeIndex < photos.length - 1) {
        event.preventDefault();
        onNavigate(activeIndex + 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, onNavigate, photos.length]);

  useEffect(() => {
    if (activeIndex === null) {
      return;
    }

    const neighborIndices = [activeIndex - 1, activeIndex + 1].filter(
      (idx) => idx >= 0 && idx < photos.length,
    );
    for (const idx of neighborIndices) {
      const neighbor = photos[idx];
      if (neighbor) {
        const img = new window.Image();
        img.src = `/s/${encodeURIComponent(slug)}/thumb/${encodeURIComponent(neighbor.id)}?w=1600`;
      }
    }
  }, [activeIndex, photos, slug]);

  if (!photo || activeIndex === null) {
    return <dialog ref={dialogRef} className="share-lightbox" aria-label="Photo preview" />;
  }

  const isFav = favoriteIds.has(photo.id);
  const hasPrev = activeIndex > 0;
  const hasNext = activeIndex < photos.length - 1;
  const sizeLabel = formatBytes(photo.bytes);
  const dimsLabel =
    photo.width && photo.height ? `${photo.width} × ${photo.height}` : null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          onClose();
        }
      }}
      className="share-lightbox"
      aria-label={photo.name}
    >
      <div className="share-lightbox-shell">
        <header className="share-lightbox-bar">
          <div className="share-lightbox-meta">
            <span className="share-lightbox-count tabular-nums">
              {activeIndex + 1} / {photos.length}
            </span>
            <span className="share-lightbox-name">{photo.name}</span>
            {(dimsLabel || sizeLabel) && (
              <span className="share-lightbox-specs tabular-nums">
                {[dimsLabel, sizeLabel].filter(Boolean).join(" · ")}
              </span>
            )}
          </div>

          <div className="share-lightbox-actions">
            <button
              type="button"
              onClick={() => onToggleFavorite(photo.id)}
              aria-pressed={isFav}
              className={`share-lightbox-btn ${isFav ? "is-active" : ""}`.trim()}
            >
              {isFav ? "Favorited" : "Favorite"}
            </button>

            {allowDownload && (
              <a
                href={`/s/${encodeURIComponent(slug)}/download/${encodeURIComponent(photo.id)}?quality=${preferredQuality}`}
                download
                className="share-lightbox-btn share-lightbox-btn-primary"
              >
                Download
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="share-lightbox-btn"
            >
              Close
            </button>
          </div>
        </header>

        <div className="share-lightbox-stage">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => onNavigate(activeIndex - 1)}
            aria-label="Previous photo"
            className="share-lightbox-nav share-lightbox-prev"
          >
            ←
          </button>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/s/${encodeURIComponent(slug)}/thumb/${encodeURIComponent(photo.id)}?w=1600`}
            srcSet={`/s/${encodeURIComponent(slug)}/thumb/${encodeURIComponent(photo.id)}?w=800 800w, /s/${encodeURIComponent(slug)}/thumb/${encodeURIComponent(photo.id)}?w=1600 1600w`}
            sizes="100vw"
            alt={photo.name}
            decoding="async"
            className="share-lightbox-img"
          />

          <button
            type="button"
            disabled={!hasNext}
            onClick={() => onNavigate(activeIndex + 1)}
            aria-label="Next photo"
            className="share-lightbox-nav share-lightbox-next"
          >
            →
          </button>
        </div>
      </div>
    </dialog>
  );
}
