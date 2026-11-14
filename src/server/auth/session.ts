import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth } from "./auth";

export type AppRole = "admin" | "member";

export interface AppSession {
  user: {
    id: string;
    name: string;
    email: string;
    role: AppRole;
  };
  session: {
    id: string;
    expiresAt: Date;
  };
}

export async function getSession(): Promise<AppSession | null> {
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });

  if (!session) {
    return null;
  }

  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: (session.user as { role?: string }).role === "admin" ? "admin" : "member",
    },
    session: {
      id: session.session.id,
      expiresAt: session.session.expiresAt,
    },
  };
}

export async function requireUser(): Promise<AppSession> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function requireAdmin(): Promise<AppSession> {
  const session = await requireUser();
  if (session.user.role !== "admin") {
    redirect("/login");
  }
  return session;
}
