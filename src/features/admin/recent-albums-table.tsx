"use client";

import Link from "next/link";

import type { AlbumSummary } from "@/contracts/album";
import { DataTable } from "@/components/ui";

import { AlbumCoverMark, AlbumStatusPill, albumPhotoLabel } from "./album-display";
import { formatCount, formatRelative } from "./format";

export interface RecentAlbumsTableProps {
  albums: AlbumSummary[];
  /** Server timestamp so relative dates match between SSR and hydration. */
  now: number;
}

export function RecentAlbumsTable({ albums, now }: RecentAlbumsTableProps) {
  return (
    <DataTable
      rowKeyField="id"
      columns={[
        { key: "title", header: "Album" },
        { key: "status", header: "Status" },
        { key: "photos", header: "Photos", numeric: true },
        { key: "shares", header: "Shares", numeric: true },
        { key: "updated", header: "Updated" },
      ]}
      rows={albums.map((album) => ({
        id: album.id,
        title: (
          <Link href={`/admin/albums/${encodeURIComponent(album.id)}`} className="admin-table-title">
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
      }))}
    />
  );
}
