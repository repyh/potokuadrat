import "server-only";

import { count } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { getDb } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { users } from "@/server/db/schema";

const MIN_SECRET_LENGTH = 32;

function readSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `BETTER_AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters. Generate one with: openssl rand -base64 32`,
    );
  }
  return secret;
}

export function createAuth() {
  return betterAuth({
    appName: "Potokuadrat",
    secret: readSecret(),
    baseURL: process.env.BETTER_AUTH_URL?.trim() || undefined,
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema,
      usePlural: true,
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "member",
          // Clients may never set their own role.
          input: false,
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          // Potokuadrat has no public sign-up: only the first-run setup may create a
          // user. Invitations will get their own admin-guarded path.
          before: async () => {
            const [row] = await getDb().select({ value: count() }).from(users);
            return Number(row?.value ?? 0) === 0;
          },
        },
      },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 30,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 300, max: 3 },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

let auth: Auth | null = null;

/** Lazily built so builds and static pages never need database credentials. */
export function getAuth(): Auth {
  auth ??= createAuth();
  return auth;
}
