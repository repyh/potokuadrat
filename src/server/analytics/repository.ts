import "server-only";

import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@/server/db/schema";
import { viewEvents } from "@/server/db/schema";

export interface ViewEventRecord {
  shareId: string;
  /** Hash of address and day; the raw address is never stored. */
  visitorHash: string;
  at: Date;
}

export interface ViewEventRepository {
  record(event: ViewEventRecord): Promise<void>;
}

export function createDrizzleViewEventRepository(
  db: NodePgDatabase<typeof schema>,
): ViewEventRepository {
  return {
    async record({ shareId, visitorHash, at }) {
      await db.insert(viewEvents).values({ shareId, visitorHash, createdAt: at });
    },
  };
}
