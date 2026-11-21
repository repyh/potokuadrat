"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { AlbumStatus, AlbumSummary } from "@/contracts/album";
import type { AlbumDetailResponse, DriveFolderOption, DriveFoldersResponse } from "@/contracts/admin";
import {
  Alert,
  Button,
  DataTable,
  Dialog,
  EmptyState,
  Field,
  Input,
  Pagination,
  Select,
} from "@/components/ui";

import { AlbumCoverMark, AlbumStatusPill, albumPhotoLabel } from "./album-display";
import { extractDriveFolderId } from "./drive-folder";
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
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [albumTitle, setAlbumTitle] = useState("");
  const [folders, setFolders] = useState<DriveFolderOption[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [foldersError, setFoldersError] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [pastedFolderId, setPastedFolderId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("updated");
  const [page, setPage] = useState(1);

  const openNewAlbumDialog = async () => {
    setDialogOpen(true);
    setSubmitError(null);
    setFoldersError(null);
    setLoadingFolders(true);

    try {
      const response = await fetch("/api/admin/drive/folders");
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setFoldersError(body?.error ?? "Unable to list shared Drive folders.");
        setFolders([]);
        return;
      }

      const data = (await response.json()) as DriveFoldersResponse;
      setFolders(data.folders);
      if (data.folders[0]) {
        setSelectedFolderId(data.folders[0].id);
      }
    } catch {
      setFoldersError("Unable to reach Drive folder discovery.");
      setFolders([]);
    } finally {
      setLoadingFolders(false);
    }
  };

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

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) {
      return;
    }

    const driveFolderId = extractDriveFolderId(pastedFolderId) || selectedFolderId;
    if (!albumTitle.trim()) {
      setSubmitError("Enter an album title.");
      return;
    }
    if (!driveFolderId) {
      setSubmitError("Select or paste a Google Drive folder ID.");
      return;
    }

    const matched = folders.find((f) => f.id === driveFolderId);
    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/admin/albums", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: albumTitle.trim(),
          folders: [
            {
              driveFolderId,
              name: matched?.name,
              recursive: true,
            },
          ],
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setSubmitError(body?.error ?? "Could not create album.");
        return;
      }

      const created = (await response.json()) as AlbumDetailResponse;
      setDialogOpen(false);
      setAlbumTitle("");
      setPastedFolderId("");
      router.push(`/admin/albums/${encodeURIComponent(created.album.album.id)}`);
      router.refresh();
    } catch {
      setSubmitError("Unable to create album right now.");
    } finally {
      setSubmitting(false);
    }
  };

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
        <Button variant="primary" size="md" onClick={() => void openNewAlbumDialog()}>
          New album
        </Button>
      </header>

      {albums.length === 0 ? (
        <EmptyState
          title="No albums yet"
          description="Create the first album, then pick the Drive folders to index."
          action={
            <Button variant="primary" onClick={() => void openNewAlbumDialog()}>
              Create first album
            </Button>
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
                    <AlbumCoverMark title={album.title} />
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

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="New album"
        description="Select a Google Drive folder shared with your service account to index."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="new-album-form"
              variant="primary"
              loading={submitting}
              disabled={submitting}
            >
              Create &amp; index
            </Button>
          </>
        }
      >
        <form id="new-album-form" onSubmit={handleCreate} className="admin-dialog-stack" noValidate>
          {submitError && (
            <Alert tone="danger" title="Could not create album">
              {submitError}
            </Alert>
          )}

          <Field htmlFor="new-album-title" label="Album title">
            <Input
              id="new-album-title"
              value={albumTitle}
              onChange={(e) => setAlbumTitle(e.target.value)}
              disabled={submitting}
              required
              placeholder="e.g. Autumn Wedding — Kusuma"
            />
          </Field>

          {loadingFolders ? (
            <Alert tone="neutral" title="Loading Drive folders">
              Checking shared folders visible to the service account…
            </Alert>
          ) : folders.length > 0 ? (
            <Field htmlFor="new-album-folder" label="Shared Drive folder">
              <Select
                id="new-album-folder"
                value={selectedFolderId}
                onChange={(e) => setSelectedFolderId(e.target.value)}
                disabled={submitting}
                options={folders.map((folder) => ({
                  value: folder.id,
                  label: folder.name,
                }))}
              />
            </Field>
          ) : (
            foldersError && (
              <Alert tone="neutral" title="Folder discovery unavailable">
                {foldersError} You can still paste a Drive folder ID or URL below.
              </Alert>
            )
          )}

          <Field
            htmlFor="new-album-pasted-folder"
            label="Or paste Drive folder ID / URL"
            optionalLabel="Optional"
            hint="Used if the folder is not listed above."
          >
            <Input
              id="new-album-pasted-folder"
              value={pastedFolderId}
              onChange={(e) => setPastedFolderId(e.target.value)}
              disabled={submitting}
              placeholder="https://drive.google.com/drive/folders/..."
            />
          </Field>
        </form>
      </Dialog>
    </section>
  );
}
