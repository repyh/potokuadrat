import type { Metadata } from "next";
import Link from "next/link";
import { count } from "drizzle-orm";

import { Alert } from "@/components/ui";
import { NoAlbumsEmptyState } from "@/features/states";
import { requireAdmin } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { albums, organizations, shares } from "@/server/db/schema";

export const metadata: Metadata = {
  title: "Organizer — Potokuadrat",
};

export default async function AdminPage() {
  const session = await requireAdmin();
  const db = getDb();

  const [organization] = await db
    .select({ name: organizations.name, title: organizations.title })
    .from(organizations)
    .limit(1);

  const [albumCount] = await db.select({ value: count() }).from(albums);
  const [shareCount] = await db.select({ value: count() }).from(shares);

  const numAlbums = Number(albumCount?.value ?? 0);
  const numShares = Number(shareCount?.value ?? 0);

  return (
    <section className="admin-section" aria-labelledby="admin-heading">
      <p className="hero-eyebrow">Organizer</p>
      <h1 id="admin-heading">{organization?.title ?? organization?.name ?? "Potokuadrat"}</h1>
      <p className="auth-lede">
        Signed in as {session.user.email}. Drive connection, albums, and shares are
        wired up next.
      </p>

      {!organization && (
        <Alert tone="warning" title="Organization missing">
          No organization row exists. Re-run setup to finish the installation.
        </Alert>
      )}

      <div className="admin-grid mb-8">
        <article className="admin-card">
          <h2>Albums</h2>
          <p>
            {numAlbums === 0
              ? "No albums yet. Link a Drive folder to index photographs."
              : `${numAlbums} active ${numAlbums === 1 ? "album" : "albums"}.`}
          </p>
          <div className="mt-4">
            <Link
              href="/admin/albums"
              className="text-xs font-bold text-[var(--ink)] hover:text-[var(--accent)] underline"
            >
              Browse albums →
            </Link>
          </div>
        </article>

        <article className="admin-card">
          <h2>Shares</h2>
          <p>
            {numShares === 0
              ? "No share links yet. Every album can have several."
              : `${numShares} active ${numShares === 1 ? "share" : "shares"}.`}
          </p>
          <div className="mt-4">
            <Link
              href="/admin/shares"
              className="text-xs font-bold text-[var(--ink)] hover:text-[var(--accent)] underline"
            >
              Manage shares →
            </Link>
          </div>
        </article>

        <article className="admin-card">
          <h2>Drive</h2>
          <p>
            Service-account reads are configured through{" "}
            <code>GOOGLE_DRIVE_KEY_FILE</code>. Folders must be shared with that
            account.
          </p>
          <div className="mt-4">
            <Link
              href="/admin/settings"
              className="text-xs font-bold text-[var(--ink)] hover:text-[var(--accent)] underline"
            >
              View Drive status →
            </Link>
          </div>
        </article>
      </div>

      {numAlbums === 0 && (
        <div className="mt-8 border-t border-[var(--line)] pt-8">
          <NoAlbumsEmptyState />
        </div>
      )}
    </section>
  );
}
