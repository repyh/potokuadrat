import type { Metadata } from "next";
import Link from "next/link";

import { Alert } from "@/components/ui";
import { RecentAlbumsList } from "@/features/admin/recent-albums-list";
import { getAlbumService } from "@/server/albums/runtime";
import { requireAdmin } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { organizations } from "@/server/db/schema";

export const metadata: Metadata = {
  title: "Overview — Potokuadrat",
};

export default async function AdminPage() {
  const session = await requireAdmin();
  const db = getDb();

  const [[organization], albums] = await Promise.all([
    db
      .select({ name: organizations.name, title: organizations.title })
      .from(organizations)
      .limit(1),
    getAlbumService().list(session.user.id),
  ]);

  return (
    <section className="admin-page" aria-labelledby="admin-heading">
      <header className="admin-page-header">
        <div>
          <h1 id="admin-heading">
            {organization?.title ?? organization?.name ?? "Potokuadrat"}
          </h1>
          <p className="auth-lede">
            Signed in as {session.user.email}.
          </p>
        </div>
      </header>

      {!organization && (
        <Alert tone="warning" title="Organization missing">
          No organization row exists. Re-run setup to finish the installation.
        </Alert>
      )}

      <section className="admin-recent" aria-labelledby="recent-albums-heading">
        <div className="admin-recent-head">
          <h2 id="recent-albums-heading">Recent albums</h2>
          <Link href="/admin/albums" className="admin-metric-link">
            All albums →
          </Link>
        </div>

        {albums.length === 0 ? (
          <p className="admin-empty-copy">
            No albums yet. Create one from the Albums view once a Drive folder is shared.
          </p>
        ) : (
          <RecentAlbumsList albums={albums.slice(0, 5)} />
        )}
      </section>
    </section>
  );
}
