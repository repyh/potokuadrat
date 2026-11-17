"use client";

import { useEffect, useCallback, useRef } from "react";
import type { Photo, SharePolicy } from "./types";

export interface LightboxProps {
  slug: string;
  photos: Photo[];
  currentIndex: number;
  isOpen: boolean;
  isFavorite: boolean;
  policy: SharePolicy | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onToggleFavorite: () => void;
}

export function Lightbox({
  slug,
  photos,
  currentIndex,
  isOpen,
  isFavorite,
  policy,
  onClose,
  onNavigate,
  onToggleFavorite,
}: LightboxProps) {
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const total = photos.length;
  const currentPhoto: Photo | undefined = photos[currentIndex];

  const handlePrev = useCallback(() => {
    if (total === 0) return;
    onNavigate((currentIndex - 1 + total) % total);
  }, [currentIndex, total, onNavigate]);

  const handleNext = useCallback(() => {
    if (total === 0) return;
    onNavigate((currentIndex + 1) % total);
  }, [currentIndex, total, onNavigate]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    // Auto-focus close button on mount for accessibility
    closeButtonRef.current?.focus();

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, handlePrev, handleNext]);

  // Touch swipe handling for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0]?.clientX ?? null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0]?.clientX ?? null;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    if (distance > 50) {
      handleNext();
    } else if (distance < -50) {
      handlePrev();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  if (!isOpen || !currentPhoto) {
    return null;
  }

  const allowDownload = policy?.allowDownload ?? true;
  const downloadUrl = `/s/${encodeURIComponent(slug)}/download/${encodeURIComponent(currentPhoto.id)}`;
  const previewUrl = `/s/${encodeURIComponent(slug)}/download/${encodeURIComponent(currentPhoto.id)}?quality=web`;

  const formatBytes = (bytes: number | null): string => {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo preview lightbox"
      className="fixed inset-0 z-50 bg-[#102821]/95 backdrop-blur-xs flex flex-col justify-between p-3 sm:p-6 text-[var(--paper)] select-none"
      onClick={onClose}
    >
      {/* Top Bar */}
      <header
        className="flex items-center justify-between text-xs text-[#a9b8a5] pb-3 border-b border-[#285548] z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-[var(--accent)] font-bold tabular-nums">
            {currentIndex + 1} / {total}
          </span>
          <span className="text-[var(--paper)] font-mono truncate max-w-[200px] sm:max-w-md">
            {currentPhoto.name}
          </span>
          {currentPhoto.width && currentPhoto.height && (
            <span className="hidden sm:inline text-[#78958a] font-mono">
              · {currentPhoto.width} × {currentPhoto.height}
            </span>
          )}
          {currentPhoto.bytes && (
            <span className="hidden sm:inline text-[#78958a] font-mono">
              · {formatBytes(currentPhoto.bytes)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {allowDownload && (
            <a
              href={downloadUrl}
              download={currentPhoto.name}
              className="bg-[var(--accent)] text-[var(--ink)] hover:bg-[var(--paper)] transition-colors font-bold px-3 py-1.5 text-xs flex items-center gap-1.5 no-underline"
            >
              <span>Download</span>
            </a>
          )}

          <button
            type="button"
            onClick={onToggleFavorite}
            aria-label={isFavorite ? "Remove favorite" : "Add favorite"}
            className={`px-3 py-1.5 border text-xs font-medium cursor-pointer transition-colors ${
              isFavorite
                ? "bg-[var(--accent)] text-[var(--ink)] border-[var(--accent)] font-bold"
                : "border-[#477365] text-[var(--paper)] hover:bg-[#285548]"
            }`}
          >
            {isFavorite ? "★ Favorited" : "☆ Favorite"}
          </button>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="px-2.5 py-1.5 border border-[#477365] text-[var(--paper)] hover:bg-[#285548] transition-colors text-xs font-mono cursor-pointer"
          >
            Esc [×]
          </button>
        </div>
      </header>

      {/* Main Image Viewport */}
      <main
        className="relative flex-1 my-3 flex items-center justify-center overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Previous Button */}
        {total > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous photo"
            className="absolute left-2 sm:left-4 z-20 p-3 sm:p-4 bg-[var(--ink)]/80 text-[var(--accent)] hover:bg-[var(--ink)] transition-colors text-xl font-bold cursor-pointer"
          >
            ‹
          </button>
        )}

        {/* Photo Container */}
        <div className="relative max-w-full max-h-[78vh] flex items-center justify-center p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={currentPhoto.name}
            className="max-h-[75vh] max-w-[90vw] object-contain border border-[#285548] shadow-2xl"
          />
        </div>

        {/* Next Button */}
        {total > 1 && (
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next photo"
            className="absolute right-2 sm:right-4 z-20 p-3 sm:p-4 bg-[var(--ink)]/80 text-[var(--accent)] hover:bg-[var(--ink)] transition-colors text-xl font-bold cursor-pointer"
          >
            ›
          </button>
        )}
      </main>

      {/* Bottom Footer with Shortcuts */}
      <footer
        className="flex items-center justify-between text-[11px] text-[#78958a] pt-2 border-t border-[#285548] z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-4">
          <span>
            <kbd className="px-1.5 py-0.5 bg-[var(--ink)] text-[var(--accent)] font-mono">
              ←
            </kbd>{" "}
            Previous
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-[var(--ink)] text-[var(--accent)] font-mono">
              →
            </kbd>{" "}
            Next
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-[var(--ink)] text-[var(--accent)] font-mono">
              Esc
            </kbd>{" "}
            Close
          </span>
        </div>

        <span className="font-mono text-[var(--accent)]">
          {currentPhoto.orientation}
        </span>
      </footer>
    </div>
  );
}
