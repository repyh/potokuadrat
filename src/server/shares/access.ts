import type { ShareMode } from "@/contracts/share";

export type ShareAccess =
  | "ok"
  | "password_required"
  | "magic_link_required"
  | "expired"
  | "unavailable";

/**
 * Resolves share access. Expiry always wins. A password or magic-link share is only
 * `ok` when the caller presents valid proof (a signed cookie and, for magic links, a
 * live client session).
 */
export function resolveShareAccess(
  share: { mode: ShareMode; expiresAt: Date | null },
  now: Date = new Date(),
  authorized = false,
): ShareAccess {
  if (share.expiresAt && share.expiresAt.getTime() <= now.getTime()) {
    return "expired";
  }

  if (share.mode === "public" || authorized) {
    return "ok";
  }

  return share.mode === "password" ? "password_required" : "magic_link_required";
}

/** One message per access state so every route answers the same way. */
export function accessErrorMessage(access: Exclude<ShareAccess, "ok">): string {
  switch (access) {
    case "expired":
      return "Share expired.";
    case "password_required":
      return "Share requires a password.";
    case "magic_link_required":
      return "Share requires a magic link.";
    default:
      return "Share unavailable.";
  }
}

export function statusForAccess(access: Exclude<ShareAccess, "ok">): number {
  switch (access) {
    case "expired":
      return 410;
    case "password_required":
    case "magic_link_required":
      return 403;
    default:
      return 404;
  }
}
