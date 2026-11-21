import { connection } from "next/server";
import type { ReactNode } from "react";

import { AdminShell } from "@/features/admin/admin-shell";
import { requireAdmin } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { organizations } from "@/server/db/schema";

import { signOutAction } from "./actions";

export const instant = false;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Auth-gated: skip prerendering entirely and resolve the session per request.
  await connection();
  const session = await requireAdmin();

  const [organization] = await getDb()
    .select({ name: organizations.name, title: organizations.title })
    .from(organizations)
    .limit(1);

  const organizationName =
    organization?.title?.trim() || organization?.name?.trim() || "Potokuadrat";

  return (
    <AdminShell
      organizationName={organizationName}
      userName={session.user.name}
      userEmail={session.user.email}
      signOutAction={signOutAction}
    >
      {children}
    </AdminShell>
  );
}
