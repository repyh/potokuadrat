import "server-only";

import type { AlbumSummary } from "@/contracts/album";
import type {
  AlbumDetail,
  AlbumFolderInput,
  CreateAlbumInput,
  OrganizerStats,
  UpdateAlbumInput,
} from "@/contracts/admin";
import { DriveError, parseDriveFolderInput, type DriveClient } from "@/server/drive/client";

import type { AlbumRepository, FolderInput } from "./repository";
import { createAlbumSlug } from "./slug";

export class AlbumValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AlbumValidationError";
  }
}

export interface AlbumServiceDeps {
  repository: AlbumRepository;
  /** Resolved lazily because listing albums must not require Drive credentials. */
  drive: () => Pick<DriveClient, "getFolder">;
  enqueueIndex: (
    albumId: string,
    options?: { mode?: "full" | "incremental" },
  ) => Promise<void>;
}

export interface AlbumService {
  list(ownerUserId: string): Promise<AlbumSummary[]>;
  stats(ownerUserId: string): Promise<OrganizerStats>;
  create(ownerUserId: string, input: CreateAlbumInput): Promise<AlbumSummary>;
  detail(albumId: string): Promise<AlbumDetail | null>;
  reindex(albumId: string, mode?: "full" | "incremental"): Promise<boolean>;
  /** Returns null when the album is missing or belongs to someone else. */
  update(
    ownerUserId: string,
    albumId: string,
    input: UpdateAlbumInput,
  ): Promise<AlbumDetail | null>;
  remove(ownerUserId: string, albumId: string): Promise<boolean>;
  /** Returns null when the album is missing or belongs to someone else. */
  setCover(
    ownerUserId: string,
    albumId: string,
    photoId: string | null,
  ): Promise<AlbumDetail | null>;
}

export function createAlbumService(deps: AlbumServiceDeps): AlbumService {
  async function resolveFolders(items: AlbumFolderInput[]): Promise<FolderInput[]> {
    const seen = new Set<string>();
    const folders: FolderInput[] = [];

    for (const item of items) {
      const driveFolderId = parseDriveFolderInput(item.driveFolderId);
      if (!driveFolderId) {
        throw new AlbumValidationError("Enter a valid Drive folder link or id.");
      }
      if (seen.has(driveFolderId)) {
        continue;
      }
      seen.add(driveFolderId);

      let name = item.name?.trim();
      if (!name) {
        try {
          name = (await deps.drive().getFolder(driveFolderId)).name;
        } catch (error) {
          if (error instanceof DriveError) {
            throw new AlbumValidationError(
              `Folder ${driveFolderId} is not accessible to the service account.`,
            );
          }
          throw error;
        }
      }

      folders.push({
        driveFolderId,
        name,
        recursive: item.recursive ?? true,
      });
    }

    if (folders.length === 0) {
      throw new AlbumValidationError("Add at least one Drive folder.");
    }

    return folders;
  }

  return {
    async list(ownerUserId) {
      return deps.repository.listAlbums(ownerUserId);
    },

    async stats(ownerUserId) {
      return deps.repository.getOrganizerStats(ownerUserId);
    },

    async create(ownerUserId, input) {
      const folders = await resolveFolders(input.folders);
      const records = await deps.repository.ensureDriveFolders(ownerUserId, folders);

      const album = await deps.repository.createAlbum({
        ownerUserId,
        title: input.title.trim(),
        slug: createAlbumSlug(input.title),
        folderIds: records.map((record) => record.id),
      });

      try {
        await deps.enqueueIndex(album.id, { mode: "full" });
      } catch (error) {
        await deps.repository.setStatus(album.id, "failed");
        throw error;
      }

      return album;
    },

    async detail(albumId) {
      return deps.repository.getAlbumDetail(albumId);
    },

    async reindex(albumId, mode = "full") {
      const album = await deps.repository.getAlbum(albumId);
      if (!album) {
        return false;
      }

      await deps.repository.setStatus(albumId, "indexing");
      await deps.enqueueIndex(albumId, { mode });
      return true;
    },

    async update(ownerUserId, albumId, input) {
      const album = await deps.repository.getAlbum(albumId);
      if (!album || album.ownerUserId !== ownerUserId) {
        return null;
      }

      const title = input.title?.trim();
      if (input.title !== undefined && (!title || title.length < 2)) {
        throw new AlbumValidationError("Enter an album title.");
      }

      if (title !== undefined || input.branding !== undefined) {
        await deps.repository.updateAlbum(albumId, { title, branding: input.branding });
      }

      if (input.folders) {
        const folders = await resolveFolders(input.folders);
        const records = await deps.repository.ensureDriveFolders(ownerUserId, folders);
        await deps.repository.replaceFolders(
          albumId,
          records.map((record) => record.id),
        );
        await deps.repository.setStatus(albumId, "indexing");

        try {
          await deps.enqueueIndex(albumId, { mode: "full" });
        } catch (error) {
          await deps.repository.setStatus(albumId, "failed");
          throw error;
        }
      }

      return deps.repository.getAlbumDetail(albumId);
    },

    async remove(ownerUserId, albumId) {
      const album = await deps.repository.getAlbum(albumId);
      if (!album || album.ownerUserId !== ownerUserId) {
        return false;
      }

      await deps.repository.deleteAlbum(albumId);
      return true;
    },

    async setCover(ownerUserId, albumId, photoId) {
      const album = await deps.repository.getAlbum(albumId);
      if (!album || album.ownerUserId !== ownerUserId) {
        return null;
      }

      if (photoId !== null) {
        const photo = await deps.repository.findAlbumPhoto(albumId, photoId);
        if (!photo) {
          throw new AlbumValidationError("Choose a photo from this album.");
        }
      }

      await deps.repository.setCoverPhoto(albumId, photoId);
      return deps.repository.getAlbumDetail(albumId);
    },
  };
}
