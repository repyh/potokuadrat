import { z } from "zod";

export const createAlbumSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Enter an album title.")
    .max(120, "Keep the album title under 120 characters."),
  folders: z
    .array(
      z.object({
        driveFolderId: z.string().trim().min(10, "Enter a Drive folder link or id."),
        name: z.string().trim().min(1).max(200).optional(),
        recursive: z.boolean().optional(),
      }),
    )
    .min(1, "Add at least one Drive folder.")
    .max(10, "An album can use at most 10 folders."),
});

export type CreateAlbumPayload = z.infer<typeof createAlbumSchema>;
