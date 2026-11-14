import type { PhotoOrientation } from "@/contracts/album";

/**
 * Square photos count as landscape, matching the gallery filters. Missing dimensions
 * stay unknown instead of being silently forced into a filter.
 */
export function orientationFor(
  width: number | null | undefined,
  height: number | null | undefined,
): PhotoOrientation {
  if (!width || !height) {
    return "unknown";
  }
  return width >= height ? "landscape" : "portrait";
}
