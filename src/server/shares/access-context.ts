import "server-only";

import type { ShareRecord, ShareRepository } from "./repository";
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
