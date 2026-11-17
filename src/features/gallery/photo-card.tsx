"use client";

import { useState } from "react";
import type { Photo } from "./types";

export interface PhotoCardProps {
  slug: string;
  photo: Photo;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
}

export function PhotoCard({
  slug,
  photo,
  isFavorite,
  onSelect,
  onToggleFavorite,
}: PhotoCardProps) {
  const [imageError, setImageError] = useState(false);
  const thumbUrl = `/s/${encodeURIComponent(slug)}/thumb/${encodeURIComponent(photo.id)}`;

  // Determine aspect ratio class based on orientation / dimensions
  const aspectClass =
    photo.orientation === "portrait"
      ? "aspect-[3/4]"
      : photo.orientation === "landscape"
        ? "aspect-[4/3]"
        : "aspect-square";

  return (
    <article
      className={`group relative border border-[var(--line)] bg-[var(--ground)] overflow-hidden cursor-pointer ${aspectClass}`}
      onClick={onSelect}
    >
      {!imageError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbUrl}
          alt={photo.name}
          loading="lazy"
          onError={() => setImageError(true)}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-[var(--paper)] text-[var(--quiet)]">
          <svg
            className="w-8 h-8 mb-2 opacity-50"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="0" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          <span className="text-[11px] font-mono truncate max-w-full">
            {photo.name}
          </span>
        </div>
      )}

      {/* Hover Overlay with Quick Actions */}
      <div className="absolute inset-0 bg-[var(--ink)]/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-3">
        <span className="text-[var(--accent)] text-xs font-bold uppercase tracking-wider bg-[var(--ink)]/80 px-2.5 py-1">
          Inspect ↗
        </span>
      </div>

      {/* Favorite Button (top right) */}
      <button
        type="button"
        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(e);
        }}
        className={`absolute top-2 right-2 w-8 h-8 flex items-center justify-center transition-all ${
          isFavorite
            ? "bg-[var(--accent)] text-[var(--ink)] opacity-100"
            : "bg-[var(--ink)]/70 text-[var(--paper)] opacity-0 group-hover:opacity-100 hover:bg-[var(--ink)]"
        }`}
      >
        <span className="text-sm font-bold">{isFavorite ? "★" : "☆"}</span>
      </button>

      {/* File Name Tag (bottom left) */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-[var(--ink)]/80 to-transparent p-2 pt-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-[10px] font-mono text-[var(--paper)] truncate">
          {photo.name}
        </p>
      </div>
    </article>
  );
}
