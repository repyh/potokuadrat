"use client";

import { useState } from "react";
import type { GalleryAlbum, SharePolicy } from "./types";

export interface FolioSpineProps {
  slug: string;
  album: GalleryAlbum;
  policy: SharePolicy | null;
  className?: string;
}

export function FolioSpine({
  slug,
  album,
  policy,
  className = "",
}: FolioSpineProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is blocked
    }
  };

  const allowDownload = policy?.allowDownload ?? true;
  const downloadUrl = `/api/share/${encodeURIComponent(slug)}/download.zip`;

  return (
    <aside
      className={`bg-[var(--ink)] text-[var(--paper)] p-6 md:p-8 flex flex-col justify-between border-r border-[#102821] ${className}`}
    >
      <div>
        <div className="text-[10px] tracking-[0.2em] uppercase font-bold text-[var(--accent)] mb-3">
          Potokuadrat Folio
        </div>

        <h1 className="font-[var(--font-display)] text-2xl sm:text-3xl leading-tight font-normal text-[var(--paper)] mb-2">
          {album.title}
        </h1>

        {album.photographerName && (
          <p className="text-xs text-[#a9b8a5] mb-6">
            Photographs by{" "}
            <span className="text-[var(--paper)] font-medium">
              {album.photographerName}
            </span>
          </p>
        )}

        <div className="border-t border-[#285548] pt-4 text-xs space-y-2">
          <div className="flex justify-between text-[#a9b8a5]">
            <span>Total frames</span>
            <span className="font-mono text-[var(--paper)] tabular-nums">
              {album.photoCount} photos
            </span>
          </div>
          {policy && (
            <>
              <div className="flex justify-between text-[#a9b8a5]">
                <span>Download resolution</span>
                <span className="font-mono text-[var(--paper)] capitalize">
                  {policy.allowedQualities.join(" & ") || "Original"}
                </span>
              </div>
              <div className="flex justify-between text-[#a9b8a5]">
                <span>Access mode</span>
                <span className="text-[var(--accent)] font-medium capitalize">
                  {policy.mode.replace("_", " ")}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="pt-8 space-y-2">
        {allowDownload && (
          <a
            href={downloadUrl}
            download
            className="w-full bg-[var(--accent)] text-[var(--ink)] hover:bg-[var(--paper)] transition-colors text-xs font-bold py-3 px-4 uppercase tracking-wider flex items-center justify-center gap-2 no-underline text-center"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M8 2.5v8m0 0l-3-3m3 3l3-3M2.5 13.5h11"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="square"
              />
            </svg>
            <span>Download Archive (ZIP)</span>
          </a>
        )}

        <button
          type="button"
          onClick={handleCopyLink}
          className="w-full border border-[#477365] text-[var(--paper)] hover:bg-[#285548] transition-colors text-xs py-2.5 px-3 flex items-center justify-center gap-2 cursor-pointer"
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <rect
              x="5"
              y="5"
              width="8"
              height="8"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M3 11V3h8"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
          <span>{copied ? "Link Copied!" : "Copy Share Link"}</span>
        </button>
      </div>
    </aside>
  );
}
