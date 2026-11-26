"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import type { AlbumStatus, AlbumSummary } from "@/contracts/album";
import { Button, DataTable, EmptyState, Input, Pagination, Select } from "@/components/ui";

import { AlbumCoverMark, AlbumStatusPill, albumPhotoLabel } from "./album-display";
import { formatCount, formatRelative } from "./format";

export interface AlbumsViewProps {
  albums: AlbumSummary[];
  /** Server timestamp so relative dates match between SSR and hydration. */
  now: number;
}

const PAGE_SIZE = 6;

type StatusFilter = "all" | AlbumStatus;
type SortKey = "updated" | "created" | "title";

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "indexing", label: "Indexing" },
  { value: "ready", label: "Ready" },
  { value: "failed", label: "Failed" },
];

export function AlbumsView({ albums, now }: AlbumsViewProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("updated");
  const [page, setPage] = useState(1);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = albums.filter((album) => {
      if (status !== "all" && album.status !== status) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return (
        album.title.toLowerCase().includes(needle) ||
        album.slug.toLowerCase().includes(needle)
      );
    });

    return [...filtered].sort((a, b) => {
      if (sort === "title") {
        return a.title.localeCompare(b.title);
      }
      const key = sort === "created" ? "createdAt" : "updatedAt";
      return new Date(b[key]).getTime() - new Date(a[key]).getTime();
    });
  }, [albums, query, status, sort]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = visible.slice(start, start + PAGE_SIZE);

  const resetFilters = () => {
    setQuery("");
    setStatus("all");
    setPage(1);
  };

  return (
    <section className="admin-page" aria-labelledby="albums-heading">
      <header className="admin-page-header">
        <div>
          <div className="admin-page-title">
            <h1 id="albums-heading">Albums</h1>
            <span className="admin-page-sub">{formatCount(albums.length)}</span>
          </div>
        </div>
        <Link href="/admin/albums/new" className="ui-btn ui-btn-primary ui-btn-md">
          <span className="ui-btn-label">New album</span>
          <span className="ui-btn-icon" aria-hidden="true">
            →
          </span>
        </Link>
      </header>

      {albums.length === 0 ? (
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
        <>
          <div className="admin-toolbar">
            <Input
              type="search"
              className="admin-search"
              aria-label="Search albums"
              placeholder="Search albums"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />

            <div className="admin-chips" role="group" aria-label="Filter by index status">
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  className={`admin-chip ${status === filter.value ? "is-active" : ""}`.trim()}
                  aria-pressed={status === filter.value}
                  onClick={() => {
                    setStatus(filter.value);
                    setPage(1);
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <label className="admin-sort">
              <span>Sort</span>
              <Select
                aria-label="Sort albums"
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value as SortKey);
                  setPage(1);
                }}
                options={[
                  { value: "updated", label: "Updated" },
                  { value: "created", label: "Created" },
                  { value: "title", label: "Title" },
                ]}
              />
            </label>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              title="No albums match"
              description="Try a different search or status."
              action={
                <Button variant="secondary" onClick={resetFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <DataTable
              rowKeyField="id"
              columns={[
                { key: "title", header: "Cover + title" },
                { key: "status", header: "Status" },
                { key: "photos", header: "Photos", numeric: true },
                { key: "shares", header: "Shares", numeric: true },
                { key: "updated", header: "Updated" },
                { key: "actions", header: "Manage", numeric: true },
              ]}
              rows={pageRows.map((album) => ({
                id: album.id,
                title: (
                  <Link
                    href={`/admin/albums/${encodeURIComponent(album.id)}`}
                    className="admin-table-title"
                  >
                    <AlbumCoverMark
                      albumId={album.id}
                      coverPhotoId={album.coverPhotoId}
                      title={album.title}
                    />
                    <span className="admin-table-primary">
                      <strong>{album.title}</strong>
                      <span className="admin-table-sub">/{album.slug}</span>
                    </span>
                  </Link>
                ),
                status: <AlbumStatusPill status={album.status} />,
                photos: <span className="tabular-nums">{albumPhotoLabel(album)}</span>,
                shares: <span className="tabular-nums">{formatCount(album.shareCount)}</span>,
                updated: (
                  <span className="tabular-nums admin-quiet">
                    {formatRelative(album.updatedAt, now)}
                  </span>
                ),
                actions: (
                  <Link
                    href={`/admin/albums/${encodeURIComponent(album.id)}`}
                    className="ui-btn ui-btn-ghost ui-btn-sm"
                  >
                    <span className="ui-btn-label">Manage →</span>
                  </Link>
                ),
              }))}
            />
          )}

          {visible.length > PAGE_SIZE && (
            <div className="admin-pager">
              <span className="admin-pager-count">
                {start + 1}–{Math.min(start + PAGE_SIZE, visible.length)} of{" "}
                {formatCount(visible.length)}
              </span>
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
