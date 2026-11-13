import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { BrandingOverride } from "@/contracts/branding";

import { users } from "./auth";
import { driveFolders } from "./drive";
import { albumStatus } from "./enums";

export const albums = pgTable(
  "albums",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    status: albumStatus("status").default("indexing").notNull(),
    // Deliberately not a foreign key: photos also point at albums, and the cover is
    // validated by the application when it is set.
    coverPhotoId: uuid("cover_photo_id"),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    branding: jsonb("branding").$type<BrandingOverride>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("albums_slug_unique").on(table.slug),
    index("albums_owner_user_id_idx").on(table.ownerUserId),
  ],
);

export const albumFolders = pgTable(
  "album_folders",
  {
    albumId: uuid("album_id")
      .notNull()
      .references(() => albums.id, { onDelete: "cascade" }),
    driveFolderId: uuid("drive_folder_id")
      .notNull()
      .references(() => driveFolders.id, { onDelete: "cascade" }),
    position: integer("position").default(0).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.albumId, table.driveFolderId] }),
    index("album_folders_drive_folder_id_idx").on(table.driveFolderId),
  ],
);
