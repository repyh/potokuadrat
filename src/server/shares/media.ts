import "server-only";

import { resolveShareAccess, statusForAccess } from "./access";
import type { SharePhotoRecord, ShareRecord, ShareRepository } from "./repository";

export type ShareMediaResult =
  | { ok: true; share: ShareRecord; photo: SharePhotoRecord }
  | { ok: false; status: number; error: string };

/** Shared entry point for the thumbnail and download routes. */
export async function resolveShareMedia(
  repository: ShareRepository,
  slug: string,
  photoId: string,
): Promise<ShareMediaResult> {
  const share = await repository.findBySlug(slug);
  if (!share) {
    return { ok: false, status: 404, error: "Share not found." };
  }

  const access = resolveShareAccess(share);
  if (access !== "ok") {
    return {
      ok: false,
      status: statusForAccess(access),
      error:
        access === "expired"
          ? "Share expired."
          : access === "password_required"
            ? "Share requires a password."
            : "Share unavailable.",
    };
  }

  const photo = await repository.getSharePhoto(share, photoId);
  if (!photo) {
    return { ok: false, status: 404, error: "Photo not found." };
  }

  return { ok: true, share, photo };
}
