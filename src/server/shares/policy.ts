export type DownloadQuality = "original" | "web";

export type ShareMode = "public" | "password" | "magic_link";

export interface ShareAccess {
  mode: ShareMode;
  expiresAt: Date | null;
  allowDownload: boolean;
  allowedQualities: readonly DownloadQuality[];
  stripMetadata: boolean | null;
}

/** A share is active until its expiry passes; a null expiry never expires. */
export function isShareActive(
  share: Pick<ShareAccess, "expiresAt">,
  now: Date = new Date(),
): boolean {
  return share.expiresAt === null || share.expiresAt.getTime() > now.getTime();
}

export function canDownload(
  share: Pick<ShareAccess, "allowDownload" | "allowedQualities">,
  quality: DownloadQuality,
): boolean {
  return share.allowDownload && share.allowedQualities.includes(quality);
}

/**
 * Share-level policy wins when set; `null` inherits the organization setting.
 * Strip is the safe default, so an unknown organization value still strips.
 */
export function resolveStripMetadata(
  share: Pick<ShareAccess, "stripMetadata">,
  organizationStripMetadata: boolean,
): boolean {
  return share.stripMetadata ?? organizationStripMetadata;
}

export type PhotoOrientation = "landscape" | "portrait" | "unknown";

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
