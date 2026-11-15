import { z } from "zod";

import { DOWNLOAD_QUALITIES, SHARE_MODES } from "@/contracts/share";

const expiresAtSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid expiry date.")
  .nullable()
  .optional();

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

const qualitiesSchema = z
  .array(z.enum(DOWNLOAD_QUALITIES))
  .min(1, "Allow at least one download quality.")
  .max(DOWNLOAD_QUALITIES.length)
  .refine((values) => new Set(values).size === values.length, "Qualities must be unique.");

const photoIdsSchema = z
  .array(z.string().uuid("Photo ids must be UUIDs."))
  .max(5000, "A share can hold at most 5000 photos.")
  .nullable();

export const createShareSchema = z
  .object({
    mode: z.enum(SHARE_MODES),
    expiresAt: expiresAtSchema,
    allowDownload: z.boolean().optional(),
    allowedQualities: qualitiesSchema.optional(),
    stripMetadata: z.boolean().nullable().optional(),
    branding: brandingSchema,
    password: z
      .string()
      .min(8, "Use at least 8 characters for the share password.")
      .max(200)
      .optional(),
    photoIds: photoIdsSchema.optional(),
    recipients: z.array(z.string().trim().email("Enter a valid email.")).max(50).optional(),
  })
  .strict()
  .refine((value) => value.mode !== "password" || Boolean(value.password), {
    message: "A password share needs a password.",
    path: ["password"],
  });

export const updateShareSchema = z
  .object({
    mode: z.enum(SHARE_MODES).optional(),
    expiresAt: expiresAtSchema,
    allowDownload: z.boolean().optional(),
    allowedQualities: qualitiesSchema.optional(),
    stripMetadata: z.boolean().nullable().optional(),
    branding: brandingSchema,
    password: z.string().min(8, "Use at least 8 characters.").max(200).optional(),
    photoIds: photoIdsSchema.optional(),
  })
  .strict();

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email.").max(320);
export const albumIdSchema = z.string().uuid("Album not found.");
export const shareIdSchema = z.string().uuid("Share not found.");
export const recipientIdSchema = z.string().uuid("Recipient not found.");
export const sharePhotoIdsSchema = z.array(z.string().uuid()).max(5000).nullable();
