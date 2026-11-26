"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type {
  AlbumDetail,
  AlbumFolderInput,
  DriveFolderOption,
  DriveFoldersResponse,
} from "@/contracts/admin";
import type { ShareMode, ShareSummary } from "@/contracts/share";
import {
  deleteAlbumAction,
  reindexAlbumAction,
  updateAlbumAction,
} from "@/app/admin/albums/actions";
import {
  Alert,
  Breadcrumbs,
  Button,
  Checkbox,
  DataTable,
  Dialog,
  EmptyState,
  Field,
  Fieldset,
  Input,
  ProgressBar,
  Select,
} from "@/components/ui";

import { formatCount, formatDay } from "./format";
import { ShareRevokeDialog } from "./share-revoke-dialog";
import { extractDriveFolderId } from "./drive-folder";

export interface AlbumDetailViewProps {
  detail: AlbumDetail;
  shares: ShareSummary[];
  /** Server timestamp so relative dates match between SSR and hydration. */
  now: number;
}

const MODE_LABELS: Record<ShareMode, string> = {
  public: "Public",
  password: "Password",
  magic_link: "Magic link",
};

export function AlbumDetailView({ detail, shares, now }: AlbumDetailViewProps) {
  const router = useRouter();
  const { album, folders, progress } = detail;

  const [title, setTitle] = useState(album.title);
  const [savingTitle, setSavingTitle] = useState(false);

  const [driveFolders, setDriveFolders] = useState<AlbumFolderInput[]>(() =>
    folders.map((f) => ({
      driveFolderId: f.driveFolderId,
      name: f.name,
      recursive: f.recursive,
    })),
  );
  const [foldersDirty, setFoldersDirty] = useState(false);
  const [discoveredFolders, setDiscoveredFolders] = useState<DriveFolderOption[]>([]);
  const [loadingDriveFolders, setLoadingDriveFolders] = useState(false);
  const [selectedDiscoveredId, setSelectedDiscoveredId] = useState("");
  const [pastedFolderInput, setPastedFolderInput] = useState("");
  const [savingFolders, setSavingFolders] = useState(false);
  const [reindexing, setReindexing] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAlbum, setDeletingAlbum] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ShareSummary | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "danger";
    title: string;
    message: string;
  } | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setFeedback({
        tone: "danger",
        title: "Copy failed",
        message: "Clipboard access was blocked by this browser.",
      });
    }
  };

  const handleSaveTitle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingTitle || !title.trim()) {
      return;
    }

    setSavingTitle(true);
    setFeedback(null);
    const result = await updateAlbumAction(album.id, { title: title.trim() });
    setSavingTitle(false);

    if (!result.ok) {
      setFeedback({ tone: "danger", title: "Update failed", message: result.error });
      return;
    }

    setFeedback({ tone: "success", title: "Album updated", message: "Title saved." });
    router.refresh();
  };

  const handleLoadDriveFolders = async () => {
    if (loadingDriveFolders) {
      return;
    }
    setLoadingDriveFolders(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/admin/drive/folders");
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setFeedback({
          tone: "danger",
          title: "Folder discovery failed",
          message: body?.error ?? "Unable to list shared Drive folders.",
        });
        return;
      }

      const data = (await res.json()) as DriveFoldersResponse;
      setDiscoveredFolders(data.folders);
      if (data.folders[0]) {
        setSelectedDiscoveredId(data.folders[0].id);
      } else {
        setFeedback({
          tone: "danger",
          title: "No folders found",
          message: "No folders are shared with the service account yet.",
        });
      }
    } catch {
      setFeedback({
        tone: "danger",
        title: "Folder discovery failed",
        message: "Network error while loading Drive folders.",
      });
    } finally {
      setLoadingDriveFolders(false);
    }
  };

  const handleAddFolder = (folderId: string, folderName?: string) => {
    const cleanId = extractDriveFolderId(folderId);
    if (!cleanId) {
      return;
    }
    if (driveFolders.some((f) => f.driveFolderId === cleanId)) {
      setFeedback({
        tone: "danger",
        title: "Duplicate folder",
        message: "That Google Drive folder is already linked to this album.",
      });
      return;
    }

    setDriveFolders((prev) => [
      ...prev,
      { driveFolderId: cleanId, name: folderName || cleanId, recursive: true },
    ]);
    setFoldersDirty(true);
    setPastedFolderInput("");
  };

  const handleSaveDriveFolders = async () => {
    if (savingFolders || driveFolders.length === 0) {
      return;
    }

    setSavingFolders(true);
    setFeedback(null);
    const result = await updateAlbumAction(album.id, { folders: driveFolders });
    setSavingFolders(false);

    if (!result.ok) {
      setFeedback({ tone: "danger", title: "Save failed", message: result.error });
      return;
    }

    setFoldersDirty(false);
    setFeedback({
      tone: "success",
      title: "Google Drive folders saved",
      message: "Updated linked folders and queued a full re-index.",
    });
    router.refresh();
  };

  const handleReindex = async () => {
    if (reindexing) {
      return;
    }

    setReindexing(true);
    setFeedback(null);
    const result = await reindexAlbumAction(album.id);
    setReindexing(false);

    if (!result.ok) {
      setFeedback({
        tone: "danger",
        title: "Re-index failed",
        message: result.error,
      });
      return;
    }

    setFeedback({
      tone: "success",
      title: "Re-index queued",
      message: "The worker will scan linked Drive folders shortly.",
    });
    router.refresh();
  };

  const handleDeleteAlbum = async () => {
    if (deletingAlbum) {
      return;
    }
    setDeletingAlbum(true);
    const result = await deleteAlbumAction(album.id);
    setDeletingAlbum(false);

    if (!result.ok) {
      setDeleteDialogOpen(false);
      setFeedback({ tone: "danger", title: "Delete failed", message: result.error });
      return;
    }

    router.push("/admin/albums");
    router.refresh();
  };

  return (
    <section className="admin-page" aria-labelledby="album-detail-heading">
      <Breadcrumbs
        items={[
          { label: "Albums", href: "/admin/albums" },
          { label: album.title },
        ]}
      />

      <header className="admin-page-header">
        <div>
          <h1 id="album-detail-heading">{album.title}</h1>
          <p className="auth-lede">
            <span className="tabular-nums">{album.photoCount}</span> photos · /{album.slug}
          </p>
        </div>
      </header>

      {feedback && (
        <Alert
          tone={feedback.tone}
          title={feedback.title}
          onDismiss={() => setFeedback(null)}
        >
          {feedback.message}
        </Alert>
      )}

      <Fieldset
        legend="Album Details"
        description="Update the display title for this album."
      >
        <form onSubmit={handleSaveTitle} className="admin-dialog-stack" noValidate>
          <div className="specimen-form-grid">
            <Field htmlFor="detail-album-title" label="Album title">
              <Input
                id="detail-album-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={savingTitle}
                required
              />
            </Field>
          </div>
          <div>
            <Button type="submit" variant="secondary" loading={savingTitle}>
              Save title
            </Button>
          </div>
        </form>
      </Fieldset>

      <Fieldset
        legend="Google Drive"
        description="Manage linked Google Drive folders, subfolder recursion, and indexing."
      >
        <ProgressBar
          label="Indexed thumbnails"
          value={progress.ready}
          max={Math.max(1, progress.total)}
        />

        {driveFolders.length > 0 && (
          <div className="admin-folder-list">
            {driveFolders.map((folder) => (
              <div key={folder.driveFolderId} className="admin-folder-row">
                <div className="admin-table-primary">
                  <strong>{folder.name || folder.driveFolderId}</strong>
                  <span className="admin-table-sub">{folder.driveFolderId}</span>
                </div>

                <Checkbox
                  id={`recursive-${folder.driveFolderId}`}
                  checked={folder.recursive ?? true}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setDriveFolders((prev) =>
                      prev.map((item) =>
                        item.driveFolderId === folder.driveFolderId
                          ? { ...item, recursive: checked }
                          : item,
                      ),
                    );
                    setFoldersDirty(true);
                  }}
                  label="Include subfolders"
                />

                {driveFolders.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDriveFolders((prev) =>
                        prev.filter((item) => item.driveFolderId !== folder.driveFolderId),
                      );
                      setFoldersDirty(true);
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        <Field
          htmlFor="detail-paste-folder"
          label="Add Drive folder by ID or URL"
        >
          <div className="admin-input-row">
            <Input
              id="detail-paste-folder"
              value={pastedFolderInput}
              onChange={(e) => setPastedFolderInput(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
            />
            <Button
              variant="secondary"
              size="md"
              disabled={!pastedFolderInput.trim()}
              onClick={() => handleAddFolder(pastedFolderInput)}
            >
              Add folder
            </Button>
          </div>
        </Field>

        <Field
          htmlFor="detail-discovered-folder"
          label="Shared folders"
        >
          {discoveredFolders.length > 0 ? (
            <div className="admin-input-row">
              <Select
                id="detail-discovered-folder"
                value={selectedDiscoveredId}
                onChange={(e) => setSelectedDiscoveredId(e.target.value)}
                options={discoveredFolders.map((f) => ({
                  value: f.id,
                  label: f.name,
                }))}
              />
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  const chosen = discoveredFolders.find(
                    (f) => f.id === selectedDiscoveredId,
                  );
                  if (chosen) {
                    handleAddFolder(chosen.id, chosen.name);
                  }
                }}
              >
                Add selected
              </Button>
            </div>
          ) : (
            <div>
              <Button
                variant="secondary"
                size="sm"
                loading={loadingDriveFolders}
                onClick={() => void handleLoadDriveFolders()}
              >
                Load shared folders
              </Button>
            </div>
          )}
        </Field>

        <div className="specimen-inline-cluster">
          <Button
            variant="secondary"
            loading={savingFolders}
            disabled={!foldersDirty || driveFolders.length === 0}
            onClick={() => void handleSaveDriveFolders()}
          >
            Save Drive folders
          </Button>
          <Button
            variant="ghost"
            loading={reindexing}
            onClick={() => void handleReindex()}
          >
            Re-index now
          </Button>
        </div>
      </Fieldset>

      <Fieldset
        legend="Share Links"
        description="Create public, password-protected, or one-time magic-link folios for clients."
      >
        <div className="specimen-inline-cluster">
          <Link
            href={`/admin/shares/new?album=${encodeURIComponent(album.id)}`}
            className="ui-btn ui-btn-primary ui-btn-md"
          >
            <span className="ui-btn-label">New share link</span>
          </Link>
        </div>

        {shares.length === 0 ? (
          <EmptyState
            title="No share links yet"
            description="Create a share link to deliver this album to guests."
          />
        ) : (
          <DataTable
            rowKeyField="id"
            columns={[
              { key: "slug", header: "Link" },
              { key: "mode", header: "Access" },
              { key: "visits", header: "Visits", numeric: true },
              { key: "expires", header: "Expires" },
              { key: "downloads", header: "Downloads" },
              { key: "actions", header: "Actions", numeric: true },
            ]}
            rows={shares.map((share) => {
              const path = `/s/${share.slug}`;
              const expiresAt = share.expiresAt ? new Date(share.expiresAt) : null;
              const expired = expiresAt ? expiresAt.getTime() <= now : false;
              return {
                id: share.id,
                slug: <code>{path}</code>,
                mode: MODE_LABELS[share.mode],
                visits: (
                  <span className="tabular-nums">{formatCount(share.visits)}</span>
                ),
                expires: (
                  <span className={expired ? "admin-quiet" : "tabular-nums"}>
                    {expiresAt ? formatDay(expiresAt.toISOString()) : "Never"}
                    {expired ? " · expired" : ""}
                  </span>
                ),
                downloads: share.allowDownload
                  ? share.allowedQualities.join(", ")
                  : "Disabled",
                actions: (
                  <div className="admin-table-actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void handleCopy(
                          share.id,
                          `${window.location.origin}${path}`,
                        )
                      }
                    >
                      {copiedKey === share.id ? "Copied" : "Copy URL"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(path)}
                    >
                      Open →
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setRevokeTarget(share)}
                    >
                      Revoke
                    </Button>
                  </div>
                ),
              };
            })}
          />
        )}
      </Fieldset>

      <Fieldset
        legend="Danger Zone"
        description="Permanently delete this album, its indexed photo records, and all share links. Google Drive source files are never modified."
      >
        <div>
          <Button
            variant="danger"
            size="md"
            onClick={() => setDeleteDialogOpen(true)}
          >
            Delete album
          </Button>
        </div>
      </Fieldset>

      <ShareRevokeDialog
        share={revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onDone={(result) => {
          setRevokeTarget(null);
          if (result.ok) {
            setFeedback({
              tone: "success",
              title: "Share revoked",
              message: "The share link has been deleted.",
            });
            router.refresh();
            return;
          }
          setFeedback({ tone: "danger", title: "Revoke failed", message: result.error });
        }}
      />

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        title="Delete album?"
        description="This permanently removes the album, indexed photo records, and all share links."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deletingAlbum}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deletingAlbum}
              onClick={() => void handleDeleteAlbum()}
            >
              Delete album
            </Button>
          </>
        }
      >
        <p className="admin-empty-copy">
          Google Drive source files are never modified or deleted.
        </p>
      </Dialog>
    </section>
  );
}
