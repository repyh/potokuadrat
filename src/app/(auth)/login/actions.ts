"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getAuth } from "@/server/auth/auth";

export interface LoginState {
  error?: string;
}

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function loginAction(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Enter your email and password." };
  }

  try {
    await getAuth().api.signInEmail({
      body: {
        email: parsed.data.email.toLowerCase(),
        password: parsed.data.password,
      },
    });
  } catch {
    // Same message for unknown email, wrong password, and rate limiting.
    return { error: "Invalid email or password." };
  }

  redirect("/admin");
}
