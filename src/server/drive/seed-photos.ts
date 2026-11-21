/**
 * Photographs for the development seed album.
 *
 * Fixed Unsplash ids keep the seed deterministic. The media routes crop every photo
 * to the dimensions stored on its row, so the gallery grid always gets the aspect
 * ratio it laid out for. Sources and licence notes: `docs/seed-photos.md`.
 */
export interface SeedPhoto {
  /** Drive-shaped id the media routes recognise as seed media. */
  driveFileId: string;
  /** Unsplash image path, e.g. `photo-1506905925346-21bda4d32df4`. */
  unsplashId: string;
  name: string;
  width: number;
  height: number;
}

interface SeedPhotoSource {
  unsplashId: string;
  name: string;
}

const LANDSCAPE = { width: 6000, height: 4000 } as const;
const PORTRAIT = { width: 4000, height: 6000 } as const;

/**
 * Travel and landscape set. Portrait slots reuse the same index pattern the seed
 * used before (`index % 3 === 2`), so the grid keeps its landscape/portrait rhythm.
 */
const SOURCES: readonly SeedPhotoSource[] = [
  { unsplashId: "photo-1506905925346-21bda4d32df4", name: "Alpine Lake at First Light.jpg" },
  { unsplashId: "photo-1441974231531-c6227db76b6e", name: "Forest Canopy.jpg" },
  { unsplashId: "photo-1470770841072-f978cf4d019e", name: "Still Water, Dolomites.jpg" },
  { unsplashId: "photo-1501785888041-af3ef285b470", name: "Lake and Pine Ridge.jpg" },
  { unsplashId: "photo-1469474968028-56623f02e42e", name: "Sunrise over the Range.jpg" },
  { unsplashId: "photo-1470071459604-3b5ec3a7fe05", name: "Fog on the Ridge.jpg" },
  { unsplashId: "photo-1500534314209-a25ddb2bd429", name: "Desert Road.jpg" },
  { unsplashId: "photo-1500530855697-b586d89ba3ee", name: "High Country.jpg" },
  { unsplashId: "photo-1507525428034-b723cf961d3e", name: "Turquoise Shore.jpg" },
  { unsplashId: "photo-1519046904884-53103b34b206", name: "Palm Coast.jpg" },
  { unsplashId: "photo-1493558103817-58b2924bce98", name: "Snowline.jpg" },
  { unsplashId: "photo-1482938289607-e9573fc25ebb", name: "Canyon River.jpg" },
  { unsplashId: "photo-1433086966358-54859d0ed716", name: "Waterfall Gorge.jpg" },
  { unsplashId: "photo-1447752875215-b2761acb3c5d", name: "Woodland Path.jpg" },
  { unsplashId: "photo-1426604966848-d7adac402bff", name: "Valley Meadow.jpg" },
  { unsplashId: "photo-1472396961693-142e6e269027", name: "Wild Deer at Dusk.jpg" },
  { unsplashId: "photo-1454391304352-2bf4678b1a7a", name: "Dune Line.jpg" },
  { unsplashId: "photo-1519681393784-d120267933ba", name: "Starlit Peak.jpg" },
  { unsplashId: "photo-1464822759023-fed622ff2c3b", name: "Mountain Pass.jpg" },
  { unsplashId: "photo-1454496522488-7a8e488e8606", name: "Cloud Inversion.jpg" },
  { unsplashId: "photo-1444927714506-8492d94b4e3d", name: "Lakeside Calm.jpg" },
  { unsplashId: "photo-1476514525535-07fb3b4ae5f1", name: "Reflections on the Lake.jpg" },
  { unsplashId: "photo-1505765050516-f72dcac9c60e", name: "Gravel Switchbacks.jpg" },
  { unsplashId: "photo-1488646953014-85cb44e25828", name: "Backpacker, Long Trail.jpg" },
];

export const SEED_PHOTOS: readonly SeedPhoto[] = SOURCES.map((source, index) => ({
  driveFileId: `seed-photo-${String(index + 1).padStart(2, "0")}`,
  ...source,
  ...(index % 3 === 2 ? PORTRAIT : LANDSCAPE),
}));

const BY_ID = new Map(SEED_PHOTOS.map((photo) => [photo.driveFileId, photo]));

/** The seeded photo behind a `seed-photo-NN` id, if the album defines one. */
export function seedPhotoFor(driveFileId: string): SeedPhoto | undefined {
  return BY_ID.get(driveFileId);
}
