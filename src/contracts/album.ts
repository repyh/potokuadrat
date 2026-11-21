/**
 * Album and photo shapes shared by the server and the UI. The string unions mirror the
 * Postgres enums; `src/server/db/schema/enums.test.ts` keeps them in sync.
 */

export const ALBUM_STATUSES = ["indexing", "ready", "failed"] as const;
export type AlbumStatus = (typeof ALBUM_STATUSES)[number];

export const THUMB_STATUSES = ["pending", "ready", "failed", "missing"] as const;
export type ThumbStatus = (typeof THUMB_STATUSES)[number];

export const PHOTO_ORIENTATIONS = ["landscape", "portrait", "unknown"] as const;
export type PhotoOrientation = (typeof PHOTO_ORIENTATIONS)[number];

export const PHOTO_FILTERS = ["all", "favorites", "landscape", "portrait"] as const;
export type PhotoFilter = (typeof PHOTO_FILTERS)[number];

export interface Photo {
  id: string;
  name: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  orientation: PhotoOrientation;
  /** `missing` means the file disappeared from Drive during a re-index. */
  thumbStatus: ThumbStatus;
  /** ISO 8601, from EXIF when Drive provides it. */
  takenAt: string | null;
  sortIndex: number;
}

export interface AlbumSummary {
  id: string;
  slug: string;
  title: string;
  status: AlbumStatus;
  coverPhotoId: string | null;
  /** Photos indexed for the album, including ones Drive no longer returns. */
  photoCount: number;
  /** Photos whose thumbnails are ready to serve. */
  readyPhotoCount: number;
  /** Share links created for the album, expired ones included. */
  shareCount: number;
  /** ISO 8601. */
  createdAt: string;
  /** ISO 8601; moves on rename, branding edits, and indexing status changes. */
  updatedAt: string;
}

export interface PhotoPage {
  photos: Photo[];
  nextCursor: string | null;
  /** Number of photos matching the requested filter. */
  total: number;
}

export interface PhotoQuery {
  filter?: PhotoFilter;
  cursor?: string | null;
  limit?: number;
}

export interface AlbumIndexProgress {
  total: number;
  ready: number;
  pending: number;
  failed: number;
  missing: number;
}
