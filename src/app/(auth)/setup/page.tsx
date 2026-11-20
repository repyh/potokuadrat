import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { count } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";

import { SetupForm } from "./setup-form";

export const metadata: Metadata = {
  title: "Set up — Potokuadrat",
};

export const instant = false;

export default async function SetupPage() {
  // Setup depends on the current user count, so it is always request-time.
  await connection();

  const [row] = await getDb().select({ value: count() }).from(users);
  if (Number(row?.value ?? 0) > 0) {
    redirect("/login");
  }

  return (
    <section className="auth-panel" aria-labelledby="setup-heading">
      <p className="hero-eyebrow">First run</p>
      <h1 id="setup-heading">Set up Potokuadrat</h1>
      <p className="auth-lede">
        Create the organization and the first admin account. This page closes as soon
        as an account exists.
      </p>

      <SetupForm />

      <p className="auth-note">
        Already set up? <Link href="/login">Sign in</Link>.
      </p>
    </section>
  );
}
