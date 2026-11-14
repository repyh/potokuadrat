import type { Metadata } from "next";
import { count } from "drizzle-orm";

import { Alert } from "@/components/ui";
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

      <div className="admin-grid">
        <article className="admin-card">
          <h2>Albums</h2>
          <p>
            {Number(albumCount?.value ?? 0) === 0
              ? "No albums yet. Album creation arrives with the indexing phase."
              : `${albumCount?.value} albums.`}
          </p>
        </article>

        <article className="admin-card">
          <h2>Shares</h2>
          <p>
            {Number(shareCount?.value ?? 0) === 0
              ? "No share links yet. Every album can have several."
              : `${shareCount?.value} share links.`}
          </p>
        </article>

        <article className="admin-card">
          <h2>Drive</h2>
          <p>
            Service-account reads are configured through{" "}
            <code>GOOGLE_DRIVE_KEY_FILE</code>. Folders must be shared with that
            account.
          </p>
        </article>
      </div>
    </section>
  );
}
