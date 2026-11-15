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
