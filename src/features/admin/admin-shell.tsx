"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui";

export interface AdminShellProps {
  organizationName: string;
  userName: string;
  userEmail: string;
  signOutAction: () => Promise<void>;
  children: ReactNode;
}

const NAV_ITEMS = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/albums", label: "Albums", exact: false },
  { href: "/admin/shares", label: "Shares", exact: false },
  { href: "/admin/settings", label: "Settings", exact: false },
] as const;

export function AdminShell({
  organizationName,
  userName,
  userEmail,
  signOutAction,
  children,
}: AdminShellProps) {
  const pathname = usePathname();
  const initial = organizationName.trim().charAt(0).toUpperCase() || "P";

  return (
    <div className="admin-shell">
      <aside className="admin-spine" aria-label="Organizer navigation">
        <div className="admin-spine-top">
          <Link href="/admin" className="admin-spine-brand">
            <span className="brand-stamp" aria-hidden="true">
              {initial}
            </span>
            <span className="admin-spine-org">{organizationName}</span>
          </Link>

          <nav className="admin-spine-nav" aria-label="Admin sections">
            {NAV_ITEMS.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`admin-spine-link ${isActive ? "is-active" : ""}`.trim()}
                >
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="admin-spine-foot">
          <div className="admin-spine-user">
            <strong className="admin-spine-username">{userName}</strong>
            <span className="admin-spine-email">{userEmail}</span>
          </div>

          <form action={signOutAction}>
            <Button type="submit" variant="secondary" size="sm" className="admin-signout-btn">
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-workspace">{children}</div>
      </main>
    </div>
  );
}
