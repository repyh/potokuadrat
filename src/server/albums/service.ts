import "server-only";

import type { AlbumSummary } from "@/contracts/album";
import type { AlbumDetail, CreateAlbumInput } from "@/contracts/admin";
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
  enqueueIndex: (albumId: string) => Promise<void>;
}

export interface AlbumService {
  list(ownerUserId: string): Promise<AlbumSummary[]>;
  create(ownerUserId: string, input: CreateAlbumInput): Promise<AlbumSummary>;
  detail(albumId: string): Promise<AlbumDetail | null>;
  reindex(albumId: string): Promise<boolean>;
}

export function createAlbumService(deps: AlbumServiceDeps): AlbumService {
  async function resolveFolders(input: CreateAlbumInput): Promise<FolderInput[]> {
    const seen = new Set<string>();
    const folders: FolderInput[] = [];

    for (const item of input.folders) {
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

    async create(ownerUserId, input) {
      const folders = await resolveFolders(input);
      const records = await deps.repository.ensureDriveFolders(ownerUserId, folders);

      const album = await deps.repository.createAlbum({
        ownerUserId,
        title: input.title.trim(),
        slug: createAlbumSlug(input.title),
        folderIds: records.map((record) => record.id),
      });

      try {
        await deps.enqueueIndex(album.id);
      } catch (error) {
        await deps.repository.setStatus(album.id, "failed");
        throw error;
      }

      return album;
    },

    async detail(albumId) {
      return deps.repository.getAlbumDetail(albumId);
    },

    async reindex(albumId) {
      const album = await deps.repository.getAlbum(albumId);
      if (!album) {
        return false;
      }

      await deps.repository.setStatus(albumId, "indexing");
      await deps.enqueueIndex(albumId);
      return true;
    },
  };
}
