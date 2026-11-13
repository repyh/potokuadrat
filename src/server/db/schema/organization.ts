import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * One organization per installation. The branding values here are the defaults for
 * every share; a share may override them.
 */
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  title: text("title"),
  logo: text("logo"),
  accent: text("accent"),
  footerEnabled: boolean("footer_enabled").default(true).notNull(),
  stripMetadata: boolean("strip_metadata").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
