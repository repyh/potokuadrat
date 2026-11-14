import "server-only";

import { PgBoss } from "pg-boss";

let bossPromise: Promise<PgBoss> | null = null;

/**
 * One pg-boss instance per process. It creates its own `pgboss` schema on first start,
 * which is why the connection must be a direct Postgres connection, not a pooler.
 */
export function getBoss(): Promise<PgBoss> {
  if (!bossPromise) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is required to run background jobs.");
    }

    const boss = new PgBoss({ connectionString, schema: "pgboss" });
    const started = boss.start();
    bossPromise = started;
    return started;
  }

  return bossPromise;
}
