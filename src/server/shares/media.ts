import "server-only";

import { accessErrorMessage, resolveShareAccess, statusForAccess } from "./access";
import type { SharePhotoRecord, ShareRecord, ShareRepository } from "./repository";

export interface ShareMediaOptions {
  /** Returns true when the request carries valid proof for a password/magic share. */
  authorize?: (share: ShareRecord) => Promise<boolean>;
}

export type ShareMediaResult =
  | { ok: true; share: ShareRecord; photo: SharePhotoRecord }
  | { ok: false; status: number; error: string };

/** Shared entry point for the thumbnail and download routes. */
export async function resolveShareMedia(
  repository: ShareRepository,
  slug: string,
  photoId: string,
  options: ShareMediaOptions = {},
): Promise<ShareMediaResult> {
  const share = await repository.findBySlug(slug);
  if (!share) {
    return { ok: false, status: 404, error: "Share not found." };
  }

  const authorized = options.authorize ? await options.authorize(share) : false;
  const access = resolveShareAccess(share, new Date(), authorized);

  if (access !== "ok") {
    return { ok: false, status: statusForAccess(access), error: accessErrorMessage(access) };
  }

  const photo = await repository.getSharePhoto(share, photoId);
  if (!photo) {
    return { ok: false, status: 404, error: "Photo not found." };
  }

  return { ok: true, share, photo };
}
