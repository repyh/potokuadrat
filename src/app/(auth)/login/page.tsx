import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in — Potokuadrat",
};

export default function LoginPage() {
  return (
    <section className="auth-panel" aria-labelledby="login-heading">
      <p className="hero-eyebrow">Organizer</p>
      <h1 id="login-heading">Sign in</h1>
      <p className="auth-lede">
        Manage albums, share links, and downloads for this installation.
      </p>

      <LoginForm />

      <p className="auth-note">
        First run? <Link href="/setup">Set up the admin account</Link>.
      </p>
    </section>
  );
}
