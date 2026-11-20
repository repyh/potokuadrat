"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import type { AlbumSummary } from "@/contracts/album";
import type { AlbumDetailResponse, DriveFolderOption, DriveFoldersResponse } from "@/contracts/admin";
import {
  Alert,
  Button,
  DataTable,
  Dialog,
  EmptyState,
  Field,
  Input,
  Select,
} from "@/components/ui";

export interface AlbumsViewProps {
  albums: AlbumSummary[];
}

const STATUS_LABEL: Record<AlbumSummary["status"], string> = {
  ready: "Public",
  indexing: "Private",
  failed: "Private",
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function extractDriveFolderId(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? trimmed;
}

export function AlbumsView({ albums }: AlbumsViewProps) {
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

  return (
    <section className="admin-page" aria-labelledby="albums-heading">
      <header className="admin-page-header">
        <div>
          <h1 id="albums-heading">Albums</h1>
        </div>
        <Button variant="primary" size="md" onClick={() => void openNewAlbumDialog()}>
          New album
        </Button>
      </header>

      {albums.length === 0 ? (
        <EmptyState
          title="No albums indexed yet"
          description="Connect a shared Google Drive folder to create your first client folio."
          action={
            <Button variant="primary" onClick={() => void openNewAlbumDialog()}>
              Create first album
            </Button>
          }
        />
      ) : (
        <DataTable
          rowKeyField="id"
          columns={[
            { key: "title", header: "Title" },
            { key: "status", header: "Status" },
            { key: "photos", header: "Photos", numeric: true },
            { key: "created", header: "Created" },
            { key: "actions", header: "Manage", numeric: true },
          ]}
          rows={albums.map((row) => ({
            id: row.id,
            title: (
              <div className="admin-table-primary">
                <strong>{row.title}</strong>
                <span className="admin-table-sub">/{row.slug}</span>
              </div>
            ),
            status: (
              <span className={`admin-status-text is-${row.status}`}>
                {STATUS_LABEL[row.status]}
              </span>
            ),
            photos: <span className="tabular-nums">{row.photoCount}</span>,
            created: <span className="tabular-nums">{formatDate(row.createdAt)}</span>,
            actions: (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/admin/albums/${encodeURIComponent(row.id)}`)}
              >
                Manage →
              </Button>
            ),
          }))}
        />
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
