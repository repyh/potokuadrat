import type { AlbumIndexProgress, AlbumSummary } from "./album";

/** Where a folder option came from in the Drive picker. */
export const DRIVE_FOLDER_SOURCES = ["shared", "shared_drive", "pasted"] as const;
export type DriveFolderSource = (typeof DRIVE_FOLDER_SOURCES)[number];

export interface DriveFolderOption {
  /** Drive folder id. */
  id: string;
  name: string;
  source: DriveFolderSource;
  ownerName: string | null;
}

export interface DriveFoldersResponse {
  folders: DriveFolderOption[];
}

export interface AlbumFolderInput {
  driveFolderId: string;
  /** Optional display name; the server asks Drive when it is missing. */
  name?: string;
  recursive?: boolean;
}

export interface CreateAlbumInput {
  title: string;
  folders: AlbumFolderInput[];
}

export interface AlbumFolderSummary {
  /** Local drive_folders id. */
  id: string;
  driveFolderId: string;
  name: string;
  recursive: boolean;
}

export interface AlbumDetail {
  album: AlbumSummary;
  folders: AlbumFolderSummary[];
  progress: AlbumIndexProgress;
}

export interface AlbumDetailResponse {
  album: AlbumDetail;
}

export interface AlbumListResponse {
  albums: AlbumSummary[];
}
