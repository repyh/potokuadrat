"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Alert, Button, Field, Input } from "@/components/ui";
import type { GalleryAccess } from "./types";

export interface ShareAccessGateProps {
  slug: string;
  access: Exclude<GalleryAccess, "ok">;
  initialToken?: string | null;
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
      replaceUrl: boolean,
    ) => {
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/share/${encodeURIComponent(slug)}/${endpoint}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(body?.error ?? fallbackError);
          return;
        }
        if (replaceUrl) {
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
    if (!submitting) {
      await postUnlock("access", { password }, "Incorrect password.", false);
    }
  };

  const handleMagicSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!submitting) {
      await redeemMagicToken(token);
    }
  };

  if (access === "expired") {
    return (
      <main className="folio-frame bg-[var(--ground)] min-h-screen p-6 flex items-center justify-center">
        <div className="w-full max-w-md bg-[var(--paper)] border border-[var(--line)] p-8 text-center shadow-lg">
          <p className="hero-eyebrow">Potokuadrat Folio</p>
          <h1 className="font-[var(--font-display)] text-2xl text-[var(--ink)] mb-4">
            Link Expired
          </h1>
          <Alert tone="warning" title="Access Closed">
            This share link has expired. Please contact the event organizer or
            photographer to request a fresh invitation.
          </Alert>
        </div>
      </main>
    );
  }

  if (access === "password_required") {
    return (
      <main className="folio-frame bg-[var(--ground)] min-h-screen p-6 flex items-center justify-center">
        <div className="w-full max-w-md bg-[var(--paper)] border border-[var(--line)] p-8 shadow-lg">
          <p className="hero-eyebrow text-center">Potokuadrat Folio</p>
          <h1 className="font-[var(--font-display)] text-2xl text-[var(--ink)] mb-3 text-center">
            Protected Folio
          </h1>
          <p className="text-xs text-[var(--quiet)] mb-6 text-center">
            Enter the client passcode provided by your photographer to view this
            collection.
          </p>
          <form onSubmit={handlePasswordSubmit} className="space-y-4" noValidate>
            <Field label="Passcode" htmlFor="share-password" error={error ?? undefined}>
              <Input
                id="share-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                disabled={submitting}
                invalid={Boolean(error)}
                placeholder="Enter password…"
              />
            </Field>
            <Button type="submit" variant="primary" loading={submitting} className="w-full">
              Unlock Collection
            </Button>
          </form>
        </div>
      </main>
    );
  }

  if (access === "magic_link_required") {
    return (
      <main className="folio-frame bg-[var(--ground)] min-h-screen p-6 flex items-center justify-center">
        <div className="w-full max-w-md bg-[var(--paper)] border border-[var(--line)] p-8 shadow-lg">
          <p className="hero-eyebrow text-center">Potokuadrat Folio</p>
          <h1 className="font-[var(--font-display)] text-2xl text-[var(--ink)] mb-3 text-center">
            Private Magic Link Required
          </h1>
          <p className="text-xs text-[var(--quiet)] mb-6 text-center">
            This collection is private. Open the invitation link sent to your email or
            paste your invitation token below.
          </p>
          <form onSubmit={handleMagicSubmit} className="space-y-4" noValidate>
            <Field
              label="Invitation token"
              htmlFor="share-magic-token"
              error={error ?? undefined}
            >
              <Input
                id="share-magic-token"
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                disabled={submitting}
                invalid={Boolean(error)}
                placeholder="Paste invitation token…"
              />
            </Field>
            <Button type="submit" variant="primary" loading={submitting} className="w-full">
              Open Folio
            </Button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="folio-frame bg-[var(--ground)] min-h-screen p-6 flex items-center justify-center">
      <div className="w-full max-w-md bg-[var(--paper)] border border-[var(--line)] p-8 text-center shadow-lg">
        <p className="hero-eyebrow">Potokuadrat Folio</p>
        <h1 className="font-[var(--font-display)] text-2xl text-[var(--ink)] mb-4">
          Folio Unavailable
        </h1>
        <Alert tone="neutral" title="Unavailable">
          This share link is unavailable or has been revoked.
        </Alert>
      </div>
    </main>
  );
}
