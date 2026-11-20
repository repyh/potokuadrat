"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { AlbumSummary } from "@/contracts/album";
import { Button, DataTable, Dialog, EmptyState, Field, Input, Select } from "@/components/ui";

export interface AlbumsMockupProps {
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

export function AlbumsMockup({ albums }: AlbumsMockupProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [albumTitle, setAlbumTitle] = useState("");
  const [selectedFolder, setSelectedFolder] = useState("seed-folder-0001");

  return (
    <section className="admin-page" aria-labelledby="albums-heading">
      <header className="admin-page-header">
        <div>
          <h1 id="albums-heading">Albums</h1>
        </div>
        <Button variant="primary" size="md" onClick={() => setDialogOpen(true)}>
          New album
        </Button>
      </header>

      {albums.length === 0 ? (
        <EmptyState
          title="No albums indexed yet"
          description="Connect a shared Google Drive folder to create your first client folio."
          action={
            <Button variant="primary" onClick={() => setDialogOpen(true)}>
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
            { key: "actions", header: "Share", numeric: true },
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
                onClick={() => router.push(`/s/${encodeURIComponent(row.slug)}`)}
              >
                Open folio →
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
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setDialogOpen(false)}>
              Create & index
            </Button>
          </>
        }
      >
        <div className="admin-dialog-stack">
          <Field htmlFor="mockup-album-title" label="Album title">
            <Input
              id="mockup-album-title"
              value={albumTitle}
              onChange={(e) => setAlbumTitle(e.target.value)}
              placeholder="e.g. Autumn Wedding — Kusuma"
            />
          </Field>

          <Field
            htmlFor="mockup-drive-folder"
            label="Google Drive folder"
            hint="Mockup preview — live folder list wires to /api/admin/drive/folders."
          >
            <Select
              id="mockup-drive-folder"
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              options={[
                { value: "seed-folder-0001", label: "Seed Folder (local)" },
                { value: "drive-sample-2", label: "2026-11 Client Shoots / Finals" },
              ]}
            />
          </Field>
        </div>
      </Dialog>
    </section>
  );
}
