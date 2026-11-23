import "server-only";

import { and, asc, desc, eq, gt, ilike, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { BrandingOverride } from "@/contracts/branding";
import type { DownloadQuality, ShareIndexSort, ShareMode } from "@/contracts/share";
import * as schema from "@/server/db/schema";
import {
  albums,
  photos,
  sharePhotos,
  shareRecipients,
  shares,
} from "@/server/db/schema";

/** Admin-side share row. `photoCount` is 0 when the share follows the whole album. */
export interface AdminShareRecord {
  id: string;
  albumId: string;
  slug: string;
  mode: ShareMode;
  expiresAt: Date | null;
  allowDownload: boolean;
  allowedQualities: DownloadQuality[];
  stripMetadata: boolean | null;
  branding: BrandingOverride | null;
  createdAt: Date;
  hasPassword: boolean;
  photoCount: number;
  recipientCount: number;
  visits: number;
  /** Raw aggregate value; Postgres returns timestamptz as text for `max()`. */
  lastVisitAt: string | null;
}

export interface AdminRecipientRecord {
  id: string;
  email: string;
  expiresAt: Date | null;
  usedAt: Date | null;
  createdAt: Date;
}

export interface AdminShareDetailRecord extends AdminShareRecord {
  /** null keeps the whole album. */
  photoIds: string[] | null;
  recipients: AdminRecipientRecord[];
}

/** One row of the cross-album organizer index. */
export interface AdminShareIndexRecord extends AdminShareRecord {
  albumTitle: string;
  albumSlug: string;
}

export interface ShareIndexFilter {
  mode?: ShareMode;
  expired?: boolean;
  search?: string;
  sort: ShareIndexSort;
  offset: number;
  limit: number;
}

export interface AdminShareIndexResult {
  rows: AdminShareIndexRecord[];
  total: number;
}

export interface CreateShareRecord {
  albumId: string;
  slug: string;
  mode: ShareMode;
  passwordHash: string | null;
  expiresAt: Date | null;
  allowDownload: boolean;
  allowedQualities: DownloadQuality[];
  stripMetadata: boolean | null;
  branding: BrandingOverride | null;
  photoIds: string[] | null;
}

export interface UpdateShareRecord {
  mode?: ShareMode;
  passwordHash?: string;
  expiresAt?: Date | null;
  allowDownload?: boolean;
  allowedQualities?: DownloadQuality[];
  stripMetadata?: boolean | null;
  branding?: BrandingOverride | null;
  photoIds?: string[] | null;
}

export interface OwnedShareRecord {
  albumId: string;
  slug: string;
  mode: ShareMode;
  hasPassword: boolean;
}

export interface ShareAdminRepository {
  albumOwnedBy(albumId: string, ownerUserId: string): Promise<boolean>;
  findOwnedShare(shareId: string, ownerUserId: string): Promise<OwnedShareRecord | null>;
  listByAlbum(albumId: string, ownerUserId: string): Promise<AdminShareRecord[]>;
  /** Every share the organizer owns, with album title and slug, filtered and paged. */
  listAll(ownerUserId: string, filter: ShareIndexFilter): Promise<AdminShareIndexResult>;
  findDetail(shareId: string, ownerUserId: string): Promise<AdminShareDetailRecord | null>;
  createShare(record: CreateShareRecord): Promise<string>;
  updateShare(shareId: string, patch: UpdateShareRecord): Promise<void>;
  deleteShare(shareId: string): Promise<void>;
  /** Returns the subset of ids that really belong to the album. */
  photoIdsInAlbum(albumId: string, photoIds: string[]): Promise<string[]>;
  listRecipients(shareId: string): Promise<AdminRecipientRecord[]>;
  /** Creates the recipient, or replaces the token when the email already exists. */
  upsertRecipient(
    shareId: string,
    email: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<AdminRecipientRecord>;
  replaceRecipientToken(
    shareId: string,
    recipientId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<AdminRecipientRecord | null>;
  removeRecipient(shareId: string, recipientId: string): Promise<void>;
}

type Database = NodePgDatabase<typeof schema>;

const shareColumns = {
  id: shares.id,
  albumId: shares.albumId,
  slug: shares.slug,
  mode: shares.mode,
  expiresAt: shares.expiresAt,
  allowDownload: shares.allowDownload,
  allowedQualities: shares.allowedQualities,
  stripMetadata: shares.stripMetadata,
  branding: shares.branding,
  createdAt: shares.createdAt,
  hasPassword: sql<boolean>`${shares.passwordHash} is not null`,
  photoCount:
    sql<number>`(select count(*) from share_photos sp where sp.share_id = ${shares.id})`.mapWith(
      Number,
    ),
  recipientCount:
    sql<number>`(select count(*) from share_recipients r where r.share_id = ${shares.id})`.mapWith(
      Number,
    ),
  visits:
    sql<number>`(select count(*) from view_events ve where ve.share_id = ${shares.id})`.mapWith(
      Number,
    ),
  lastVisitAt:
    sql<string | null>`(select max(ve.created_at) from view_events ve where ve.share_id = ${shares.id})`,
};

const recipientColumns = {
  id: shareRecipients.id,
  email: shareRecipients.email,
  expiresAt: shareRecipients.expiresAt,
  usedAt: shareRecipients.usedAt,
  createdAt: shareRecipients.createdAt,
};

export function createDrizzleShareAdminRepository(db: Database): ShareAdminRepository {
  async function listRecipients(shareId: string): Promise<AdminRecipientRecord[]> {
    return db
      .select(recipientColumns)
      .from(shareRecipients)
      .where(eq(shareRecipients.shareId, shareId))
      .orderBy(asc(shareRecipients.createdAt), asc(shareRecipients.email));
  }

  return {
    async albumOwnedBy(albumId, ownerUserId) {
      const [row] = await db
        .select({ id: albums.id })
        .from(albums)
        .where(and(eq(albums.id, albumId), eq(albums.ownerUserId, ownerUserId)))
        .limit(1);

      return Boolean(row);
    },

    async findOwnedShare(shareId, ownerUserId) {
      const [row] = await db
        .select({
          albumId: shares.albumId,
          slug: shares.slug,
          mode: shares.mode,
          hasPassword: sql<boolean>`${shares.passwordHash} is not null`,
        })
        .from(shares)
        .innerJoin(albums, eq(shares.albumId, albums.id))
        .where(and(eq(shares.id, shareId), eq(albums.ownerUserId, ownerUserId)))
        .limit(1);

      return row ?? null;
    },

    async listByAlbum(albumId, ownerUserId) {
      return db
        .select(shareColumns)
        .from(shares)
        .innerJoin(albums, eq(shares.albumId, albums.id))
        .where(and(eq(shares.albumId, albumId), eq(albums.ownerUserId, ownerUserId)))
        .orderBy(desc(shares.createdAt));
    },

    async listAll(ownerUserId, filter) {
      const conditions = [eq(albums.ownerUserId, ownerUserId)];

      if (filter.mode) {
        conditions.push(eq(shares.mode, filter.mode));
      }

      if (filter.expired === true) {
        conditions.push(and(isNotNull(shares.expiresAt), lte(shares.expiresAt, sql`now()`))!);
      } else if (filter.expired === false) {
        conditions.push(or(isNull(shares.expiresAt), gt(shares.expiresAt, sql`now()`))!);
      }

      const needle = filter.search?.trim();
      if (needle) {
        const pattern = `%${needle}%`;
        conditions.push(or(ilike(albums.title, pattern), ilike(albums.slug, pattern))!);
      }

      const where = and(...conditions);
      const order =
        filter.sort === "expiring"
          ? [sql`${shares.expiresAt} asc nulls last`, desc(shares.id)]
          : [desc(shares.createdAt), desc(shares.id)];

      const [rows, totalRow] = await Promise.all([
        db
          .select({
            ...shareColumns,
            albumTitle: albums.title,
            albumSlug: albums.slug,
          })
          .from(shares)
          .innerJoin(albums, eq(shares.albumId, albums.id))
          .where(where)
          .orderBy(...order)
          .limit(filter.limit)
          .offset(filter.offset),
        db
          .select({ value: sql<number>`count(*)`.mapWith(Number) })
          .from(shares)
          .innerJoin(albums, eq(shares.albumId, albums.id))
          .where(where),
      ]);

      return { rows, total: totalRow[0]?.value ?? 0 };
    },

    async findDetail(shareId, ownerUserId) {
      const [row] = await db
        .select(shareColumns)
        .from(shares)
        .innerJoin(albums, eq(shares.albumId, albums.id))
        .where(and(eq(shares.id, shareId), eq(albums.ownerUserId, ownerUserId)))
        .limit(1);

      if (!row) {
        return null;
      }

      const [photoRows, recipients] = await Promise.all([
        db
          .select({ id: sharePhotos.photoId })
          .from(sharePhotos)
          .where(eq(sharePhotos.shareId, shareId))
          .orderBy(asc(sharePhotos.photoId)),
        listRecipients(shareId),
      ]);

      return {
        ...row,
        // An empty subset means the share follows the whole album.
        photoIds: photoRows.length > 0 ? photoRows.map((photo) => photo.id) : null,
        recipients,
      };
    },

    async createShare(record) {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .insert(shares)
          .values({
            albumId: record.albumId,
            slug: record.slug,
            mode: record.mode,
            passwordHash: record.passwordHash,
            expiresAt: record.expiresAt,
            allowDownload: record.allowDownload,
            allowedQualities: record.allowedQualities,
            stripMetadata: record.stripMetadata,
            branding: record.branding,
          })
          .returning({ id: shares.id });

        if (record.photoIds && record.photoIds.length > 0) {
          await tx
            .insert(sharePhotos)
            .values(record.photoIds.map((photoId) => ({ shareId: row.id, photoId })));
        }

        return row.id;
      });
    },

    async updateShare(shareId, patch) {
      await db.transaction(async (tx) => {
        const values: Record<string, unknown> = { updatedAt: new Date() };
        if (patch.mode !== undefined) values.mode = patch.mode;
        if (patch.passwordHash !== undefined) values.passwordHash = patch.passwordHash;
        if (patch.expiresAt !== undefined) values.expiresAt = patch.expiresAt;
        if (patch.allowDownload !== undefined) values.allowDownload = patch.allowDownload;
        if (patch.allowedQualities !== undefined) {
          values.allowedQualities = patch.allowedQualities;
        }
        if (patch.stripMetadata !== undefined) values.stripMetadata = patch.stripMetadata;
        if (patch.branding !== undefined) values.branding = patch.branding;

        await tx.update(shares).set(values).where(eq(shares.id, shareId));

        if (patch.photoIds !== undefined) {
          await tx.delete(sharePhotos).where(eq(sharePhotos.shareId, shareId));
          if (patch.photoIds && patch.photoIds.length > 0) {
            await tx
              .insert(sharePhotos)
              .values(patch.photoIds.map((photoId) => ({ shareId, photoId })));
          }
        }
      });
    },

    async deleteShare(shareId) {
      await db.delete(shares).where(eq(shares.id, shareId));
    },

    async photoIdsInAlbum(albumId, photoIds) {
      if (photoIds.length === 0) {
        return [];
      }

      const rows = await db
        .select({ id: photos.id })
        .from(photos)
        .where(and(eq(photos.albumId, albumId), inArray(photos.id, photoIds)));

      return rows.map((row) => row.id);
    },

    listRecipients,

    async upsertRecipient(shareId, email, tokenHash, expiresAt) {
      const [row] = await db
        .insert(shareRecipients)
        .values({ shareId, email, tokenHash, expiresAt })
        .onConflictDoUpdate({
          target: [shareRecipients.shareId, shareRecipients.email],
          set: { tokenHash, expiresAt, usedAt: null, updatedAt: new Date() },
        })
        .returning(recipientColumns);

      return row;
    },

    async replaceRecipientToken(shareId, recipientId, tokenHash, expiresAt) {
      const [row] = await db
        .update(shareRecipients)
        .set({ tokenHash, expiresAt, usedAt: null, updatedAt: new Date() })
        .where(
          and(eq(shareRecipients.id, recipientId), eq(shareRecipients.shareId, shareId)),
        )
        .returning(recipientColumns);

      return row ?? null;
    },

    async removeRecipient(shareId, recipientId) {
      await db
        .delete(shareRecipients)
        .where(
          and(eq(shareRecipients.id, recipientId), eq(shareRecipients.shareId, shareId)),
        );
    },
  };
}
