import "server-only";

import { getDb } from "@/server/db/client";
import { getDriveRuntime } from "@/server/drive";
import { enqueueIndexAlbum } from "@/server/jobs";

import type { AlbumRepository } from "./repository";
import { createDrizzleAlbumRepository } from "./repository";
import type { AlbumService } from "./service";
import { createAlbumService } from "./service";

let repository: AlbumRepository | null = null;
let service: AlbumService | null = null;

export function getAlbumRepository(): AlbumRepository {
  repository ??= createDrizzleAlbumRepository(getDb());
  return repository;
}

export function getAlbumService(): AlbumService {
  service ??= createAlbumService({
    repository: getAlbumRepository(),
    drive: () => getDriveRuntime().client,
    enqueueIndex: (albumId) => enqueueIndexAlbum(albumId),
  });
  return service;
}
