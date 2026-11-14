import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { requireAdmin } from "@/server/auth/session";

import { signOutAction } from "./actions";

export const instant = false;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Auth-gated: skip prerendering entirely and resolve the session per request.
  await connection();
  const session = await requireAdmin();

  return (
    <main className="folio-frame">
      <header className="site-navbar">
        <div className="navbar-inner">
          <Link className="navbar-brand" href="/admin" aria-label="Potokuadrat admin">
            <span className="brand-stamp" aria-hidden="true">
              P
            </span>
            <span>Potokuadrat</span>
          </Link>

          <div className="navbar-actions">
            <span className="navbar-user">{session.user.name}</span>
            <form action={signOutAction}>
              <button type="submit" className="navbar-login-btn">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="folio-page">{children}</div>
    </main>
  );
}
