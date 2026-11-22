import type { Metadata } from "next";
import Link from "next/link";

import { Alert, EmptyState } from "@/components/ui";
import { RecentAlbumsTable } from "@/features/admin/recent-albums-table";
import { formatCount, formatRelative } from "@/features/admin/format";
import { getAlbumService } from "@/server/albums/runtime";
import { requireAdmin } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { organizations } from "@/server/db/schema";
import { checkDriveStatus } from "@/server/drive/status";

export const metadata: Metadata = {
  title: "Overview — Potokuadrat",
};

export default async function AdminPage() {
  const session = await requireAdmin();
  const db = getDb();

  const [[organization], albums, stats, drive] = await Promise.all([
    db
      .select({ name: organizations.name, title: organizations.title })
      .from(organizations)
      .limit(1),
    getAlbumService().list(session.user.id),
    getAlbumService().stats(session.user.id),
    checkDriveStatus(),
  ]);

  const now = new Date().getTime();
  const recent = albums.slice(0, 5);

  const driveClass =
    drive.state === "reachable" ? "" : drive.state === "failing" ? "is-failing" : "is-idle";
  const driveLabel =
    drive.state === "reachable"
      ? `Drive connected · ${formatCount(drive.folderCount ?? 0)} folders visible`
      : drive.message;

  return (
    <section className="admin-page" aria-labelledby="admin-heading">
      <header className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Organizer</p>
          <h1 id="admin-heading">
            {organization?.title ?? organization?.name ?? "Potokuadrat"}
          </h1>
          <p className="auth-lede">Signed in as {session.user.email}.</p>
        </div>

        <Link href="/admin/albums/new" className="ui-btn ui-btn-primary ui-btn-md">
          <span className="ui-btn-label">New album</span>
          <span className="ui-btn-icon" aria-hidden="true">
            →
          </span>
        </Link>
      </header>

      {!organization && (
        <Alert tone="warning" title="Organization missing">
          No organization row exists. Re-run setup to finish the installation.
        </Alert>
      )}

      <div className="admin-metrics">
        <article className="admin-metric">
          <span className="admin-metric-label">Albums</span>
          <strong className="admin-metric-value">{formatCount(stats.albumCount)}</strong>
          <span className="admin-metric-note">
            {stats.indexingAlbumCount > 0
              ? `${formatCount(stats.indexingAlbumCount)} indexing`
              : "All indexed"}
          </span>
        </article>

        <article className="admin-metric">
          <span className="admin-metric-label">Shares</span>
          <strong className="admin-metric-value">{formatCount(stats.shareCount)}</strong>
          <span className="admin-metric-note">
            {stats.expiringShareCount > 0
              ? `${formatCount(stats.expiringShareCount)} expiring soon`
              : "None expiring"}
          </span>
        </article>

        <article className="admin-metric">
          <span className="admin-metric-label">Photos indexed</span>
          <strong className="admin-metric-value">
            {formatCount(stats.indexedPhotoCount)}
          </strong>
          <span className="admin-metric-note">
            {stats.failedPhotoCount > 0
              ? `${formatCount(stats.failedPhotoCount)} failed`
              : "0 failed"}
          </span>
        </article>
      </div>

      <div className={`admin-drive-band ${driveClass}`.trim()}>
        <span>
          <span className="admin-drive-dot" aria-hidden="true" />
          {driveLabel}
        </span>
        <span className="admin-drive-meta">
          {stats.lastIndexedAt
            ? `Last re-index ${formatRelative(stats.lastIndexedAt, now)}`
            : "Never indexed"}
        </span>
      </div>

      <section className="admin-recent" aria-labelledby="recent-albums-heading">
        <div className="admin-recent-head">
          <h2 id="recent-albums-heading">Recent albums</h2>
          <Link href="/admin/albums" className="admin-metric-link">
            All albums →
          </Link>
        </div>

        {recent.length === 0 ? (
          <EmptyState
            title="No albums yet"
            description="Create the first album, then pick the Drive folders to index."
            action={
              <Link href="/admin/albums/new" className="ui-btn ui-btn-primary ui-btn-md">
                <span className="ui-btn-label">New album</span>
                <span className="ui-btn-icon" aria-hidden="true">
                  →
                </span>
              </Link>
            }
          />
        ) : (
          <RecentAlbumsTable albums={recent} now={now} />
        )}
      </section>
    </section>
  );
}
