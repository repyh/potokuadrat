"use client";

import { useRouter } from "next/navigation";

import type { AlbumSummary } from "@/contracts/album";
import { DocumentRow } from "@/components/ui";

export interface RecentAlbumsListProps {
  albums: AlbumSummary[];
}

const STATUS_LABEL: Record<AlbumSummary["status"], string> = {
  ready: "Public",
  indexing: "Private",
  failed: "Private",
};

export function RecentAlbumsList({ albums }: RecentAlbumsListProps) {
  const router = useRouter();

  return (
    <div className="specimen-ruled-stack">
      {albums.map((album) => (
        <DocumentRow
          key={album.id}
          mark={album.title.trim().charAt(0).toUpperCase() || "A"}
          kind={STATUS_LABEL[album.status]}
          title={album.title}
          fileSize={`/${album.slug}`}
          readingTime={`${album.photoCount} photos`}
          onOpen={() => router.push(`/admin/albums/${encodeURIComponent(album.id)}`)}
        />
      ))}
    </div>
  );
}
