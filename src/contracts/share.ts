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

/**
 * Server-side favorites for a magic-link session. Public and password shares keep
 * favorites in the browser instead, so this shape is only returned for magic links.
 */
export interface FavoritesResponse {
  photoIds: string[];
}

/** Admin view of a share recipient. The token itself is never returned again. */
export interface ShareRecipientSummary {
  id: string;
  email: string;
  /** ISO 8601; null means the token never expires. */
  expiresAt: string | null;
  /** ISO 8601 once the link has been exchanged. */
  usedAt: string | null;
  createdAt: string;
}

export interface ShareSummary {
  id: string;
  albumId: string;
  slug: string;
  mode: ShareMode;
  expiresAt: string | null;
  allowDownload: boolean;
  allowedQualities: DownloadQuality[];
  /** null inherits the organization policy. */
  stripMetadata: boolean | null;
  /** Size of the frozen subset; null when the share follows the whole album. */
  photoCount: number | null;
  recipientCount: number;
  /** Page views recorded for this link. */
  visits: number;
  /** ISO 8601 of the most recent view; null when the link was never opened. */
  lastVisitAt: string | null;
  createdAt: string;
}

export interface ShareDetail extends ShareSummary {
  branding: BrandingOverride | null;
  /** null keeps the whole album, so new photos appear after a re-index. */
  photoIds: string[] | null;
  recipients: ShareRecipientSummary[];
}

export interface ShareListResponse {
  shares: ShareSummary[];
}

export interface ShareDetailResponse {
  share: ShareDetail;
}

export interface CreateShareResponse {
  share: ShareDetail;
  /** One fresh link per recipient; they cannot be retrieved again. */
  links: IssuedMagicLink[];
}

export interface CreateShareInput {
  mode: ShareMode;
  expiresAt?: string | null;
  allowDownload?: boolean;
  allowedQualities?: DownloadQuality[];
  /** null inherits the organization policy. */
  stripMetadata?: boolean | null;
  branding?: BrandingOverride | null;
  /** Required when `mode` is `password`. */
  password?: string;
  photoIds?: string[] | null;
  /** Magic-link recipients; each one receives a one-time link. */
  recipients?: string[];
}

export interface UpdateShareInput {
  mode?: ShareMode;
  expiresAt?: string | null;
  allowDownload?: boolean;
  allowedQualities?: DownloadQuality[];
  stripMetadata?: boolean | null;
  branding?: BrandingOverride | null;
  /** Required when switching to `password` mode without an existing hash. */
  password?: string;
  photoIds?: string[] | null;
}

/** A freshly issued one-time link. It cannot be retrieved again. */
export interface IssuedMagicLink {
  recipientId: string;
  email: string;
  url: string;
  /** ISO 8601. */
  expiresAt: string;
}

export interface DownloadRequest {
  quality: DownloadQuality;
  scope: DownloadScope;
  /** Restricts a favorites download to the given photos. */
  photoIds?: string[];
}
