import type { Metadata } from "next";
import { connection } from "next/server";

import { NewShareForm } from "@/features/admin/new-share-form";
import { getAlbumService } from "@/server/albums/runtime";
import { requireAdmin } from "@/server/auth/session";
import { getOrganizationService } from "@/server/organizations/runtime";

export const metadata: Metadata = {
  title: "New share — Potokuadrat",
};

export const instant = false;

interface NewSharePageProps {
  searchParams: Promise<{ album?: string | string[] }>;
}

export default async function NewSharePage({ searchParams }: NewSharePageProps) {
  await connection();
  const [session, params] = await Promise.all([requireAdmin(), searchParams]);
  const [albums, organization] = await Promise.all([
    getAlbumService().list(session.user.id),
    getOrganizationService().get(),
  ]);

  const requestedAlbum = Array.isArray(params.album) ? params.album[0] : params.album;
  const initialAlbumId =
    requestedAlbum && albums.some((album) => album.id === requestedAlbum) ? requestedAlbum : null;

  return (
    <NewShareForm
      albums={albums.map((album) => ({
        id: album.id,
        title: album.title,
        slug: album.slug,
        photoCount: album.photoCount,
      }))}
      initialAlbumId={initialAlbumId}
      orgDefaults={{
        name: organization.name,
        title: organization.title,
        logo: organization.logo,
        accent: organization.accent,
        stripMetadata: organization.stripMetadata,
      }}
      todayDate={new Date().toISOString().slice(0, 10)}
    />
  );
}
