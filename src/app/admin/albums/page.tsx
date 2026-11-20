import type { Metadata } from "next";

import { AlbumsView } from "@/features/admin/albums-view";
import { getAlbumService } from "@/server/albums/runtime";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Albums — Potokuadrat",
};

export default async function AdminAlbumsPage() {
  const session = await requireAdmin();
  const albums = await getAlbumService().list(session.user.id);

  return <AlbumsView albums={albums} />;
}
