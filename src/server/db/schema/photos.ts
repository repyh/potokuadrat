import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { albums } from "./albums";
import { thumbStatus } from "./enums";

export const photos = pgTable(
  "photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    albumId: uuid("album_id")
      .notNull()
      .references(() => albums.id, { onDelete: "cascade" }),
    driveFileId: text("drive_file_id").notNull(),
    name: text("name").notNull(),
    mimeType: text("mime_type"),
    width: integer("width"),
    height: integer("height"),
    bytes: bigint("bytes", { mode: "number" }),
    takenAt: timestamp("taken_at", { withTimezone: true }),
    driveModifiedAt: timestamp("drive_modified_at", { withTimezone: true }),
    exif: jsonb("exif").$type<Record<string, unknown>>(),
    sortIndex: integer("sort_index").default(0).notNull(),
    thumbStatus: thumbStatus("thumb_status").default("pending").notNull(),
    // Set on re-index when the file disappears from Drive. The row is kept so
    // favorites and download history stay valid; the photo is hidden from clients.
    missingAt: timestamp("missing_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("photos_album_drive_file_id_unique").on(table.albumId, table.driveFileId),
    index("photos_album_sort_index_idx").on(table.albumId, table.sortIndex),
  ],
);
