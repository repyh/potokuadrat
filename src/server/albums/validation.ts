import { z } from "zod";

const albumFolderSchema = z.object({
  driveFolderId: z.string().trim().min(10, "Enter a Drive folder link or id."),
  name: z.string().trim().min(1).max(200).optional(),
  recursive: z.boolean().optional(),
});

const brandingSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    logo: z.string().trim().max(2000).optional(),
    accent: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex color.")
      .optional(),
    welcomeMessage: z.string().trim().max(500).optional(),
  })
  .strict()
  .nullable()
  .optional();

export const createAlbumSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Enter an album title.")
    .max(120, "Keep the album title under 120 characters."),
  folders: z
    .array(albumFolderSchema)
    .min(1, "Add at least one Drive folder.")
    .max(10, "An album can use at most 10 folders."),
});

export const updateAlbumSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "Enter an album title.")
      .max(120, "Keep the album title under 120 characters.")
      .optional(),
    branding: brandingSchema,
    folders: z
      .array(albumFolderSchema)
      .min(1, "Add at least one Drive folder.")
      .max(10, "An album can use at most 10 folders.")
      .optional(),
  })
  .strict();

export const reorderAlbumPhotosSchema = z
  .object({
    photoIds: z
      .array(z.string().uuid("Photo not found."))
      .min(1, "No photos to order.")
      .max(1000, "That is too many photos to order at once."),
  })
  .strict();

export const setAlbumCoverSchema = z
  .object({ photoId: z.string().uuid("Photo not found.").nullable() })
  .strict();

export const albumIdSchema = z.string().uuid("Album not found.");

export type CreateAlbumPayload = z.infer<typeof createAlbumSchema>;
