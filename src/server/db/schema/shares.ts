import {
  boolean,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { BrandingOverride } from "@/contracts/branding";

import { albums } from "./albums";
import { downloadQuality, shareMode } from "./enums";
import { photos } from "./photos";

export const shares = pgTable(
  "shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    albumId: uuid("album_id")
      .notNull()
      .references(() => albums.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    mode: shareMode("mode").default("public").notNull(),
    passwordHash: text("password_hash"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    allowDownload: boolean("allow_download").default(true).notNull(),
    allowedQualities: downloadQuality("allowed_qualities")
      .array()
      .default(["original", "web"])
      .notNull(),
    branding: jsonb("branding").$type<BrandingOverride>(),
    // null means "inherit the organization setting".
    stripMetadata: boolean("strip_metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shares_slug_unique").on(table.slug),
    index("shares_album_id_idx").on(table.albumId),
  ],
);

/**
 * A frozen photo subset. An empty set of rows means the share covers the whole album
 * and follows re-indexing; once rows exist, new photos are not added automatically.
 */
export const sharePhotos = pgTable(
  "share_photos",
  {
    shareId: uuid("share_id")
      .notNull()
      .references(() => shares.id, { onDelete: "cascade" }),
    photoId: uuid("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.shareId, table.photoId] }),
    index("share_photos_photo_id_idx").on(table.photoId),
  ],
);

export const shareRecipients = pgTable(
  "share_recipients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shareId: uuid("share_id")
      .notNull()
      .references(() => shares.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    // null keeps the development seed link usable; issued links get a short expiry.
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("share_recipients_share_email_unique").on(table.shareId, table.email),
    uniqueIndex("share_recipients_token_hash_unique").on(table.tokenHash),
  ],
);

/**
 * A magic-link client session. Password shares use a signed cookie instead and do not
 * create a row here; anonymous public favorites stay in localStorage.
 */
export const clientSessions = pgTable(
  "client_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shareId: uuid("share_id")
      .notNull()
      .references(() => shares.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("client_sessions_share_id_idx").on(table.shareId),
    index("client_sessions_email_idx").on(table.email),
  ],
);

export const favorites = pgTable(
  "favorites",
  {
    clientSessionId: uuid("client_session_id")
      .notNull()
      .references(() => clientSessions.id, { onDelete: "cascade" }),
    photoId: uuid("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.clientSessionId, table.photoId] }),
    index("favorites_photo_id_idx").on(table.photoId),
  ],
);
