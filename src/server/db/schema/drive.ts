import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";

export const driveFolders = pgTable(
  "drive_folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    driveFolderId: text("drive_folder_id").notNull(),
    name: text("name").notNull(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    // Recursive listing is on by default and can be turned off per folder.
    recursive: boolean("recursive").default(true).notNull(),
    // Last successful listing; incremental runs request only newer files.
    lastIndexedAt: timestamp("last_indexed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("drive_folders_drive_folder_id_unique").on(table.driveFolderId),
    index("drive_folders_owner_user_id_idx").on(table.ownerUserId),
  ],
);
