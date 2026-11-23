"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { DownloadQuality, ShareIndexPage } from "@/contracts/share";
import { Alert, DataTable, EmptyState, Input } from "@/components/ui";

import { formatCount, formatDay } from "./format";
import { shareIndexHref, type ShareIndexUrlState } from "./share-index-query";
import { ShareRevokeDialog } from "./share-revoke-dialog";

export interface SharesViewProps {
  page: ShareIndexPage;
  state: ShareIndexUrlState;
  /** Server timestamp so expiry labels match between SSR and hydration. */
  now: number;
}

const MODE_FILTERS: Array<{ label: string; patch: Partial<ShareIndexUrlState>; isActive: (s: ShareIndexUrlState) => boolean }> = [
  {
    label: "All",
    patch: { mode: null, expired: null, page: 1 },
    isActive: (s) => s.mode === null && s.expired === null,
  },
  {
    label: "Public",
    patch: { mode: "public", expired: null, page: 1 },
    isActive: (s) => s.mode === "public" && s.expired === null,
  },
  {
    label: "Password",
    patch: { mode: "password", expired: null, page: 1 },
    isActive: (s) => s.mode === "password" && s.expired === null,
  },
  {
    label: "Magic link",
    patch: { mode: "magic_link", expired: null, page: 1 },
    isActive: (s) => s.mode === "magic_link" && s.expired === null,
  },
  {
    label: "Expired",
    patch: { mode: null, expired: true, page: 1 },
    isActive: (s) => s.expired === true,
  },
];

const MODE_LABEL: Record<"public" | "password" | "magic_link", string> = {
  public: "Public",
  password: "Password",
  magic_link: "Magic link",
};

const QUALITY_LABEL: Record<DownloadQuality, string> = {
  original: "Original",
  web: "Web 2048",
};

export function SharesView({ page, state, now }: SharesViewProps) {
  const router = useRouter();
  const [revokeTarget, setRevokeTarget] = useState<ShareIndexPage["shares"][number] | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "danger"; message: string } | null>(
    null,
  );
  const [copied, setCopied] = useState<string | null>(null);

  const copyLink = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/s/${slug}`);
      setCopied(slug);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setFeedback({ tone: "danger", message: "Clipboard access was blocked by this browser." });
    }
  };

  const start = page.total === 0 ? 0 : (page.page - 1) * page.limit + 1;
  const end = Math.min(start + page.shares.length - 1, page.total);
  const hasPrev = page.page > 1;
  const hasNext = end < page.total;

  const expiryLabel = (iso: string | null): string => {
    if (!iso) {
      return "Never";
    }
    return new Date(iso).getTime() <= now ? `Expired ${formatDay(iso)}` : formatDay(iso);
  };

  return (
    <section className="admin-page" aria-labelledby="shares-heading">
      <header className="admin-page-header">
        <div>
          <div className="admin-page-title">
            <h1 id="shares-heading">Shares</h1>
            <span className="admin-page-sub">{formatCount(page.total)}</span>
          </div>
          <p className="auth-lede">Every share link across your albums.</p>
        </div>
        <Link href="/admin/albums" className="ui-btn ui-btn-secondary ui-btn-md">
          <span className="ui-btn-label">Open an album</span>
        </Link>
      </header>

      {feedback && (
        <Alert tone={feedback.tone} title={feedback.tone === "success" ? "Done" : "Something failed"} onDismiss={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}

      <form action="/admin/shares" method="get" className="admin-toolbar">
        {state.mode && <input type="hidden" name="mode" value={state.mode} />}
        {state.expired !== null && (
          <input type="hidden" name="expired" value={state.expired ? "1" : "0"} />
        )}
        {state.sort !== "newest" && <input type="hidden" name="sort" value={state.sort} />}

        <Input
          type="search"
          name="search"
          className="admin-search"
          aria-label="Search by album"
          placeholder="Search album or slug"
          defaultValue={state.search}
        />
        <button type="submit" className="ui-btn ui-btn-secondary ui-btn-sm">
          <span className="ui-btn-label">Search</span>
        </button>

        <div className="admin-chips" role="group" aria-label="Filter shares">
          {MODE_FILTERS.map((filter) => {
            const active = filter.isActive(state);
            return (
              <Link
                key={filter.label}
                href={shareIndexHref(state, filter.patch)}
                aria-current={active ? "true" : undefined}
                className={`admin-chip ${active ? "is-active" : ""}`.trim()}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>

        <div className="admin-chips admin-sort" role="group" aria-label="Sort shares">
          <Link
            href={shareIndexHref(state, { sort: "newest", page: 1 })}
            aria-current={state.sort === "newest" ? "true" : undefined}
            className={`admin-chip ${state.sort === "newest" ? "is-active" : ""}`.trim()}
          >
            Newest
          </Link>
          <Link
            href={shareIndexHref(state, { sort: "expiring", page: 1 })}
            aria-current={state.sort === "expiring" ? "true" : undefined}
            className={`admin-chip ${state.sort === "expiring" ? "is-active" : ""}`.trim()}
          >
            Expiring
          </Link>
        </div>
      </form>

      {page.shares.length === 0 ? (
        page.total > 0 ? (
          <EmptyState
            title="This page is empty"
            description="The list got shorter. Go back to the first page."
            action={
              <Link href={shareIndexHref(state, { page: 1 })} className="ui-btn ui-btn-secondary ui-btn-sm">
                <span className="ui-btn-label">First page</span>
              </Link>
            }
          />
        ) : state.search || state.mode || state.expired !== null ? (
          <EmptyState
            title="No shares match"
            description="Try a different album, mode, or expiry filter."
            action={
              <Link href="/admin/shares" className="ui-btn ui-btn-secondary ui-btn-sm">
                <span className="ui-btn-label">Clear filters</span>
              </Link>
            }
          />
        ) : (
          <EmptyState
            title="No shares yet"
            description="Shares are the access unit; create one from any album."
            action={
              <Link href="/admin/albums" className="ui-btn ui-btn-primary ui-btn-sm">
                <span className="ui-btn-label">Open albums</span>
              </Link>
            }
          />
        )
      ) : (
        <DataTable
          rowKeyField="id"
          columns={[
            { key: "album", header: "Album + link" },
            { key: "mode", header: "Mode" },
            { key: "expires", header: "Expires" },
            { key: "downloads", header: "Downloads" },
            { key: "visits", header: "Visits", numeric: true },
            { key: "actions", header: "Actions", numeric: true },
          ]}
          rows={page.shares.map((share) => ({
            id: share.id,
            album: (
              <span className="admin-table-primary">
                <strong>{share.albumTitle}</strong>
                <span className="admin-table-sub">/s/{share.slug}</span>
              </span>
            ),
            mode: MODE_LABEL[share.mode],
            expires: (
              <span className="tabular-nums">{expiryLabel(share.expiresAt)}</span>
            ),
            downloads: share.allowDownload
              ? share.allowedQualities.map((quality) => QUALITY_LABEL[quality]).join(" + ")
              : "Disabled",
            visits: <span className="tabular-nums">{formatCount(share.visits)}</span>,
            actions: (
              <div className="admin-table-actions">
                <button
                  type="button"
                  className="ui-btn ui-btn-ghost ui-btn-sm"
                  onClick={() => void copyLink(share.slug)}
                >
                  <span className="ui-btn-label">{copied === share.slug ? "Copied" : "Copy link"}</span>
                </button>
                <Link
                  href={`/s/${share.slug}`}
                  className="ui-btn ui-btn-ghost ui-btn-sm"
                  target="_blank"
                >
                  <span className="ui-btn-label">Open</span>
                </Link>
                <button
                  type="button"
                  className="ui-btn ui-btn-danger ui-btn-sm"
                  onClick={() => setRevokeTarget(share)}
                >
                  <span className="ui-btn-label">Revoke</span>
                </button>
              </div>
            ),
          }))}
        />
      )}

      {page.total > page.limit && (
        <div className="admin-pager">
          <span className="admin-pager-count">
            {start}–{end} of {formatCount(page.total)}
          </span>
          <div className="admin-pager-links">
            {hasPrev ? (
              <Link
                href={shareIndexHref(state, { page: page.page - 1 })}
                className="ui-btn ui-btn-ghost ui-btn-sm"
              >
                <span className="ui-btn-label">← Previous</span>
              </Link>
            ) : (
              <span className="admin-quiet">← Previous</span>
            )}
            {hasNext ? (
              <Link
                href={shareIndexHref(state, { page: page.page + 1 })}
                className="ui-btn ui-btn-ghost ui-btn-sm"
              >
                <span className="ui-btn-label">Next →</span>
              </Link>
            ) : (
              <span className="admin-quiet">Next →</span>
            )}
          </div>
        </div>
      )}

      <ShareRevokeDialog
        share={revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onDone={(result) => {
          setRevokeTarget(null);
          if (result.ok) {
            setFeedback({ tone: "success", message: "The share link has been deleted." });
            router.refresh();
            return;
          }
          setFeedback({ tone: "danger", message: result.error });
        }}
      />
    </section>
  );
}
