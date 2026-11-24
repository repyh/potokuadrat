import type { Photo, PhotoFilter, PhotoPage } from "@/contracts/album";
import type { ShareMode } from "@/contracts/share";

export type PhotoPageFetcher = (cursor: string) => Promise<PhotoPage>;

/**
 * Loads every remaining page for a public/password share. Favorites are kept in the
 * browser for those modes, so the whole album must be present before the filter runs.
 * Photos are deduplicated by id in case a page boundary overlaps.
 */
export async function loadAllRemainingPhotos(
  initialPage: PhotoPage,
  fetchPage: PhotoPageFetcher,
): Promise<Photo[]> {
  const photos: Photo[] = [];
  const seen = new Set<string>();

  const append = (pagePhotos: Photo[]) => {
    for (const photo of pagePhotos) {
      if (!seen.has(photo.id)) {
        seen.add(photo.id);
        photos.push(photo);
      }
    }
  };

  append(initialPage.photos);
  let cursor = initialPage.nextCursor;

  while (cursor) {
    const page = await fetchPage(cursor);
    append(page.photos);
    cursor = page.nextCursor;
  }

  return photos;
}

/** Counts loaded photos that are in the local favorite set. */
export function countFavorites(
  photos: Photo[],
  favoriteIds: ReadonlySet<string>,
): number {
  let total = 0;

  for (const photo of photos) {
    if (favoriteIds.has(photo.id)) {
      total += 1;
    }
  }

  return total;
}

/**
 * The denominator for "Showing X of Y". Favorites on public/password shares are
 * filtered in the browser, so their total is the current favorite count. Magic-link
 * favorites use the server total, which the gallery updates when a favorite is removed.
 */
export function resolveGalleryTotal(input: {
  filter: PhotoFilter;
  mode: ShareMode;
  serverTotal: number;
  favoriteCount: number;
}): number {
  if (input.filter !== "favorites") {
    return input.serverTotal;
  }

  return input.mode === "magic_link" ? input.serverTotal : input.favoriteCount;
}
