import "server-only";

import { and, asc, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { PhotoFilter, ThumbStatus } from "@/contracts/album";
import type { BrandingOverride } from "@/contracts/branding";
import type { DownloadQuality, ShareMode } from "@/contracts/share";
import * as schema from "@/server/db/schema";
import {
  albums,
  clientSessions,
  favorites,
  photos,
  shareRecipients,
  shares,
  users,
} from "@/server/db/schema";

export interface ShareRecord {
  id: string;
  slug: string;
  mode: ShareMode;
  passwordHash: string | null;
  expiresAt: Date | null;
  allowDownload: boolean;
  allowedQualities: DownloadQuality[];
  stripMetadata: boolean | null;
  albumId: string;
  albumSlug: string;
  albumTitle: string;
  albumBranding: BrandingOverride | null;
  photographerName: string | null;
  photoCount: number;
  organizationStripMetadata: boolean;
}

export interface SharePhotoRecord {
  id: string;
  driveFileId: string;
  name: string;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  bytes: number | null;
}

/** A gallery row. Drive ids stay server-side; the UI only needs display fields. */
export interface SharePhotoRow {
  id: string;
  name: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  thumbStatus: ThumbStatus;
  takenAt: Date | null;
  sortIndex: number;
}

export interface SharePhotoCursor {
  sortIndex: number;
  id: string;
}

export interface SharePhotoListOptions {
  filter: PhotoFilter;
  /** Required when the filter is `favorites`; ignored otherwise. */
  clientSessionId: string | null;
  cursor: SharePhotoCursor | null;
  limit: number;
}

export interface ShareArchiveOptions {
  /** Favorites of this client session, when the download scope is `favorites`. */
  clientSessionId: string | null;
  /** Explicit photo ids, already validated as UUIDs and restricted to the share. */
  photoIds: string[] | null;
  favoritesOnly: boolean;
}

export interface SharePhotoListResult {
  rows: SharePhotoRow[];
  total: number;
  /** True when more rows follow the returned page. */
  hasMore: boolean;
}

export interface RecipientRecord {
  id: string;
  email: string;
}

export interface ClientSessionRecord {
  id: string;
  email: string;
  expiresAt: Date;
}

export interface ShareRepository {
  findBySlug(slug: string): Promise<ShareRecord | null>;
  /** Returns the photo only when it belongs to the share's album and still exists. */
  getSharePhoto(share: ShareRecord, photoId: string): Promise<SharePhotoRecord | null>;
  /** Gallery page for a share, filtered and ordered by `sort_index`. */
  listSharePhotos(
    share: ShareRecord,
    options: SharePhotoListOptions,
  ): Promise<SharePhotoListResult>;
  /** Every photo an archive may include, ordered by `sort_index`. */
  listShareArchivePhotos(
    share: ShareRecord,
    options: ShareArchiveOptions,
  ): Promise<SharePhotoRecord[]>;
  /** Atomically marks a magic-link token as used. */
  consumeRecipient(shareId: string, tokenHash: string): Promise<RecipientRecord | null>;
  createClientSession(
    shareId: string,
    email: string,
    expiresAt: Date,
  ): Promise<ClientSessionRecord>;
  /**
   * Reuses a live session for the same share and email, so favorites survive a new
   * magic link.
   */
  findOrCreateClientSession(
    shareId: string,
    email: string,
    expiresAt: Date,
  ): Promise<ClientSessionRecord>;
  findClientSession(shareId: string, sessionId: string): Promise<ClientSessionRecord | null>;
  /** Favorite photo ids of one client session that are still visible in the share. */
  listFavoritePhotoIds(share: ShareRecord, clientSessionId: string): Promise<string[]>;
  /** Returns false when the photo is not part of this share. */
  addFavorite(share: ShareRecord, clientSessionId: string, photoId: string): Promise<boolean>;
  removeFavorite(clientSessionId: string, photoId: string): Promise<void>;
}

type Database = NodePgDatabase<typeof schema>;

export function createDrizzleShareRepository(db: Database): ShareRepository {
  /**
   * Photos a share may expose: the album, not tombstoned, and inside the frozen subset
   * when one exists. An empty `share_photos` set follows re-indexing.
   */
  function visiblePhotos(share: ShareRecord) {
    return and(
      eq(photos.albumId, share.albumId),
      isNull(photos.missingAt),
      sql`(
        not exists (select 1 from share_photos sp where sp.share_id = ${share.id})
        or exists (
          select 1 from share_photos sp
          where sp.share_id = ${share.id} and sp.photo_id = ${photos.id}
        )
      )`,
    );
  }

  function filterConditions(
    share: ShareRecord,
    options: Pick<SharePhotoListOptions, "filter" | "clientSessionId">,
  ) {
    const conditions = [visiblePhotos(share)];

    if (options.filter === "favorites" && options.clientSessionId) {
      conditions.push(
        sql`exists (
          select 1 from favorites f
          where f.client_session_id = ${options.clientSessionId}::uuid
            and f.photo_id = ${photos.id}
        )`,
      );
    } else if (options.filter === "landscape") {
      conditions.push(
        sql`${photos.width} is not null and ${photos.height} is not null and ${photos.width} >= ${photos.height}`,
      );
    } else if (options.filter === "portrait") {
      conditions.push(
        sql`${photos.width} is not null and ${photos.height} is not null and ${photos.width} < ${photos.height}`,
      );
    }

    return conditions;
  }

  return {
    async findBySlug(slug) {
      const [row] = await db
        .select({
          id: shares.id,
          slug: shares.slug,
          mode: shares.mode,
          passwordHash: shares.passwordHash,
          expiresAt: shares.expiresAt,
          allowDownload: shares.allowDownload,
          allowedQualities: shares.allowedQualities,
          stripMetadata: shares.stripMetadata,
          albumId: shares.albumId,
          albumSlug: albums.slug,
          albumTitle: albums.title,
          albumBranding: albums.branding,
          photographerName: users.name,
          photoCount:
            sql<number>`(select count(*) from photos p where p.album_id = ${shares.albumId} and p.missing_at is null)`.mapWith(
              Number,
            ),
          organizationStripMetadata:
            sql<boolean | null>`(select strip_metadata from organizations limit 1)`,
        })
        .from(shares)
        .innerJoin(albums, eq(shares.albumId, albums.id))
        .innerJoin(users, eq(albums.ownerUserId, users.id))
        .where(eq(shares.slug, slug))
        .limit(1);

      if (!row) {
        return null;
      }

      return {
        ...row,
        // Without an organization row the safe default still applies.
        organizationStripMetadata: row.organizationStripMetadata ?? true,
      };
    },

    async getSharePhoto(share, photoId) {
      const [row] = await db
        .select({
          id: photos.id,
          driveFileId: photos.driveFileId,
          name: photos.name,
          width: photos.width,
          height: photos.height,
          mimeType: photos.mimeType,
          bytes: photos.bytes,
        })
        .from(photos)
        .where(and(eq(photos.id, photoId), visiblePhotos(share)))
        .limit(1);

      return row ?? null;
    },

    async listSharePhotos(share, options) {
      const base = filterConditions(share, options);
      const conditions = [...base];

      if (options.cursor) {
        conditions.push(
          sql`(
            ${photos.sortIndex} > ${options.cursor.sortIndex}
            or (
              ${photos.sortIndex} = ${options.cursor.sortIndex}
              and ${photos.id} > ${options.cursor.id}::uuid
            )
          )`,
        );
      }

      const [rows, [counted]] = await Promise.all([
        db
          .select({
            id: photos.id,
            name: photos.name,
            width: photos.width,
            height: photos.height,
            bytes: photos.bytes,
            thumbStatus: photos.thumbStatus,
            takenAt: photos.takenAt,
            sortIndex: photos.sortIndex,
          })
          .from(photos)
          .where(and(...conditions))
          .orderBy(asc(photos.sortIndex), asc(photos.id))
          // One extra row tells the caller whether another page exists.
          .limit(options.limit + 1),
        db
          .select({ total: sql<number>`count(*)`.mapWith(Number) })
          .from(photos)
          .where(and(...base)),
      ]);

      return {
        rows: rows.slice(0, options.limit),
        total: counted?.total ?? 0,
        hasMore: rows.length > options.limit,
      };
    },

    async listShareArchivePhotos(share, options) {
      const conditions = [visiblePhotos(share)];

      if (options.favoritesOnly && options.clientSessionId) {
        conditions.push(
          sql`exists (
            select 1 from favorites f
            where f.client_session_id = ${options.clientSessionId}::uuid
              and f.photo_id = ${photos.id}
          )`,
        );
      }

      if (options.photoIds) {
        if (options.photoIds.length === 0) {
          return [];
        }
        conditions.push(inArray(photos.id, options.photoIds));
      }

      return db
        .select({
          id: photos.id,
          driveFileId: photos.driveFileId,
          name: photos.name,
          width: photos.width,
          height: photos.height,
          mimeType: photos.mimeType,
          bytes: photos.bytes,
        })
        .from(photos)
        .where(and(...conditions))
        .orderBy(asc(photos.sortIndex), asc(photos.id));
    },

    async consumeRecipient(shareId, tokenHash) {
      const [row] = await db
        .update(shareRecipients)
        .set({ usedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(shareRecipients.shareId, shareId),
            eq(shareRecipients.tokenHash, tokenHash),
            isNull(shareRecipients.usedAt),
          ),
        )
        .returning({ id: shareRecipients.id, email: shareRecipients.email });

      return row ?? null;
    },

    async createClientSession(shareId, email, expiresAt) {
      const [row] = await db
        .insert(clientSessions)
        .values({ shareId, email, expiresAt })
        .returning({
          id: clientSessions.id,
          email: clientSessions.email,
          expiresAt: clientSessions.expiresAt,
        });

      return row;
    },

    async findOrCreateClientSession(shareId, email, expiresAt) {
      const [existing] = await db
        .select({
          id: clientSessions.id,
          email: clientSessions.email,
          expiresAt: clientSessions.expiresAt,
        })
        .from(clientSessions)
        .where(
          and(
            eq(clientSessions.shareId, shareId),
            eq(clientSessions.email, email),
            gt(clientSessions.expiresAt, new Date()),
          ),
        )
        .orderBy(desc(clientSessions.expiresAt))
        .limit(1);

      if (existing) {
        return existing;
      }

      const [row] = await db
        .insert(clientSessions)
        .values({ shareId, email, expiresAt })
        .returning({
          id: clientSessions.id,
          email: clientSessions.email,
          expiresAt: clientSessions.expiresAt,
        });

      return row;
    },

    async findClientSession(shareId, sessionId) {
      const [row] = await db
        .select({
          id: clientSessions.id,
          email: clientSessions.email,
          expiresAt: clientSessions.expiresAt,
        })
        .from(clientSessions)
        .where(
          and(
            eq(clientSessions.id, sessionId),
            eq(clientSessions.shareId, shareId),
            gt(clientSessions.expiresAt, new Date()),
          ),
        )
        .limit(1);

      return row ?? null;
    },

    async listFavoritePhotoIds(share, clientSessionId) {
      const rows = await db
        .select({ id: favorites.photoId })
        .from(favorites)
        .innerJoin(photos, eq(favorites.photoId, photos.id))
        .where(and(eq(favorites.clientSessionId, clientSessionId), visiblePhotos(share)))
        .orderBy(asc(favorites.createdAt), asc(favorites.photoId));

      return rows.map((row) => row.id);
    },

    async addFavorite(share, clientSessionId, photoId) {
      const [visible] = await db
        .select({ id: photos.id })
        .from(photos)
        .where(and(eq(photos.id, photoId), visiblePhotos(share)))
        .limit(1);

      if (!visible) {
        return false;
      }

      await db
        .insert(favorites)
        .values({ clientSessionId, photoId })
        .onConflictDoNothing();

      return true;
    },

    async removeFavorite(clientSessionId, photoId) {
      await db
        .delete(favorites)
        .where(and(eq(favorites.clientSessionId, clientSessionId), eq(favorites.photoId, photoId)));
    },
  };
}
