import "server-only";

import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { BrandingOverride } from "@/contracts/branding";
import type { DownloadQuality, ShareMode } from "@/contracts/share";
import * as schema from "@/server/db/schema";
import {
  albums,
  clientSessions,
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
  /** Atomically marks a magic-link token as used. */
  consumeRecipient(shareId: string, tokenHash: string): Promise<RecipientRecord | null>;
  createClientSession(
    shareId: string,
    email: string,
    expiresAt: Date,
  ): Promise<ClientSessionRecord>;
  findClientSession(shareId: string, sessionId: string): Promise<ClientSessionRecord | null>;
}

type Database = NodePgDatabase<typeof schema>;

export function createDrizzleShareRepository(db: Database): ShareRepository {
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
        .where(
          and(
            eq(photos.id, photoId),
            eq(photos.albumId, share.albumId),
            isNull(photos.missingAt),
            // An empty share_photos set means the whole album follows re-indexing.
            sql`(
              not exists (select 1 from share_photos sp where sp.share_id = ${share.id})
              or exists (
                select 1 from share_photos sp
                where sp.share_id = ${share.id} and sp.photo_id = ${photos.id}
              )
            )`,
          ),
        )
        .limit(1);

      return row ?? null;
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
  };
}
