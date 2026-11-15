import "server-only";

import type { ShareRecord, ShareRepository } from "./repository";
import { accessErrorMessage, resolveShareAccess, statusForAccess } from "./access";
import { readCookie, shareCookieName, verifyShareCookieValue } from "./cookie";

export interface ShareAuthorization {
  authorized: boolean;
  sessionId: string | null;
}

/**
 * Reads the signed share cookie and, for magic links, confirms the client session is
 * still alive. Public shares need no proof.
 */
export async function authorizeShareRequest(
  repository: ShareRepository,
  request: Request,
  share: ShareRecord,
): Promise<ShareAuthorization> {
  if (share.mode === "public") {
    return { authorized: true, sessionId: null };
  }

  const raw = readCookie(request.headers.get("cookie"), shareCookieName(share.id));
  if (!raw) {
    return { authorized: false, sessionId: null };
  }

  const verified = verifyShareCookieValue(share.id, raw);
  if (!verified) {
    return { authorized: false, sessionId: null };
  }

  if (share.mode === "magic_link") {
    if (!verified.sessionId) {
      return { authorized: false, sessionId: null };
    }

    const session = await repository.findClientSession(share.id, verified.sessionId);
    return session
      ? { authorized: true, sessionId: session.id }
      : { authorized: false, sessionId: null };
  }

  return { authorized: true, sessionId: null };
}

export type ShareRequestResult =
  | { ok: true; share: ShareRecord; sessionId: string | null }
  | { ok: false; status: number; error: string };

/**
 * Looks up a share by slug and resolves its access for this request. The gallery data
 * routes share this entry point so expiry and proof handling cannot drift.
 */
export async function resolveShareRequest(
  repository: ShareRepository,
  request: Request,
  slug: string,
): Promise<ShareRequestResult> {
  const share = await repository.findBySlug(slug);
  if (!share) {
    return { ok: false, status: 404, error: "Share not found." };
  }

  const authorization = await authorizeShareRequest(repository, request, share);
  const access = resolveShareAccess(share, new Date(), authorization.authorized);
  if (access !== "ok") {
    return { ok: false, status: statusForAccess(access), error: accessErrorMessage(access) };
  }

  return { ok: true, share, sessionId: authorization.sessionId };
}
