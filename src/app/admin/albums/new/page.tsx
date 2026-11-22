import type { Metadata } from "next";

import { NewAlbumForm } from "@/features/admin/new-album-form";
import { requireAdmin } from "@/server/auth/session";
import { listDriveFolderOptions } from "@/server/drive/folders";

export const metadata: Metadata = {
  title: "New album — Potokuadrat",
};

export default async function NewAlbumPage() {
  await requireAdmin();
  const listing = await listDriveFolderOptions();

  return (
    <NewAlbumForm
      folders={listing.folders}
      foldersError={listing.error}
      maxDepth={listing.maxDepth}
    />
  );
}
