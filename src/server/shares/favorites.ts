import "server-only";

import type { FavoritesResponse } from "@/contracts/share";

import { resolveShareRequest } from "./access-context";
import type { ShareRecord, ShareRepository } from "./repository";

export type FavoritesResult =
  | { ok: true; favorites: FavoritesResponse }
  | { ok: false; status: number; error: string };

export type FavoriteSessionResult =
  | { ok: true; sessionId: string }
  | { ok: false; status: number; error: string };

/**
 * Favorites are persisted only for magic-link sessions; the other modes keep them in
 * the browser. A 400 means "not this share", a 401 means "no live session".
 */
export function favoriteSession(
  share: Pick<ShareRecord, "mode">,
  sessionId: string | null,
): FavoriteSessionResult {
  if (share.mode !== "magic_link") {
    return { ok: false, status: 400, error: "This share keeps favorites in the browser." };
  }
  if (!sessionId) {
    return { ok: false, status: 401, error: "A magic-link session is required." };
  }
  return { ok: true, sessionId };
}

export async function listFavorites(
  repository: ShareRepository,
  request: Request,
  slug: string,
): Promise<FavoritesResult> {
  const resolved = await resolveShareRequest(repository, request, slug);
  if (!resolved.ok) {
    return resolved;
  }

  const session = favoriteSession(resolved.share, resolved.sessionId);
  if (!session.ok) {
    return session;
  }

  return {
    ok: true,
    favorites: {
      photoIds: await repository.listFavoritePhotoIds(resolved.share, session.sessionId),
    },
  };
}

export async function addFavorite(
  repository: ShareRepository,
  request: Request,
  slug: string,
  photoId: string,
): Promise<FavoritesResult> {
  const resolved = await resolveShareRequest(repository, request, slug);
  if (!resolved.ok) {
    return resolved;
  }

  const session = favoriteSession(resolved.share, resolved.sessionId);
  if (!session.ok) {
    return session;
  }

  const added = await repository.addFavorite(resolved.share, session.sessionId, photoId);
  if (!added) {
    return { ok: false, status: 404, error: "Photo not found." };
  }

  return {
    ok: true,
    favorites: {
      photoIds: await repository.listFavoritePhotoIds(resolved.share, session.sessionId),
    },
  };
}

export async function removeFavorite(
  repository: ShareRepository,
  request: Request,
  slug: string,
  photoId: string,
): Promise<FavoritesResult> {
  const resolved = await resolveShareRequest(repository, request, slug);
  if (!resolved.ok) {
    return resolved;
  }

  const session = favoriteSession(resolved.share, resolved.sessionId);
  if (!session.ok) {
    return session;
  }

  await repository.removeFavorite(session.sessionId, photoId);

  return {
    ok: true,
    favorites: {
      photoIds: await repository.listFavoritePhotoIds(resolved.share, session.sessionId),
    },
  };
}
