"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { AlbumFolderInput, DriveFolderOption } from "@/contracts/admin";
import { createAlbumAction } from "@/app/admin/albums/actions";
import {
  Alert,
  Button,
  Checkbox,
  Field,
  Fieldset,
  Input,
} from "@/components/ui";

import { extractDriveFolderId } from "./drive-folder";

export interface NewAlbumFormProps {
  folders: DriveFolderOption[];
  foldersError: string | null;
  /** Nested folder levels the indexer walks; read-only, from server config. */
  maxDepth: number;
}

const SOURCE_LABEL: Record<DriveFolderOption["source"], string> = {
  shared: "shared with me",
  shared_drive: "Shared Drive",
  pasted: "pasted",
};

/**
 * Preview only. The server appends a short random suffix (`createAlbumSlug`), so the
 * final slug is shown after saving.
 */
function slugBase(title: string): string {
  return (
    title
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48)
      .replace(/-+$/g, "") || "album"
  );
}

export function NewAlbumForm({ folders, foldersError, maxDepth }: NewAlbumFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<AlbumFolderInput[]>([]);
  const [pasted, setPasted] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSelected = (id: string) => selected.some((folder) => folder.driveFolderId === id);

  const toggleFolder = (folder: DriveFolderOption) => {
    setError(null);
    setSelected((prev) =>
      prev.some((item) => item.driveFolderId === folder.id)
        ? prev.filter((item) => item.driveFolderId !== folder.id)
        : [...prev, { driveFolderId: folder.id, name: folder.name, recursive: true }],
    );
  };

  const setRecursive = (id: string, value: boolean) => {
    setSelected((prev) =>
      prev.map((item) =>
        item.driveFolderId === id ? { ...item, recursive: value } : item,
      ),
    );
  };

  const addPastedFolder = () => {
    const folderId = extractDriveFolderId(pasted);
    if (!folderId) {
      setError("Paste a Drive folder URL or id first.");
      return;
    }
    if (isSelected(folderId)) {
      setError("That folder is already part of this album.");
      return;
    }

    const known = folders.find((folder) => folder.id === folderId);
    setSelected((prev) => [
      ...prev,
      { driveFolderId: folderId, name: known?.name, recursive: true },
    ]);
    setPasted("");
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) {
      return;
    }
    if (title.trim().length < 2) {
      setError("Enter an album title.");
      return;
    }
    if (selected.length === 0) {
      setError("Pick at least one Drive folder to index.");
      return;
    }

    setSubmitting(true);
    setError(null);
    const result = await createAlbumAction({ title: title.trim(), folders: selected });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.push(`/admin/albums/${encodeURIComponent(result.data.id)}`);
    router.refresh();
  };

  return (
    <section className="admin-page" aria-labelledby="new-album-heading">
      <header className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Albums</p>
          <h1 id="new-album-heading">New album</h1>
          <p className="auth-lede">
            Album details, then the Drive folders to index.
          </p>
        </div>

        <div className="specimen-inline-cluster">
          <Link href="/admin/albums" className="ui-btn ui-btn-ghost ui-btn-md">
            <span className="ui-btn-label">Cancel</span>
          </Link>
          <Button type="submit" form="new-album-form" variant="primary" loading={submitting}>
            Save album
          </Button>
        </div>
      </header>

      {error && (
        <Alert tone="danger" title="Could not create album" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <form id="new-album-form" onSubmit={handleSubmit} className="admin-settings-sections" noValidate>
        <Fieldset legend="1 · Album details" description="The title is shown to clients; the slug follows it.">
          <div className="specimen-form-grid">
            <Field htmlFor="new-album-title" label="Title">
              <Input
                id="new-album-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={submitting}
                placeholder="Autumn Wedding — Kusuma"
                required
              />
            </Field>

            <Field
              htmlFor="new-album-slug"
              label="Slug"
              hint="A short suffix is added when the album is saved."
            >
              <Input id="new-album-slug" value={slugBase(title)} disabled readOnly />
            </Field>
          </div>

          <div className="admin-cover-placeholder">
            <span className="admin-cover-mark" aria-hidden="true">
              {(title.trim().charAt(0) || "A").toUpperCase()}
            </span>
            <span>Pick a cover from the album photos after indexing.</span>
          </div>
        </Fieldset>

        <Fieldset
          legend="2 · Drive folders"
          description="Folders shared with the service account. Originals never leave Drive."
        >
          {foldersError && (
            <Alert tone="neutral" title="Folder discovery unavailable">
              {foldersError} Paste a folder URL instead.
            </Alert>
          )}

          {folders.length > 0 && (
            <div className="admin-folder-list">
              {folders.map((folder) => {
                const checked = isSelected(folder.id);
                const current = selected.find((item) => item.driveFolderId === folder.id);

                return (
                  <div key={folder.id} className="admin-folder-row">
                    <div className="admin-table-primary">
                      <Checkbox
                        id={`folder-${folder.id}`}
                        checked={checked}
                        onChange={() => toggleFolder(folder)}
                        disabled={submitting}
                        label={`${folder.name} · ${SOURCE_LABEL[folder.source]}${
                          folder.ownerName ? ` · ${folder.ownerName}` : ""
                        }`}
                      />
                    </div>

                    {checked && (
                      <Checkbox
                        id={`recursive-${folder.id}`}
                        checked={current?.recursive ?? true}
                        onChange={(event) =>
                          setRecursive(folder.id, event.target.checked)
                        }
                        disabled={submitting}
                        label="Include subfolders"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <Field
            htmlFor="new-album-pasted-folder"
            label="Paste a Drive folder URL"
            hint={`Picked up when a Workspace policy hides it. Depth ${maxDepth}, read-only.`}
          >
            <div className="admin-input-row">
              <Input
                id="new-album-pasted-folder"
                value={pasted}
                onChange={(event) => setPasted(event.target.value)}
                disabled={submitting}
                placeholder="https://drive.google.com/drive/folders/…"
              />
              <Button
                variant="secondary"
                size="md"
                disabled={submitting || !pasted.trim()}
                onClick={addPastedFolder}
              >
                Add
              </Button>
            </div>
          </Field>

          <p className="admin-empty-copy">
            {selected.length === 0
              ? "No folders selected yet."
              : `${selected.length} folder${selected.length === 1 ? "" : "s"} selected · depth ${maxDepth}`}
          </p>
        </Fieldset>

        <div className="specimen-inline-cluster">
          <span className="admin-empty-copy">
            Originals stay in Drive; only metadata and thumbnails are indexed here.
          </span>
        </div>
      </form>
    </section>
  );
}
