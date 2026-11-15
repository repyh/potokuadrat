import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_VERSION = "v1";
const DEFAULT_MAX_AGE_SECONDS = 12 * 60 * 60;

function secret(): string {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) {
    throw new Error("BETTER_AUTH_SECRET is required to sign share cookies.");
  }
  return value;
}

/** One cookie per share, named from a hash so the share id is not in the cookie name. */
export function shareCookieName(shareId: string): string {
  return `pk_share_${createHash("sha256").update(shareId).digest("hex").slice(0, 16)}`;
}

function signature(shareId: string, expiresAt: number, sessionId: string): string {
  return createHmac("sha256", secret())
    .update(`${shareId}.${expiresAt}.${sessionId}`)
    .digest("base64url");
}

export interface ShareCookieOptions {
  sessionId?: string | null;
  maxAgeSeconds?: number;
  now?: Date;
}

export function createShareCookieValue(
  shareId: string,
  options: ShareCookieOptions = {},
): { value: string; maxAge: number } {
  const maxAge = options.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS;
  const expiresAt = Math.floor((options.now ?? new Date()).getTime() / 1000) + maxAge;
  const sessionId = options.sessionId ?? "-";

  return {
    value: `${COOKIE_VERSION}.${expiresAt}.${sessionId}.${signature(shareId, expiresAt, sessionId)}`,
    maxAge,
  };
}

export function verifyShareCookieValue(
  shareId: string,
  value: string,
  now: Date = new Date(),
): { sessionId: string | null } | null {
  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== COOKIE_VERSION) {
    return null;
  }

  const [, expiresRaw, sessionRaw, received] = parts;
  const expiresAt = Number(expiresRaw);
  if (!Number.isInteger(expiresAt) || expiresAt * 1000 <= now.getTime()) {
    return null;
  }

  const expected = signature(shareId, expiresAt, sessionRaw);
  const left = Buffer.from(received);
  const right = Buffer.from(expected);

  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null;
  }

  return { sessionId: sessionRaw === "-" ? null : sessionRaw };
}

export function shareCookieHeader(name: string, value: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) {
    return null;
  }

  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      return rest.join("=");
    }
  }

  return null;
}
