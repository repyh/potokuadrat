import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/server/db/schema";

let pool: Pool | undefined;

function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to access the database.");
  }

  pool ??= new Pool({ connectionString });
  return pool;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}

/** Closes the pool; for tests and one-off scripts only. */
export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
}
