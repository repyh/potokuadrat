import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { DownloadQuality, ShareMode } from "@/contracts/share";
import * as schema from "@/server/db/schema";
import { albums, photos, shares } from "@/server/db/schema";

export interface ShareRecord {
  id: string;
  slug: string;
  mode: ShareMode;
  expiresAt: Date | null;
  allowDownload: boolean;
  allowedQualities: DownloadQuality[];
  stripMetadata: boolean | null;
  albumId: string;
  albumTitle: string;
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

export interface ShareRepository {
  findBySlug(slug: string): Promise<ShareRecord | null>;
  /** Returns the photo only when it belongs to the share's album and still exists. */
  getSharePhoto(share: ShareRecord, photoId: string): Promise<SharePhotoRecord | null>;
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
          expiresAt: shares.expiresAt,
          allowDownload: shares.allowDownload,
          allowedQualities: shares.allowedQualities,
          stripMetadata: shares.stripMetadata,
          albumId: shares.albumId,
          albumTitle: albums.title,
          organizationStripMetadata:
            sql<boolean | null>`(select strip_metadata from organizations limit 1)`,
        })
        .from(shares)
        .innerJoin(albums, eq(shares.albumId, albums.id))
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
  };
}
