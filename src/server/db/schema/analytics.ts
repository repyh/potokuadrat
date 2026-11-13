import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { downloadQuality } from "./enums";
import { photos } from "./photos";
import { shares } from "./shares";

export const viewEvents = pgTable(
  "view_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shareId: uuid("share_id")
      .notNull()
      .references(() => shares.id, { onDelete: "cascade" }),
    photoId: uuid("photo_id").references(() => photos.id, { onDelete: "set null" }),
    // Hash of IP and day, never the raw address.
    visitorHash: text("visitor_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("view_events_share_created_idx").on(table.shareId, table.createdAt)],
);

export const downloadEvents = pgTable(
  "download_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shareId: uuid("share_id")
      .notNull()
      .references(() => shares.id, { onDelete: "cascade" }),
    photoId: uuid("photo_id").references(() => photos.id, { onDelete: "set null" }),
    quality: downloadQuality("quality").notNull(),
    visitorHash: text("visitor_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("download_events_share_created_idx").on(table.shareId, table.createdAt),
  ],
);
