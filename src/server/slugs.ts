import { randomBytes } from "node:crypto";

/** 128 bits of entropy, encoded as 22 URL-safe characters. */
const SHARE_SLUG_BYTES = 16;
const SHARE_SLUG_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export function createShareSlug(): string {
  return randomBytes(SHARE_SLUG_BYTES).toString("base64url");
}

export function isValidShareSlug(value: string): boolean {
  return SHARE_SLUG_PATTERN.test(value);
}
