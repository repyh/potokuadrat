import { z } from "zod";

export const organizationSettingsSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Enter an organization name.")
      .max(120, "Keep the name under 120 characters."),
    title: z.string().trim().max(120, "Keep the title under 120 characters.").nullable().optional(),
    logo: z.string().trim().max(2000, "Keep the logo URL under 2000 characters.").nullable().optional(),
    accent: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex color.")
      .nullable()
      .optional(),
    footerEnabled: z.boolean().optional(),
    stripMetadata: z.boolean().optional(),
  })
  .strict();
