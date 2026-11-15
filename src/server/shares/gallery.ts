import "server-only";

import type { Photo, PhotoPage, PhotoQuery } from "@/contracts/album";
import { PHOTO_FILTERS } from "@/contracts/album";
import { orientationFor } from "@/server/photos/orientation";

import { resolveShareRequest } from "./access-context";
import type { SharePhotoCursor, SharePhotoRow, ShareRepository } from "./repository";

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Cursors are opaque to the UI: `sort_index` plus the photo id, base64url encoded. The
 * id breaks ties so two photos never share a cursor.
 */
export function encodePhotoCursor(cursor: SharePhotoCursor): string {
  return Buffer.from(`${cursor.sortIndex}:${cursor.id}`, "utf8").toString("base64url");
}

export function decodePhotoCursor(value: string): SharePhotoCursor | null {
  let decoded: string;
  try {
    decoded = Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const parts = decoded.split(":");
  if (parts.length !== 2) {
    return null;
  }

  const [sortRaw, id] = parts;
  if (!/^\d+$/.test(sortRaw) || !UUID_PATTERN.test(id)) {
    return null;
  }

  const sortIndex = Number(sortRaw);
  return Number.isSafeInteger(sortIndex) ? { sortIndex, id } : null;
}

export interface ParsedPhotoQuery {
  filter: NonNullable<PhotoQuery["filter"]>;
  cursor: SharePhotoCursor | null;
  limit: number;
}

export type PhotoQueryParseResult =
  | { ok: true; query: ParsedPhotoQuery }
  | { ok: false; error: string };

export function parsePhotoQuery(searchParams: URLSearchParams): PhotoQueryParseResult {
  const filterRaw = searchParams.get("filter") ?? "all";
  if (!PHOTO_FILTERS.includes(filterRaw as ParsedPhotoQuery["filter"])) {
    return { ok: false, error: "Unsupported photo filter." };
  }
  const filter = filterRaw as ParsedPhotoQuery["filter"];

  const limitRaw = searchParams.get("limit");
  let limit = DEFAULT_PAGE_SIZE;
  if (limitRaw !== null) {
    const parsed = Number(limitRaw);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return { ok: false, error: "Limit must be a positive integer." };
    }
    // A large limit is clamped instead of rejected; the client still gets a page.
    limit = Math.min(parsed, MAX_PAGE_SIZE);
  }

  const cursorRaw = searchParams.get("cursor");
  let cursor: SharePhotoCursor | null = null;
  if (cursorRaw) {
    cursor = decodePhotoCursor(cursorRaw);
    if (!cursor) {
      return { ok: false, error: "Invalid photo cursor." };
    }
  }

  return { ok: true, query: { filter, cursor, limit } };
}

export function toPhoto(row: SharePhotoRow): Photo {
  return {
    id: row.id,
    name: row.name,
    width: row.width,
    height: row.height,
    bytes: row.bytes,
    orientation: orientationFor(row.width, row.height),
    thumbStatus: row.thumbStatus,
    takenAt: row.takenAt ? row.takenAt.toISOString() : null,
    sortIndex: row.sortIndex,
  };
}

export type ShareGalleryResult =
  | { ok: true; page: PhotoPage }
  | { ok: false; status: number; error: string };

/**
 * Authorized gallery page for a share. Favorites live in the magic-link session; public
 * and password shares keep them in the browser and must not ask the server.
 */
export async function listShareGallery(
  repository: ShareRepository,
  request: Request,
  slug: string,
  searchParams: URLSearchParams,
): Promise<ShareGalleryResult> {
  const resolved = await resolveShareRequest(repository, request, slug);
  if (!resolved.ok) {
    return resolved;
  }

  const parsed = parsePhotoQuery(searchParams);
  if (!parsed.ok) {
    return { ok: false, status: 400, error: parsed.error };
  }

  const { filter, cursor, limit } = parsed.query;
  if (filter === "favorites" && !resolved.sessionId) {
    return { ok: false, status: 400, error: "This share keeps favorites in the browser." };
  }

  const { rows, total, hasMore } = await repository.listSharePhotos(resolved.share, {
    filter,
    clientSessionId: resolved.sessionId,
    cursor,
    limit,
  });

  const last = rows.at(-1);
  return {
    ok: true,
    page: {
      photos: rows.map(toPhoto),
      nextCursor:
        hasMore && last
          ? encodePhotoCursor({ sortIndex: last.sortIndex, id: last.id })
          : null,
      total,
    },
  };
}
