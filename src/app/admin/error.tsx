"use client";

import { useEffect } from "react";

import { Alert, Button } from "@/components/ui";

/**
 * Next passes `retry` to an error boundary; it re-fetches and re-renders the
 * failed segment, which `reset` does not do. A Server Component that failed on
 * a database read only recovers through `retry`.
 */
export default function AdminError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    // The message stays in the server log; the visitor only gets the digest.
    console.error("Admin route error:", error);
  }, [error]);

  const digest =
    error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;

  return (
    <section className="admin-page" aria-labelledby="admin-error-heading">
      <header className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Organizer</p>
          <h1 id="admin-error-heading">Dashboard unavailable</h1>
          <p className="auth-lede">The organizer dashboard could not finish loading.</p>
        </div>
      </header>

      <Alert tone="danger" title="The dashboard did not load">
        Try again in a moment.{" "}
        {digest ? (
          <>
            If it keeps failing, quote reference <code>{digest}</code>.
          </>
        ) : (
          "If it keeps failing, the server log has the details."
        )}
      </Alert>

      <div style={{ marginTop: "20px" }}>
        <Button variant="primary" onClick={retry}>
          Reload dashboard
        </Button>
      </div>
    </section>
  );
}
