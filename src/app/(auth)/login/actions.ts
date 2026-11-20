"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getAuth } from "@/server/auth/auth";

export interface LoginState {
  error?: string;
  fields?: {
    email?: string;
  };
}

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

function safeRedirectPath(raw: FormDataEntryValue | null): string {
  if (typeof raw !== "string") {
    return "/admin";
  }
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/admin";
  }
  return trimmed;
}

export async function loginAction(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const rawEmail = typeof formData.get("email") === "string" ? String(formData.get("email")).trim() : "";
  const parsed = loginSchema.safeParse({
    email: rawEmail,
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      error: "Enter your email and password.",
      fields: { email: rawEmail },
    };
  }

  try {
    const result = await getAuth().api.signInEmail({
      body: {
        email: parsed.data.email.toLowerCase(),
        password: parsed.data.password,
      },
    });

    if ((result.user as { role?: string }).role !== "admin") {
      return {
        error: "This account does not have organizer access.",
        fields: { email: parsed.data.email },
      };
    }
  } catch {
    // Same message for unknown email, wrong password, and rate limiting.
    return {
      error: "Invalid email or password.",
      fields: { email: parsed.data.email },
    };
  }

  redirect(safeRedirectPath(formData.get("redirectTo")));
}
