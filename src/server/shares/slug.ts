import { randomBytes } from "node:crypto";

/**
 * Share slugs are random and unguessable, never derived from the album title, and a
 * deleted slug is never reused.
 */
export function createShareSlug(): string {
  return randomBytes(9).toString("base64url");
}
