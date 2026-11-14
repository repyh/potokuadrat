import "server-only";

import type { AlbumIndexProgress } from "@/contracts/album";
import type { DriveClient, DrivePhoto } from "@/server/drive/client";
import { naturalCompare } from "@/server/photos/sort";

import type { AlbumRepository, IndexedPhoto } from "./repository";

export interface IndexAlbumDeps {
  repository: AlbumRepository;
  drive: Pick<DriveClient, "listImages">;
}

function toDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toRow(photo: DrivePhoto, sortIndex: number): IndexedPhoto {
  return {
    driveFileId: photo.id,
    name: photo.name,
    mimeType: photo.mimeType,
    width: photo.width,
    height: photo.height,
    bytes: photo.bytes,
    takenAt: toDate(photo.takenAt),
    driveModifiedAt: toDate(photo.modifiedTime),
    sortIndex,
  };
}

/**
 * Reads every folder of an album, upserts the photo metadata, and tombstones rows whose
 * file disappeared from Drive. Nothing is downloaded: only `files.list` metadata is used.
 */
export async function indexAlbum(
  albumId: string,
  deps: IndexAlbumDeps,
): Promise<AlbumIndexProgress> {
  const album = await deps.repository.getAlbum(albumId);
  if (!album) {
    throw new Error(`Album ${albumId} not found.`);
  }

  const folders = await deps.repository.getAlbumFolders(albumId);
  await deps.repository.setStatus(albumId, "indexing");

  try {
    const seen = new Map<string, DrivePhoto>();

    for (const folder of folders) {
      const photos = await deps.drive.listImages(folder.driveFolderId, {
        recursive: folder.recursive,
      });
      for (const photo of photos) {
        // The same file can appear in two folders; keep the first occurrence.
        if (!seen.has(photo.id)) {
          seen.set(photo.id, photo);
        }
      }
    }

    const ordered = [...seen.values()].sort((a, b) => naturalCompare(a.name, b.name));
    await deps.repository.upsertPhotos(
      albumId,
      ordered.map((photo, index) => toRow(photo, index)),
    );
    await deps.repository.markMissingPhotos(
      albumId,
      ordered.map((photo) => photo.id),
    );

    const progress = await deps.repository.countProgress(albumId);
    await deps.repository.setStatus(albumId, "ready");
    return progress;
  } catch (error) {
    await deps.repository.setStatus(albumId, "failed");
    throw error;
  }
}
