import type { Metadata } from "next";
import { connection } from "next/server";

import { NewAlbumForm } from "@/features/admin/new-album-form";
import { extractDriveFolderId } from "@/features/admin/drive-folder";
import { requireAdmin } from "@/server/auth/session";
import { listDriveFolderOptions } from "@/server/drive/folders";

export const metadata: Metadata = {
  title: "New album — Potokuadrat",
};

export const instant = false;

interface NewAlbumPageProps {
  searchParams: Promise<{ folder?: string | string[]; name?: string | string[] }>;
}

export default async function NewAlbumPage({ searchParams }: NewAlbumPageProps) {
  await connection();
  const [, params, listing] = await Promise.all([
    requireAdmin(),
    searchParams,
    listDriveFolderOptions(),
  ]);

  const rawFolder = Array.isArray(params.folder) ? params.folder[0] : params.folder;
  const rawName = Array.isArray(params.name) ? params.name[0] : params.name;
  const cleanFolderId = rawFolder ? extractDriveFolderId(rawFolder) : null;
  const initialFolder = cleanFolderId
    ? {
        driveFolderId: cleanFolderId,
        name:
          rawName?.trim() ||
          listing.folders.find((f) => f.id === cleanFolderId)?.name,
      }
    : null;

  return (
    <NewAlbumForm
      folders={listing.folders}
      foldersError={listing.error}
      maxDepth={listing.maxDepth}
      initialFolder={initialFolder}
    />
  );
}
