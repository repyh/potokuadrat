"use client";

import { useState } from "react";

import type { AlbumStatus, AlbumSummary } from "@/contracts/album";

import { adminPhotoThumbUrl } from "./album-media";
import { formatCount } from "./format";

export const ALBUM_STATUS_LABEL: Record<AlbumStatus, string> = {
  ready: "Ready",
  indexing: "Indexing",
  failed: "Failed",
};

/** A pending index reports how many thumbnails are already servable. */
export function albumPhotoLabel(album: AlbumSummary): string {
  if (album.status === "indexing") {
    return `${formatCount(album.readyPhotoCount)} / ${formatCount(album.photoCount)}`;
  }
  return formatCount(album.photoCount);
}

export function AlbumStatusPill({ status }: { status: AlbumStatus }) {
  return (
    <span className={`admin-status-pill is-${status}`}>{ALBUM_STATUS_LABEL[status]}</span>
  );
}

export function AlbumCoverMark({
  albumId,
  coverPhotoId,
  title,
}: {
  albumId?: string;
  coverPhotoId?: string | null;
  title: string;
}) {
  const [failedCoverId, setFailedCoverId] = useState<string | null>(null);
  const showCover = Boolean(albumId && coverPhotoId && failedCoverId !== coverPhotoId);

  if (showCover && albumId && coverPhotoId) {
    return (
      <span className="admin-cover-mark is-image" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={adminPhotoThumbUrl(albumId, coverPhotoId, 400)}
          alt=""
          className="admin-cover-img"
          loading="lazy"
          decoding="async"
          onError={() => setFailedCoverId(coverPhotoId)}
        />
      </span>
    );
  }

  return (
    <span className="admin-cover-mark" aria-hidden="true">
      {title.trim().charAt(0).toUpperCase() || "A"}
    </span>
  );
}
