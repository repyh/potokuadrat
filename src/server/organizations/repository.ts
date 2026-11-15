import "server-only";

import { eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@/server/db/schema";
import { organizations } from "@/server/db/schema";

export interface OrganizationRecord {
  id: string;
  name: string;
  title: string | null;
  logo: string | null;
  accent: string | null;
  footerEnabled: boolean;
  stripMetadata: boolean;
  updatedAt: Date;
}

export interface OrganizationUpdate {
  name: string;
  title?: string | null;
  logo?: string | null;
  accent?: string | null;
  footerEnabled?: boolean;
  stripMetadata?: boolean;
}

export interface OrganizationRepository {
  get(): Promise<OrganizationRecord | null>;
  /** Returns the organization row, creating the default one when it is missing. */
  ensure(name?: string): Promise<OrganizationRecord>;
  update(patch: OrganizationUpdate): Promise<OrganizationRecord>;
}

type Database = NodePgDatabase<typeof schema>;

const columns = {
  id: organizations.id,
  name: organizations.name,
  title: organizations.title,
  logo: organizations.logo,
  accent: organizations.accent,
  footerEnabled: organizations.footerEnabled,
  stripMetadata: organizations.stripMetadata,
  updatedAt: organizations.updatedAt,
};

/** One installation has one organization; the lock keeps two setup requests apart. */
const SINGLETON_LOCK = 741_001;

export function createDrizzleOrganizationRepository(db: Database): OrganizationRepository {
  return {
    async get() {
      const [row] = await db.select(columns).from(organizations).limit(1);
      return row ?? null;
    },

    async ensure(name = "Potokuadrat") {
      return db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(${SINGLETON_LOCK})`);

        const [existing] = await tx.select(columns).from(organizations).limit(1);
        if (existing) {
          return existing;
        }

        const [created] = await tx.insert(organizations).values({ name }).returning(columns);
        return created;
      });
    },

    async update(patch) {
      return db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(${SINGLETON_LOCK})`);

        const [existing] = await tx.select(columns).from(organizations).limit(1);
        if (!existing) {
          const [created] = await tx.insert(organizations).values(patch).returning(columns);
          return created;
        }

        const [updated] = await tx
          .update(organizations)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(organizations.id, existing.id))
          .returning(columns);

        return updated;
      });
    },
  };
}
