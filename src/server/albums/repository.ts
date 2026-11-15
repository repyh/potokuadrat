import "server-only";

import { and, asc, count, desc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { AlbumIndexProgress, AlbumStatus, AlbumSummary } from "@/contracts/album";
import type { AlbumDetail, AlbumFolderSummary } from "@/contracts/admin";
import type { BrandingOverride } from "@/contracts/branding";
import * as schema from "@/server/db/schema";
import { albumFolders, albums, driveFolders, photos } from "@/server/db/schema";

export interface AlbumRecord {
  id: string;
  title: string;
  slug: string;
  ownerUserId: string;
  status: AlbumStatus;
}

export interface AlbumFolderRecord {
  id: string;
  driveFolderId: string;
  name: string;
  recursive: boolean;
  lastIndexedAt: Date | null;
}

export interface FolderInput {
  driveFolderId: string;
  name: string;
  recursive: boolean;
}

export interface IndexedPhoto {
  driveFileId: string;
  name: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  takenAt: Date | null;
  driveModifiedAt: Date | null;
  sortIndex: number;
}

export interface CreateAlbumRecordInput {
  ownerUserId: string;
  title: string;
  slug: string;
  /** Local drive_folders ids. */
  folderIds: string[];
}

export interface AlbumRepository {
  ensureDriveFolders(ownerUserId: string, folders: FolderInput[]): Promise<AlbumFolderRecord[]>;
  createAlbum(input: CreateAlbumRecordInput): Promise<AlbumSummary>;
  listAlbums(ownerUserId: string): Promise<AlbumSummary[]>;
  getAlbum(albumId: string): Promise<AlbumRecord | null>;
  getAlbumFolders(albumId: string): Promise<AlbumFolderRecord[]>;
  getAlbumDetail(albumId: string): Promise<AlbumDetail | null>;
  setStatus(albumId: string, status: AlbumStatus): Promise<void>;
  updateAlbum(
    albumId: string,
    patch: { title?: string; branding?: BrandingOverride | null },
  ): Promise<void>;
  /** Replaces the album's folder set with local `drive_folders` ids. */
  replaceFolders(albumId: string, folderIds: string[]): Promise<void>;
  deleteAlbum(albumId: string): Promise<void>;
  setCoverPhoto(albumId: string, photoId: string | null): Promise<void>;
  /** Returns the photo only when it belongs to the album and is not tombstoned. */
  findAlbumPhoto(albumId: string, photoId: string): Promise<{ id: string } | null>;
  markFoldersIndexed(folderIds: string[], at: Date): Promise<void>;
  upsertPhotos(albumId: string, rows: IndexedPhoto[]): Promise<void>;
  markMissingPhotos(albumId: string, seenDriveFileIds: string[]): Promise<number>;
  countProgress(albumId: string): Promise<AlbumIndexProgress>;
}

type Database = NodePgDatabase<typeof schema>;

const UPSERT_CHUNK = 200;

function toSummary(
  row: {
    id: string;
    slug: string;
    title: string;
    status: AlbumStatus;
    coverPhotoId: string | null;
    createdAt: Date;
  },
  photoCount: number,
): AlbumSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    coverPhotoId: row.coverPhotoId,
    photoCount,
    createdAt: row.createdAt.toISOString(),
  };
}

export function createDrizzleAlbumRepository(db: Database): AlbumRepository {
  async function countProgress(albumId: string): Promise<AlbumIndexProgress> {
    const [row] = await db
      .select({
        total: count(),
        ready: sql<number>`count(*) filter (where ${photos.thumbStatus} = 'ready' and ${photos.missingAt} is null)`.mapWith(
          Number,
        ),
        pending: sql<number>`count(*) filter (where ${photos.thumbStatus} = 'pending' and ${photos.missingAt} is null)`.mapWith(
          Number,
        ),
        failed: sql<number>`count(*) filter (where ${photos.thumbStatus} = 'failed' and ${photos.missingAt} is null)`.mapWith(
          Number,
        ),
        missing: sql<number>`count(*) filter (where ${photos.missingAt} is not null)`.mapWith(Number),
      })
      .from(photos)
      .where(eq(photos.albumId, albumId));

    return {
      total: Number(row?.total ?? 0),
      ready: row?.ready ?? 0,
      pending: row?.pending ?? 0,
      failed: row?.failed ?? 0,
      missing: row?.missing ?? 0,
    };
  }

  async function getAlbum(albumId: string): Promise<AlbumRecord | null> {
    const [row] = await db
      .select({
        id: albums.id,
        title: albums.title,
        slug: albums.slug,
        ownerUserId: albums.ownerUserId,
        status: albums.status,
      })
      .from(albums)
      .where(eq(albums.id, albumId))
      .limit(1);

    return row ?? null;
  }

  async function getAlbumFolders(albumId: string): Promise<AlbumFolderRecord[]> {
    return db
      .select({
        id: driveFolders.id,
        driveFolderId: driveFolders.driveFolderId,
        name: driveFolders.name,
        recursive: driveFolders.recursive,
        lastIndexedAt: driveFolders.lastIndexedAt,
      })
      .from(albumFolders)
      .innerJoin(driveFolders, eq(albumFolders.driveFolderId, driveFolders.id))
      .where(eq(albumFolders.albumId, albumId))
      .orderBy(asc(albumFolders.position), asc(driveFolders.name));
  }

  return {
    async ensureDriveFolders(ownerUserId, folders) {
      if (folders.length === 0) {
        return [];
      }

      await db
        .insert(driveFolders)
        .values(
          folders.map((folder) => ({
            driveFolderId: folder.driveFolderId,
            name: folder.name,
            ownerUserId,
            recursive: folder.recursive,
          })),
        )
        .onConflictDoUpdate({
          target: driveFolders.driveFolderId,
          set: {
            name: sql`excluded.name`,
            recursive: sql`excluded.recursive`,
            updatedAt: sql`now()`,
          },
        });

      const rows = await db
        .select({
          id: driveFolders.id,
          driveFolderId: driveFolders.driveFolderId,
          name: driveFolders.name,
          recursive: driveFolders.recursive,
          lastIndexedAt: driveFolders.lastIndexedAt,
        })
        .from(driveFolders)
        .where(
          inArray(
            driveFolders.driveFolderId,
            folders.map((folder) => folder.driveFolderId),
          ),
        );

      const byDriveId = new Map(rows.map((row) => [row.driveFolderId, row]));
      return folders
        .map((folder) => byDriveId.get(folder.driveFolderId))
        .filter((row): row is AlbumFolderRecord => Boolean(row));
    },

    async createAlbum(input) {
      return db.transaction(async (tx) => {
        const [album] = await tx
          .insert(albums)
          .values({
            ownerUserId: input.ownerUserId,
            title: input.title,
            slug: input.slug,
            status: "indexing",
          })
          .returning();

        if (input.folderIds.length > 0) {
          await tx.insert(albumFolders).values(
            input.folderIds.map((driveFolderId, position) => ({
              albumId: album.id,
              driveFolderId,
              position,
            })),
          );
        }

        return toSummary(album, 0);
      });
    },

    async listAlbums(ownerUserId) {
      const rows = await db
        .select({
          id: albums.id,
          slug: albums.slug,
          title: albums.title,
          status: albums.status,
          coverPhotoId: albums.coverPhotoId,
          createdAt: albums.createdAt,
          value: count(photos.id),
        })
        .from(albums)
        .leftJoin(photos, eq(photos.albumId, albums.id))
        .where(eq(albums.ownerUserId, ownerUserId))
        .groupBy(albums.id)
        .orderBy(desc(albums.createdAt));

      return rows.map((row) => toSummary(row, Number(row.value)));
    },

    getAlbum,
    getAlbumFolders,

    async getAlbumDetail(albumId) {
      const album = await getAlbum(albumId);
      if (!album) {
        return null;
      }

      const [summary, folders, progress] = await Promise.all([
        db
          .select({
            id: albums.id,
            slug: albums.slug,
            title: albums.title,
            status: albums.status,
            coverPhotoId: albums.coverPhotoId,
            createdAt: albums.createdAt,
          })
          .from(albums)
          .where(eq(albums.id, albumId))
          .limit(1)
          .then((rows) => rows[0]),
        getAlbumFolders(albumId),
        countProgress(albumId),
      ]);

      if (!summary) {
        return null;
      }

      return {
        album: toSummary(summary, progress.total),
        folders: folders.map<AlbumFolderSummary>((folder) => ({
          id: folder.id,
          driveFolderId: folder.driveFolderId,
          name: folder.name,
          recursive: folder.recursive,
        })),
        progress,
      };
    },

    async markFoldersIndexed(folderIds, at) {
      if (folderIds.length === 0) {
        return;
      }

      await db
        .update(driveFolders)
        .set({ lastIndexedAt: at, updatedAt: at })
        .where(inArray(driveFolders.id, folderIds));
    },

    async setStatus(albumId, status) {
      await db
        .update(albums)
        .set({ status, updatedAt: new Date() })
        .where(eq(albums.id, albumId));
    },

    async updateAlbum(albumId, patch) {
      const values: Record<string, unknown> = { updatedAt: new Date() };
      if (patch.title !== undefined) {
        values.title = patch.title;
      }
      if (patch.branding !== undefined) {
        values.branding = patch.branding;
      }

      await db.update(albums).set(values).where(eq(albums.id, albumId));
    },

    async replaceFolders(albumId, folderIds) {
      await db.transaction(async (tx) => {
        await tx.delete(albumFolders).where(eq(albumFolders.albumId, albumId));

        if (folderIds.length > 0) {
          await tx.insert(albumFolders).values(
            folderIds.map((driveFolderId, position) => ({
              albumId,
              driveFolderId,
              position,
            })),
          );
        }
      });
    },

    async deleteAlbum(albumId) {
      await db.delete(albums).where(eq(albums.id, albumId));
    },

    async setCoverPhoto(albumId, photoId) {
      await db
        .update(albums)
        .set({ coverPhotoId: photoId, updatedAt: new Date() })
        .where(eq(albums.id, albumId));
    },

    async findAlbumPhoto(albumId, photoId) {
      const [row] = await db
        .select({ id: photos.id })
        .from(photos)
        .where(
          and(
            eq(photos.id, photoId),
            eq(photos.albumId, albumId),
            isNull(photos.missingAt),
          ),
        )
        .limit(1);

      return row ?? null;
    },

    async upsertPhotos(albumId, rows) {
      if (rows.length === 0) {
        return;
      }

      for (let start = 0; start < rows.length; start += UPSERT_CHUNK) {
        const chunk = rows.slice(start, start + UPSERT_CHUNK);
        await db
          .insert(photos)
          .values(chunk.map((row) => ({ albumId, ...row })))
          .onConflictDoUpdate({
            target: [photos.albumId, photos.driveFileId],
            set: {
              name: sql`excluded.name`,
              mimeType: sql`excluded.mime_type`,
              width: sql`excluded.width`,
              height: sql`excluded.height`,
              bytes: sql`excluded.bytes`,
              takenAt: sql`excluded.taken_at`,
              driveModifiedAt: sql`excluded.drive_modified_at`,
              sortIndex: sql`excluded.sort_index`,
              missingAt: sql`null`,
              updatedAt: sql`now()`,
            },
          });
      }
    },

    async markMissingPhotos(albumId, seenDriveFileIds) {
      const filter =
        seenDriveFileIds.length === 0
          ? and(eq(photos.albumId, albumId), isNull(photos.missingAt))
          : and(
              eq(photos.albumId, albumId),
              isNull(photos.missingAt),
              notInArray(photos.driveFileId, seenDriveFileIds),
            );

      const rows = await db
        .update(photos)
        .set({ missingAt: new Date(), updatedAt: new Date() })
        .where(filter)
        .returning({ id: photos.id });

      return rows.length;
    },

    countProgress,
  };
}
