/**
 * Share and gallery shapes shared by the server and the UI. The string unions mirror
 * the Postgres enums; `src/server/db/schema/enums.test.ts` keeps them in sync.
 */

import type { BrandingOverride } from "./branding";

export const SHARE_MODES = ["public", "password", "magic_link"] as const;
export type ShareMode = (typeof SHARE_MODES)[number];

export const DOWNLOAD_QUALITIES = ["original", "web"] as const;
export type DownloadQuality = (typeof DOWNLOAD_QUALITIES)[number];

export const DOWNLOAD_SCOPES = ["all", "favorites"] as const;
export type DownloadScope = (typeof DOWNLOAD_SCOPES)[number];

/**
 * Everything the gallery page needs to decide what to render. Access rules are
 * resolved on the server; the UI never compares expiry or policy itself.
 */
export const GALLERY_ACCESS = [
  "ok",
  "password_required",
  "magic_link_required",
  "expired",
  "unavailable",
] as const;
export type GalleryAccess = (typeof GALLERY_ACCESS)[number];

export interface SharePolicy {
  mode: ShareMode;
  allowDownload: boolean;
  allowedQualities: DownloadQuality[];
  stripMetadata: boolean;
  /** ISO 8601, or null when the share never expires. */
  expiresAt: string | null;
}

export interface GalleryAlbum {
  slug: string;
  title: string;
  photoCount: number;
  branding: BrandingOverride | null;
  photographerName: string | null;
}

export interface GalleryState {
  access: GalleryAccess;
  album: GalleryAlbum | null;
  policy: SharePolicy | null;
}

export interface DownloadRequest {
  quality: DownloadQuality;
  scope: DownloadScope;
  /** Restricts a favorites download to the given photos. */
  photoIds?: string[];
}
