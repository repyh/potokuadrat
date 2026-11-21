import type { AlbumStatus, AlbumSummary } from "@/contracts/album";

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

export function AlbumCoverMark({ title }: { title: string }) {
  return (
    <span className="admin-cover-mark" aria-hidden="true">
      {title.trim().charAt(0).toUpperCase() || "A"}
    </span>
  );
}
