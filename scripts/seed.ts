/**
 * Development seed: an organization, an admin, one ready album backed by Unsplash
 * photographs, and the share variants the UI needs to build states.
 *
 * Run with `npm run db:seed` after `npm run db:migrate`.
 */
import { createHash } from "node:crypto";

import { config } from "dotenv";
import { eq } from "drizzle-orm";

config({ path: ".env.local" });
config();

import { getAuth } from "@/server/auth/auth";
import { closeDb, getDb } from "@/server/db/client";
import { SEED_PHOTOS } from "@/server/drive/seed-photos";
import { warmSeedMedia } from "@/server/drive/seed-media";
import {
  albumFolders,
  albums,
  clientSessions,
  driveFolders,
  favorites,
  organizations,
  photos,
  shareRecipients,
  shares,
  users,
  viewEvents,
} from "@/server/db/schema";

const SEED_ALBUM_SLUG = "seed-gallery";
const SEED_FOLDER_ID = "seed-folder-0001";
const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@potokuadrat.local";
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "potokuadrat-seed";
const SEED_SHARE_PASSWORD = "seed-pass-123";
const SEED_RECIPIENT_EMAIL = "guest@example.com";
const SEED_MAGIC_TOKEN = "seed-magic-token";
const PHOTO_COUNT = SEED_PHOTOS.length;
const WARM_WIDTHS = [400, 1600, 2048] as const;

const db = getDb();

async function ensureOrganization() {
  const [existing] = await db.select().from(organizations).limit(1);
  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(organizations)
    .values({ name: "Atelier Kusuma", title: "Atelier Kusuma" })
    .returning();
  return created;
}

async function ensureAdmin(): Promise<{ id: string }> {
  const [existingAdmin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);
  if (existingAdmin) {
    return existingAdmin;
  }

  const [anyUser] = await db.select({ id: users.id }).from(users).limit(1);
  if (anyUser) {
    await db.update(users).set({ role: "admin" }).where(eq(users.id, anyUser.id));
    return anyUser;
  }

  const result = await getAuth().api.signUpEmail({
    body: {
      name: "Seed Admin",
      email: SEED_ADMIN_EMAIL,
      password: SEED_ADMIN_PASSWORD,
    },
  });

  await db.update(users).set({ role: "admin" }).where(eq(users.id, result.user.id));
  return { id: result.user.id };
}

async function main() {
  await ensureOrganization();
  const admin = await ensureAdmin();

  // Rebuild only the seed album; cascades remove its photos and shares.
  await db.delete(albums).where(eq(albums.slug, SEED_ALBUM_SLUG));

  const [folder] = await db
    .insert(driveFolders)
    .values({
      driveFolderId: SEED_FOLDER_ID,
      name: "Seed Folder (local)",
      ownerUserId: admin.id,
      recursive: false,
    })
    .onConflictDoUpdate({
      target: driveFolders.driveFolderId,
      set: { name: "Seed Folder (local)" },
    })
    .returning();

  const [album] = await db
    .insert(albums)
    .values({
      ownerUserId: admin.id,
      slug: SEED_ALBUM_SLUG,
      title: "Seed Gallery",
      status: "ready",
    })
    .returning();

  await db.insert(albumFolders).values({
    albumId: album.id,
    driveFolderId: folder.id,
    position: 0,
  });

  const photoRows = SEED_PHOTOS.map((photo, index) => ({
    albumId: album.id,
    driveFileId: photo.driveFileId,
    name: photo.name,
    mimeType: "image/jpeg",
    width: photo.width,
    height: photo.height,
    bytes: 2_000_000 + index * 10_000,
    takenAt: new Date(Date.UTC(2026, 9, 1 + index, 10, 0, 0)),
    driveModifiedAt: new Date(Date.UTC(2026, 10, 1, 10, 0, 0)),
    sortIndex: index,
    thumbStatus: "ready" as const,
  }));

  const insertedPhotos = await db
    .insert(photos)
    .values(photoRows)
    .returning({ id: photos.id });

  // The dashboard needs a cover state without any extra setup.
  if (insertedPhotos[0]) {
    await db
      .update(albums)
      .set({ coverPhotoId: insertedPhotos[0].id })
      .where(eq(albums.id, album.id));
  }

  // Warm the media cache so the first gallery view needs no network. A failure only
  // warns: the media routes still fetch lazily for whatever is missing.
  if (process.env.SEED_SKIP_MEDIA === "1") {
    console.log("Skipping Unsplash warm-up (SEED_SKIP_MEDIA=1).");
  } else {
    const mediaDir = process.env.SEED_MEDIA_DIR?.trim() || ".cache/seed";
    const warmed = await warmSeedMedia(WARM_WIDTHS);
    console.log(`  media:  ${warmed.fetched} files cached in ${mediaDir}`);
    for (const failure of warmed.failed) {
      console.warn(
        `  media warning: ${failure.driveFileId} @${failure.width}px — ${failure.error}`,
      );
    }
  }

  const { hashPassword } = await import("better-auth/crypto");
  const passwordHash = await hashPassword(SEED_SHARE_PASSWORD);

  const insertedShares = await db
    .insert(shares)
    .values([
      {
        albumId: album.id,
        slug: "seed-public",
        mode: "public",
        allowDownload: true,
        allowedQualities: ["original", "web"],
      },
      {
        albumId: album.id,
        slug: "seed-password",
        mode: "password",
        passwordHash,
        allowDownload: true,
        allowedQualities: ["web"],
      },
      {
        albumId: album.id,
        slug: "seed-expired",
        mode: "public",
        allowDownload: false,
        allowedQualities: ["web"],
        expiresAt: new Date("2026-01-01T00:00:00Z"),
      },
      {
        albumId: album.id,
        slug: "seed-expiring",
        mode: "public",
        allowDownload: false,
        allowedQualities: ["web"],
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      },
      {
        albumId: album.id,
        slug: "seed-magic",
        mode: "magic_link",
        allowDownload: true,
        allowedQualities: ["original", "web"],
      },
    ])
    .returning({ id: shares.id, slug: shares.slug });

  const shareIdBySlug = new Map(insertedShares.map((share) => [share.slug, share.id]));

  // Visit fixtures so the organizer dashboard has non-zero counts. Recording views
  // from the gallery is a separate backend feature; this only seeds the shape.
  const HOUR = 60 * 60 * 1000;
  const viewFixtures: Array<{ slug: string; count: number }> = [
    { slug: "seed-public", count: 24 },
    { slug: "seed-password", count: 9 },
    { slug: "seed-magic", count: 4 },
  ];

  await db.insert(viewEvents).values(
    viewFixtures.flatMap(({ slug, count }) => {
      const shareId = shareIdBySlug.get(slug);
      if (!shareId) {
        return [];
      }
      return Array.from({ length: count }, (_, index) => ({
        shareId,
        visitorHash: createHash("sha256").update(`${slug}-visitor-${index}`).digest("hex"),
        createdAt: new Date(Date.now() - (index * 6 + 1) * HOUR),
      }));
    }),
  );

  const magicShareId = shareIdBySlug.get("seed-magic");
  if (!magicShareId) {
    throw new Error("Seed shares were not created.");
  }

  await db.insert(shareRecipients).values({
    shareId: magicShareId,
    email: SEED_RECIPIENT_EMAIL,
    tokenHash: createHash("sha256").update(SEED_MAGIC_TOKEN).digest("hex"),
  });

  const [clientSession] = await db
    .insert(clientSessions)
    .values({
      shareId: magicShareId,
      email: SEED_RECIPIENT_EMAIL,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    .returning({ id: clientSessions.id });

  await db.insert(favorites).values(
    insertedPhotos.slice(0, 3).map((photo) => ({
      clientSessionId: clientSession.id,
      photoId: photo.id,
    })),
  );

  console.log("Seed data ready:");
  console.log(`  admin:  ${SEED_ADMIN_EMAIL} / ${SEED_ADMIN_PASSWORD}`);
  console.log(`  album:  ${SEED_ALBUM_SLUG} (${PHOTO_COUNT} photos, status ready)`);
  console.log("  shares: seed-public, seed-password, seed-expired, seed-expiring, seed-magic");
  console.log("  visits: 24 public · 9 password · 4 magic");
  console.log(`  share password: ${SEED_SHARE_PASSWORD}`);
  console.log(`  magic-link recipient: ${SEED_RECIPIENT_EMAIL} / ${SEED_MAGIC_TOKEN}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
