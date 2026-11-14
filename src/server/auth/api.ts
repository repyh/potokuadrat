import "server-only";

import { getSession, type AppSession } from "./session";

export async function getAdminSession(): Promise<AppSession | null> {
  const session = await getSession();
  return session?.user.role === "admin" ? session : null;
}

export function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status });
}
