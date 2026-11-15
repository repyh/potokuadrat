import { createHash, randomBytes } from "node:crypto";

/** Magic-link tokens are single-use and short lived. */
export const MAGIC_TOKEN_TTL_DAYS = 7;

export function createMagicToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashMagicToken(token) };
}

/** The database only ever stores this hash. */
export function hashMagicToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function magicTokenExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + MAGIC_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** Copyable link the photographer can send when SMTP is not configured. */
export function magicLinkUrl(baseUrl: string, slug: string, token: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return `${trimmed}/s/${encodeURIComponent(slug)}?token=${encodeURIComponent(token)}`;
}
