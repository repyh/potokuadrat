import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { count } from "drizzle-orm";

import { getSession } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in — Potokuadrat",
};

export const instant = false;

type PageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  await connection();

  const [session, [userCountRow], resolvedSearch] = await Promise.all([
    getSession(),
    getDb().select({ value: count() }).from(users),
    searchParams,
  ]);

  if (session?.user.role === "admin") {
    redirect("/admin");
  }

  const hasUsers = Number(userCountRow?.value ?? 0) > 0;
  const redirectTo =
    typeof resolvedSearch.next === "string" ? resolvedSearch.next : undefined;

  return (
    <section className="auth-panel" aria-labelledby="login-heading">
      <p className="hero-eyebrow">Organizer</p>
      <h1 id="login-heading">Sign in</h1>
      <p className="auth-lede">
        Manage albums, share links, and downloads for this installation.
      </p>

      <LoginForm redirectTo={redirectTo} />

      {!hasUsers && (
        <p className="auth-note">
          First run? <Link href="/setup">Set up the admin account</Link>.
        </p>
      )}
    </section>
  );
}
