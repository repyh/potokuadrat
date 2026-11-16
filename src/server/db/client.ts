import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Client, Pool } from "pg";
import * as schema from "@/server/db/schema";

let pool: Pool | undefined;

function connectionString(): string {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error("DATABASE_URL is required to access the database.");
  }
  return value;
}

function getPool(): Pool {
  pool ??= new Pool({ connectionString: connectionString() });
  return pool;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}

const PING_TIMEOUT_MS = 2_000;

/**
 * Checks Postgres on a short-lived connection with hard timeouts. A pooled query is not
 * enough for a health probe: `pg` waits forever for a connection by default, and a host
 * that blackholes packets or a server that accepts and never answers pins that client
 * for the length of the OS TCP timeout. Here both the connect and the read are bounded.
 *
 * The connection is deliberately outside the pool: a probe should not compete with
 * request traffic, and it must still answer when the pool itself is wedged.
 */
export async function pingDatabase(timeoutMs: number = PING_TIMEOUT_MS): Promise<void> {
  const client = new Client({
    connectionString: connectionString(),
    connectionTimeoutMillis: timeoutMs,
    query_timeout: timeoutMs,
  });

  try {
    await client.connect();
    await client.query("select 1");
  } finally {
    await client.end().catch(() => {});
  }
}

/** Closes the pool; for tests and one-off scripts only. */
export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
}
