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

const REDIRECT_BASE = "http://internal";

/**
 * Only same-origin paths may be used as a post-login destination. Parsing with a
 * base URL rejects protocol-relative, absolute, and backslash-smuggled targets,
 * which a prefix check alone misses.
 */
function safeRedirectPath(raw: FormDataEntryValue | null): string {
  if (typeof raw !== "string") {
    return "/admin";
  }
  const candidate = raw.trim();
  if (!candidate.startsWith("/")) {
    return "/admin";
  }
  try {
    const target = new URL(candidate, REDIRECT_BASE);
    if (target.origin !== REDIRECT_BASE || target.pathname.startsWith("//")) {
      return "/admin";
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/admin";
  }
}

/** Request headers carrying the session cookie just issued by sign-in. */
function requestHeadersFromSignIn(headers: Headers): Headers | null {
  const cookie = headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");
  return cookie ? new Headers({ cookie }) : null;
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
    const { headers: signInHeaders, response } = await getAuth().api.signInEmail({
      body: {
        email: parsed.data.email.toLowerCase(),
        password: parsed.data.password,
      },
      returnHeaders: true,
    });

    if (response.user.role !== "admin") {
      // Sign-in has already issued a session; revoke it so a rejected account is
      // not left signed in. nextCookies clears the cookie when sign-out responds.
      const sessionHeaders = requestHeadersFromSignIn(signInHeaders);
      if (sessionHeaders) {
        await getAuth().api.signOut({ headers: sessionHeaders });
      }
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
