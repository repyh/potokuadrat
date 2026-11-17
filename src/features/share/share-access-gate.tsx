"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { GalleryAccess } from "@/contracts/share";
import { Button, Field, Input } from "@/components/ui";

export interface ShareAccessGateProps {
  slug: string;
  access: Exclude<GalleryAccess, "ok">;
  initialToken?: string | null;
}

interface GatePanelProps {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}

function GatePanel({ eyebrow, title, description, children }: GatePanelProps) {
  return (
    <div className="auth-page">
      <section className="auth-panel" aria-labelledby="share-gate-heading">
        <p className="hero-eyebrow">{eyebrow}</p>
        <h1 id="share-gate-heading">{title}</h1>
        <p className="auth-lede">{description}</p>
        {children}
      </section>
    </div>
  );
}

export function ShareAccessGate({
  slug,
  access,
  initialToken = null,
}: ShareAccessGateProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(initialToken ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoRedeemedRef = useRef(false);

  const postUnlock = useCallback(
    async (
      endpoint: "access" | "magic",
      payload: Record<string, string>,
      fallbackError: string,
      replaceToCleanUrl: boolean,
    ) => {
      setSubmitting(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/share/${encodeURIComponent(slug)}/${endpoint}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          },
        );

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          setError(body?.error ?? fallbackError);
          return;
        }

        if (replaceToCleanUrl) {
          router.replace(`/s/${encodeURIComponent(slug)}`);
        }
        router.refresh();
      } catch {
        setError("Unable to verify access right now. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [router, slug],
  );

  const redeemMagicToken = useCallback(
    async (rawToken: string) => {
      const trimmed = rawToken.trim();
      if (!trimmed) {
        setError("Enter the link token.");
        return;
      }

      await postUnlock(
        "magic",
        { token: trimmed },
        "This link is invalid or already used.",
        true,
      );
    },
    [postUnlock],
  );

  useEffect(() => {
    if (
      access === "magic_link_required" &&
      !autoRedeemedRef.current &&
      initialToken &&
      initialToken.trim().length >= 10
    ) {
      autoRedeemedRef.current = true;
      void redeemMagicToken(initialToken);
    }
  }, [access, initialToken, redeemMagicToken]);

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) {
      return;
    }

    await postUnlock("access", { password }, "Incorrect password.", false);
  };

  const handleMagicSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) {
      return;
    }

    await redeemMagicToken(token);
  };

  if (access === "password_required") {
    return (
      <GatePanel
        eyebrow="Protected folio"
        title="Enter share password"
        description="This photographic folio is protected by the organizer. Enter the password you were given to open the album."
      >
        <form onSubmit={handlePasswordSubmit} className="auth-form" noValidate>
          <Field label="Password" htmlFor="share-password" error={error ?? undefined}>
            <Input
              id="share-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoFocus
              required
              disabled={submitting}
              invalid={Boolean(error)}
              placeholder="Enter password"
            />
          </Field>

          <Button type="submit" variant="primary" loading={submitting}>
            Unlock album
          </Button>
        </form>
      </GatePanel>
    );
  }

  if (access === "magic_link_required") {
    return (
      <GatePanel
        eyebrow="Personal invitation"
        title="Unlock with your invitation"
        description="This folio requires a personal one-time invitation token. Open the link from your invitation or paste your token below."
      >
        <form onSubmit={handleMagicSubmit} className="auth-form" noValidate>
          <Field
            label="Invitation token"
            htmlFor="share-magic-token"
            error={error ?? undefined}
          >
            <Input
              id="share-magic-token"
              type="text"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              required
              disabled={submitting}
              invalid={Boolean(error)}
              placeholder="Paste invitation token"
            />
          </Field>

          <Button type="submit" variant="primary" loading={submitting}>
            Open folio
          </Button>
        </form>
      </GatePanel>
    );
  }

  if (access === "expired") {
    return (
      <GatePanel
        eyebrow="Share expired"
        title="This share link has expired"
        description="The viewing window for this folio has closed. Contact the photographer or organizer if you need an updated link."
      >
        <p className="auth-note">
          <Link href="/">Return to Potokuadrat</Link>
        </p>
      </GatePanel>
    );
  }

  return (
    <GatePanel
      eyebrow="Share unavailable"
      title="This folio is not available"
      description="This share link does not exist, has been revoked, or the album is still being prepared."
    >
      <p className="auth-note">
        <Link href="/">Return to Potokuadrat</Link>
      </p>
    </GatePanel>
  );
}
