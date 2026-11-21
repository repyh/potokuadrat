"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { AlbumSummary } from "@/contracts/album";
import { Button, DataTable, EmptyState } from "@/components/ui";
import { NewAlbumDialog } from "./new-album-dialog";

export interface AlbumsViewProps {
  albums: AlbumSummary[];
}

export const ALBUM_STATUS_CONFIG: Record<
  AlbumSummary["status"],
  { label: string; tone: "ready" | "indexing" | "failed"; dotClass: string }
> = {
  ready: {
    label: "Public",
    tone: "ready",
    dotClass: "bg-[#15803d]",
  },
  indexing: {
    label: "Private (Indexing)",
    tone: "indexing",
    dotClass: "bg-[#b45309]",
  },
  failed: {
    label: "Private (Failed)",
    tone: "failed",
    dotClass: "bg-[#b91c1c]",
  },
};

export function formatAlbumDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function AlbumsView({ albums }: AlbumsViewProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <section className="space-y-6" aria-labelledby="albums-heading">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--line)] pb-5">
        <div>
          <h1
            id="albums-heading"
            className="font-serif text-3xl font-normal tracking-tight text-[var(--ink)]"
          >
            Albums
          </h1>
          <p className="text-sm text-[var(--quiet)] mt-1">
            Organize photo shoots and client portfolios indexed directly from Google Drive.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setDialogOpen(true)}
          className="self-start sm:self-auto"
        >
          + New album
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
        <div className="border border-[var(--ink)] bg-[var(--surface)] shadow-[4px_4px_0px_rgba(24,60,52,0.06)] overflow-hidden">
          <DataTable
            rowKeyField="id"
            caption="Overview of all client albums"
            columns={[
              { key: "title", header: "Title & Slug" },
              { key: "status", header: "Status" },
              { key: "photos", header: "Photos", numeric: true },
              { key: "created", header: "Created Date" },
              { key: "actions", header: "Manage", numeric: true },
            ]}
            rows={albums.map((album) => {
              const statusCfg = ALBUM_STATUS_CONFIG[album.status] ?? ALBUM_STATUS_CONFIG.indexing;
              return {
                id: album.id,
                title: (
                  <div className="py-1">
                    <span className="font-semibold text-[var(--ink)] block">
                      {album.title}
                    </span>
                    <span className="font-mono text-xs text-[var(--quiet)]">
                      /{album.slug}
                    </span>
                  </div>
                ),
                status: (
                  <div className="inline-flex items-center gap-1.5 font-medium text-xs">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${statusCfg.dotClass}`}
                      aria-hidden="true"
                    />
                    <span>{statusCfg.label}</span>
                  </div>
                ),
                photos: (
                  <span className="font-mono tabular-nums text-sm font-semibold text-[var(--ink)]">
                    {album.photoCount.toLocaleString()}
                  </span>
                ),
                created: (
                  <span className="font-mono tabular-nums text-xs text-[var(--quiet)]">
                    {formatAlbumDate(album.createdAt)}
                  </span>
                ),
                actions: (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/admin/albums/${encodeURIComponent(album.id)}`)}
                  >
                    Manage →
                  </Button>
                ),
              };
            })}
          />
        </div>
      )}

      {/* New Album Dialog Modal from Issue #28 */}
      <NewAlbumDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(created) => {
          setDialogOpen(false);
          router.push(`/admin/albums/${encodeURIComponent(created.id)}`);
          router.refresh();
        }}
      />
    </section>
  );
}
