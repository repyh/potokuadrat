import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AlbumDetailView } from "@/features/admin/album-detail-view";
import { getAlbumService } from "@/server/albums/runtime";
import { requireAdmin } from "@/server/auth/session";
import { getShareAdminService } from "@/server/shares/runtime";

export const metadata: Metadata = {
  title: "Album — Potokuadrat",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminAlbumDetailPage({ params }: PageProps) {
  const [{ id }, session] = await Promise.all([params, requireAdmin()]);
  const [detail, shares] = await Promise.all([
    getAlbumService().detail(id),
    getShareAdminService().list(session.user.id, id),
  ]);

  if (!detail) {
    notFound();
  }

  return <AlbumDetailView detail={detail} shares={shares} />;
}
