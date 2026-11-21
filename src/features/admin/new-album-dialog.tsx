"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import type { AlbumSummary } from "@/contracts/album";
import type { DriveFolderOption, DriveFoldersResponse } from "@/contracts/admin";
import { Alert, Button, Dialog, Field, Input, Select, Skeleton } from "@/components/ui";
import { extractDriveFolderId, isValidDriveFolderId } from "./drive-utils";

export interface NewAlbumDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (album: AlbumSummary) => void;
}

export function NewAlbumDialog({
  open,
  onOpenChange,
  onCreated,
}: NewAlbumDialogProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [folders, setFolders] = useState<DriveFolderOption[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [foldersError, setFoldersError] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [pastedFolderInput, setPastedFolderInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setTitle("");
    setPastedFolderInput("");
    setError(null);
    setFoldersError(null);
    onOpenChange(false);
  };

  // Fetch discovered Google Drive folders when dialog opens
  useEffect(() => {
    if (!open) return;

    let isMounted = true;

    void Promise.resolve().then(async () => {
      if (!isMounted) return;
      setLoadingFolders(true);
      setFoldersError(null);

      try {
        const response = await fetch("/api/admin/drive/folders");
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          if (isMounted) {
            setFoldersError(body?.error ?? "Unable to discover shared Google Drive folders.");
            setFolders([]);
          }
          return;
        }

        const data = (await response.json()) as DriveFoldersResponse;
        if (isMounted) {
          setFolders(data.folders);
          if (data.folders.length > 0 && data.folders[0]) {
            setSelectedFolderId(data.folders[0].id);
          }
        }
      } catch {
        if (isMounted) {
          setFoldersError("Failed to communicate with Google Drive service.");
          setFolders([]);
        }
      } finally {
        if (isMounted) {
          setLoadingFolders(false);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [open]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    setError(null);

    const cleanTitle = title.trim();
    if (cleanTitle.length < 2) {
      setError("Please enter an album title (at least 2 characters).");
      return;
    }

    // Determine target Drive folder: pasted input takes precedence if provided, otherwise selected
    const targetFolderId = extractDriveFolderId(pastedFolderInput) || selectedFolderId;

    if (!targetFolderId) {
      setError("Select a discovered Drive folder or paste a Google Drive folder link.");
      return;
    }

    if (!isValidDriveFolderId(targetFolderId)) {
      setError("The Google Drive folder ID format is invalid.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/albums", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          folders: [{ driveFolderId: targetFolderId }],
        }),
      });

      const result = (await response.json().catch(() => null)) as
        | { ok: true; data: AlbumSummary }
        | { ok: false; error: string }
        | null;

      if (!response.ok || !result || !result.ok) {
        setError(result && !result.ok ? result.error : "Could not create the album. Try again.");
        return;
      }

      onOpenChange(false);
      if (onCreated) {
        onCreated(result.data);
      } else {
        router.push(`/admin/albums/${result.data.id}`);
        router.refresh();
      }
    } catch {
      setError("Network error while creating album. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectOptions = folders.map((f) => ({
    value: f.id,
    label: `${f.name} (${f.source === "shared_drive" ? "Shared Drive" : "Folder"})`,
  }));

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Create New Album"
      description="Link a Google Drive folder to begin indexing photographs and publishing client shares."
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2" noValidate>
        {error && (
          <Alert tone="danger" title="Creation failed">
            {error}
          </Alert>
        )}

        {/* Album Title */}
        <Field label="Album Title" htmlFor="album-title">
          <Input
            id="album-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Autumn Architecture Symposium"
            disabled={submitting}
            autoFocus
            required
          />
        </Field>

        {/* Drive Folder Discovery Dropdown */}
        <div className="space-y-1.5">
          <label htmlFor="drive-folder-select" className="ui-field-label">
            Discovered Shared Folder
          </label>

          {loadingFolders ? (
            <div className="p-2 border border-[var(--line)] bg-[var(--ground)]">
              <Skeleton lines={1} height="24px" />
            </div>
          ) : foldersError ? (
            <Alert tone="warning" title="Folder Discovery Unavailable">
              {foldersError} You can paste a folder link directly below.
            </Alert>
          ) : folders.length > 0 ? (
            <Select
              id="drive-folder-select"
              value={selectedFolderId}
              options={selectOptions}
              onChange={(e) => setSelectedFolderId(e.target.value)}
              disabled={submitting || Boolean(pastedFolderInput.trim())}
            />
          ) : (
            <p className="text-xs text-[var(--quiet)] italic p-2 border border-dashed border-[var(--line)]">
              No folders shared with the service account were automatically found. Paste a link below.
            </p>
          )}
        </div>

        {/* Paste Link Fallback */}
        <Field
          label="Or Paste Google Drive Folder Link / ID"
          htmlFor="pasted-folder-link"
          hint="Paste the URL from your browser (e.g. https://drive.google.com/drive/folders/1XtiPM...)"
        >
          <Input
            id="pasted-folder-link"
            value={pastedFolderInput}
            onChange={(e) => setPastedFolderInput(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/..."
            disabled={submitting}
          />
        </Field>

        <div className="pt-2 text-xs text-[var(--quiet)] border-t border-[var(--line)]">
          💡 <span className="font-medium">Permission Notice:</span> Ensure the Google Drive folder is shared with the service account email with at least <span className="font-bold">Viewer</span> permission.
        </div>

        <div className="flex justify-end gap-2 pt-3">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={submitting}>
            Create Album &amp; Start Indexing
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
