import type { ShareMode } from "@/contracts/share";

export type ShareAccess = "ok" | "password_required" | "expired" | "unavailable";

/**
 * Share access before any client session is considered. Password and magic-link shares
 * are closed here until the access gate exists; the media routes only serve public
 * shares for now.
 */
export function resolveShareAccess(
  share: { mode: ShareMode; expiresAt: Date | null },
  now: Date = new Date(),
): ShareAccess {
  if (share.expiresAt && share.expiresAt.getTime() <= now.getTime()) {
    return "expired";
  }

  if (share.mode === "password") {
    return "password_required";
  }

  if (share.mode === "magic_link") {
    return "unavailable";
  }

  return "ok";
}

export function statusForAccess(access: Exclude<ShareAccess, "ok">): number {
  switch (access) {
    case "expired":
      return 410;
    case "password_required":
      return 403;
    default:
      return 404;
  }
}
