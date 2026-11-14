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
