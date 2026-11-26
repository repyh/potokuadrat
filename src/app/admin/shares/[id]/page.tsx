import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { ShareDetailView } from "@/features/admin/share-detail-view";
import { getAlbumService } from "@/server/albums/runtime";
import { requireAdmin } from "@/server/auth/session";
import { getOrganizationService } from "@/server/organizations/runtime";
import { getShareAdminService } from "@/server/shares/runtime";
import { shareIdSchema } from "@/server/shares/validation";

export const metadata: Metadata = {
  title: "Share — Potokuadrat",
};

export const instant = false;

interface ShareDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminShareDetailPage({ params }: ShareDetailPageProps) {
  await connection();
  const [{ id }, session] = await Promise.all([params, requireAdmin()]);
  const parsedId = shareIdSchema.safeParse(id);
  if (!parsedId.success) {
    notFound();
  }

  const share = await getShareAdminService().detail(session.user.id, parsedId.data);
  if (!share) {
    notFound();
  }

  const [albumDetail, albumPhotos, organization] = await Promise.all([
    getAlbumService().detail(share.albumId),
    getAlbumService().photos(session.user.id, share.albumId),
    getOrganizationService().get(),
  ]);

  const nowDate = new Date();
  return (
    <ShareDetailView
      share={share}
      albumTitle={albumDetail?.album.title ?? "Album"}
      albumSlug={albumDetail?.album.slug ?? ""}
      albumPhotos={albumPhotos?.photos ?? []}
      orgDefaults={{
        name: organization.name,
        title: organization.title,
        accent: organization.accent,
        stripMetadata: organization.stripMetadata,
      }}
      now={nowDate.getTime()}
      todayDate={nowDate.toISOString().slice(0, 10)}
    />
  );
}
