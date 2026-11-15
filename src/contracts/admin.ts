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

/**
 * Settings for the single organization of an installation. Branding values are the
 * defaults every share inherits; a share may override them.
 */
export interface OrganizationSettings {
  name: string;
  title: string | null;
  logo: string | null;
  accent: string | null;
  footerEnabled: boolean;
  /** Default metadata policy; a share may override it. */
  stripMetadata: boolean;
  /** ISO 8601. */
  updatedAt: string;
}

export interface OrganizationSettingsInput {
  name: string;
  title?: string | null;
  logo?: string | null;
  accent?: string | null;
  footerEnabled?: boolean;
  stripMetadata?: boolean;
}

export interface OrganizationSettingsResponse {
  settings: OrganizationSettings;
}

export const DRIVE_STATUS_STATES = ["not_configured", "reachable", "failing"] as const;
export type DriveStatusState = (typeof DRIVE_STATUS_STATES)[number];

/** Health of the service-account connection, without any credential material. */
export interface DriveStatus {
  state: DriveStatusState;
  message: string;
  /** Folders and Shared Drives visible to the account, when the check succeeded. */
  folderCount: number | null;
  /** ISO 8601. */
  checkedAt: string;
}
