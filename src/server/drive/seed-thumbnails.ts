const SEED_PHOTO_PATTERN = /^seed-photo-(\d{2})$/;

const PALETTE = [
  ["#183c34", "#d9ef63"],
  ["#2f4f46", "#e9eee2"],
  ["#3a5d6c", "#f8f8f0"],
  ["#6b4f3a", "#efe6c9"],
  ["#4b5b49", "#dce6d3"],
  ["#23324a", "#c6d0c3"],
] as const;

export interface SeedThumbnail {
  body: Buffer;
  contentType: "image/svg+xml";
  etag: string;
}

/**
 * Development-only placeholder for the seeded album. It keeps the gallery usable
 * without Google credentials. Never enabled in a production build.
 */
export function isSeedMedia(driveFileId: string): boolean {
  return process.env.NODE_ENV !== "production" && SEED_PHOTO_PATTERN.test(driveFileId);
}

export function seedThumbnail(
  driveFileId: string,
  width: number,
  portrait = false,
): SeedThumbnail | null {
  if (!isSeedMedia(driveFileId)) {
    return null;
  }

  const match = driveFileId.match(SEED_PHOTO_PATTERN);
  if (!match) {
    return null;
  }

  const index = Number(match[1]);
  const [background, ink] = PALETTE[(index - 1) % PALETTE.length];
  const viewWidth = portrait ? 300 : 400;
  const viewHeight = portrait ? 400 : 300;
  const label = `Seed ${match[1]}`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${Math.round(
    (width * viewHeight) / viewWidth,
  )}" viewBox="0 0 ${viewWidth} ${viewHeight}" role="img" aria-label="${label}">
  <rect width="${viewWidth}" height="${viewHeight}" fill="${background}"/>
  <rect x="22" y="22" width="${viewWidth - 44}" height="${viewHeight - 44}" fill="none" stroke="${ink}" stroke-opacity="0.45" stroke-width="2"/>
  <circle cx="${viewWidth / 2}" cy="${viewHeight / 2 - 12}" r="${viewWidth / 6}" fill="${ink}" fill-opacity="0.22"/>
  <text x="30" y="${viewHeight - 30}" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="${ink}" fill-opacity="0.85">${label}</text>
</svg>`;

  return {
    body: Buffer.from(svg),
    contentType: "image/svg+xml",
    etag: `"seed-${driveFileId}-${width}"`,
  };
}
