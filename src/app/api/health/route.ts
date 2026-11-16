import { sql } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/server/db/client";

/**
 * Liveness and readiness in one endpoint, for a container orchestrator or a load
 * balancer. It answers 200 only when the process can reach Postgres, because a web
 * process that cannot query the database will fail every real request anyway.
 *
 * `connection()` replaces `export const dynamic = "force-dynamic"`: this app runs
 * `cacheComponents: true`, which rejects route segment configs (the build fails with
 * "Route segment config \"dynamic\" is not compatible with nextConfig.cacheComponents").
 * Awaiting it marks the route as request-time, which is what a health probe needs.
 *
 * The body is deliberately small and never echoes the error: a health endpoint is
 * usually reachable without authentication, so it must not leak connection strings,
 * hostnames, or driver messages.
 */
export async function GET(): Promise<Response> {
  await connection();

  try {
    await getDb().execute(sql`select 1`);
  } catch {
    return Response.json(
      { status: "unavailable", database: "down" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  return Response.json(
    { status: "ok", database: "up" },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
