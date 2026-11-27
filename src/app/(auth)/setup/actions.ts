"use server";

import { count, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getAuth } from "@/server/auth/auth";
import { getDb } from "@/server/db/client";
import { organizations, users } from "@/server/db/schema";

export interface SetupState {
  error?: string;
  fields?: {
    name?: string;
    email?: string;
    organizationName?: string;
    accent?: string;
    logo?: string;
  };
}

const setupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80, "Keep the name under 80 characters."),
  email: z.string().trim().email("Enter a valid email address.").max(254),
  password: z
    .string()
    .min(10, "Use at least 10 characters.")
    .max(128, "Keep the password under 128 characters."),
  organizationName: z
    .string()
    .trim()
    .min(2, "Enter an organization name.")
    .max(120, "Keep the organization name under 120 characters."),
  accent: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex accent color.")
    .optional(),
  logo: z
    .string()
    .trim()
    .max(2000, "Keep the logo URL under 2000 characters.")
    .optional(),
});

export async function setupAction(
  _state: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const accentRaw = typeof formData.get("accent") === "string" ? String(formData.get("accent")).trim() : "";
  const logoRaw = typeof formData.get("logo") === "string" ? String(formData.get("logo")).trim() : "";

  const rawFields = {
    name: typeof formData.get("name") === "string" ? String(formData.get("name")).trim() : "",
    email: typeof formData.get("email") === "string" ? String(formData.get("email")).trim() : "",
    organizationName:
      typeof formData.get("organizationName") === "string"
        ? String(formData.get("organizationName")).trim()
        : "",
    accent: accentRaw,
    logo: logoRaw,
  };

  const parsed = setupSchema.safeParse({
    ...rawFields,
    accent: accentRaw || undefined,
    logo: logoRaw || undefined,
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the form and try again.",
      fields: rawFields,
    };
  }

  const db = getDb();
  const [existingUser] = await db.select({ value: count() }).from(users);
  if (Number(existingUser?.value ?? 0) > 0) {
    return { error: "Setup is already complete. Sign in instead." };
  }

  const [existingOrganization] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .limit(1);

  let organizationId = existingOrganization?.id;
  if (!organizationId) {
    const [created] = await db
      .insert(organizations)
      .values({
        name: parsed.data.organizationName,
        title: parsed.data.organizationName,
        accent: parsed.data.accent ?? null,
        logo: parsed.data.logo ?? null,
      })
      .returning({ id: organizations.id });
    organizationId = created.id;
  }

  try {
    const result = await getAuth().api.signUpEmail({
      body: {
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        password: parsed.data.password,
      },
    });

    await db.update(users).set({ role: "admin" }).where(eq(users.id, result.user.id));
  } catch {
    if (!existingOrganization) {
      // Do not leave an organization behind when the admin account failed.
      await db.delete(organizations).where(eq(organizations.id, organizationId));
    }
    return {
      error: "Could not create the admin account. Check the details and try again.",
      fields: rawFields,
    };
  }

  redirect("/admin");
}
