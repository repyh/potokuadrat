import { randomBytes } from "node:crypto";

const MAX_BASE_LENGTH = 48;

/** Readable album slug with a short random suffix to keep it unique. */
export function createAlbumSlug(title: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_BASE_LENGTH)
    .replace(/-+$/g, "");

  return `${base || "album"}-${randomBytes(4).toString("hex")}`;
}
