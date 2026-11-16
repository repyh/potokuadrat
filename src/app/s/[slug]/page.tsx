import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";

import type { GalleryAlbum, GalleryState, SharePolicy } from "@/contracts/share";
import type { PhotoPage } from "@/contracts/album";
import { Alert } from "@/components/ui";
import { GalleryView } from "@/features/gallery/gallery-view";
import { resolveShareAccess } from "@/server/shares/access";
import { authorizeShareRequest } from "@/server/shares/access-context";
import { listShareGallery } from "@/server/shares/gallery";
import { resolveStripMetadata } from "@/server/shares/policy";
import { getShareRepository } from "@/server/shares/runtime";

type Context = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Context): Promise<Metadata> {
  const { slug } = await params;
  const repository = getShareRepository();
  const share = await repository.findBySlug(slug);

  if (!share) {
    return { title: "Gallery — Potokuadrat" };
  }

  return {
    title: `${share.albumTitle} — Potokuadrat`,
    description: `Photographic folio for ${share.albumTitle}`,
  };
}

export default async function ShareGalleryPage({ params }: Context) {
  const { slug } = await params;
  const repository = getShareRepository();
  const share = await repository.findBySlug(slug);

  if (!share) {
    notFound();
  }

  const cookieHeader = (await headers()).get("cookie");
  const request = new Request("http://localhost", {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });

  const authorization = await authorizeShareRequest(repository, request, share);
  const access = resolveShareAccess(share, new Date(), authorization.authorized);

  let album: GalleryAlbum | null = null;
  let policy: SharePolicy | null = null;
  let initialPage: PhotoPage = { photos: [], nextCursor: null, total: 0 };

  if (access === "ok") {
    album = {
      slug: share.albumSlug,
      title: share.albumTitle,
      photoCount: share.photoCount,
      branding: share.albumBranding,
      photographerName: share.photographerName,
    };

    policy = {
      mode: share.mode,
      allowDownload: share.allowDownload,
      allowedQualities: share.allowedQualities,
      stripMetadata: resolveStripMetadata(share, share.organizationStripMetadata),
      expiresAt: share.expiresAt?.toISOString() ?? null,
    };

    const galleryResult = await listShareGallery(
      repository,
      request,
      slug,
      new URLSearchParams(),
    );

    if (galleryResult.ok) {
      initialPage = galleryResult.page;
    }
  }

  const state: GalleryState = { access, album, policy };

  // Handle access gates
  if (access === "expired") {
    return (
      <main className="folio-frame bg-[var(--ground)] min-h-screen p-6 flex items-center justify-center">
        <div className="w-full max-w-md bg-[var(--paper)] border border-[var(--line)] p-8 text-center shadow-lg">
          <p className="hero-eyebrow">Potokuadrat Folio</p>
          <h1 className="font-[var(--font-display)] text-2xl text-[var(--ink)] mb-4">
            Link Expired
          </h1>
          <Alert tone="warning" title="Access Closed">
            This share link has expired. Please contact the event organizer or
            photographer to request a fresh invitation.
          </Alert>
        </div>
      </main>
    );
  }

  if (access === "password_required") {
    return (
      <main className="folio-frame bg-[var(--ground)] min-h-screen p-6 flex items-center justify-center">
        <div className="w-full max-w-md bg-[var(--paper)] border border-[var(--line)] p-8 text-center shadow-lg">
          <p className="hero-eyebrow">Potokuadrat Folio</p>
          <h1 className="font-[var(--font-display)] text-2xl text-[var(--ink)] mb-3">
            Protected Folio
          </h1>
          <p className="text-xs text-[var(--quiet)] mb-6">
            Enter the client passcode provided by your photographer to view this
            collection.
          </p>
          <form
            method="POST"
            action={`/api/share/${encodeURIComponent(slug)}/access`}
            className="space-y-4 text-left"
          >
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold uppercase text-[var(--ink)] mb-1"
              >
                Passcode
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                placeholder="Enter password…"
                className="w-full border border-[var(--line)] px-3 py-2 text-sm bg-[var(--paper)] text-[var(--ink)] focus:outline-[var(--accent)]"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-[var(--accent)] text-[var(--ink)] font-bold text-xs uppercase tracking-wider py-3 hover:bg-[var(--ink)] hover:text-[var(--paper)] transition-colors cursor-pointer"
            >
              Unlock Collection
            </button>
          </form>
        </div>
      </main>
    );
  }

  if (access === "magic_link_required") {
    return (
      <main className="folio-frame bg-[var(--ground)] min-h-screen p-6 flex items-center justify-center">
        <div className="w-full max-w-md bg-[var(--paper)] border border-[var(--line)] p-8 text-center shadow-lg">
          <p className="hero-eyebrow">Potokuadrat Folio</p>
          <h1 className="font-[var(--font-display)] text-2xl text-[var(--ink)] mb-3">
            Private Magic Link Required
          </h1>
          <Alert tone="neutral" title="Invitation Only">
            This collection is private. Please use the personalized link sent to
            your email address to access your gallery.
          </Alert>
        </div>
      </main>
    );
  }

  if (access !== "ok" || !album) {
    notFound();
  }

  return <GalleryView slug={slug} state={state} initialPage={initialPage} />;
}
