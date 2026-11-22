"use client";

import { useEffect } from "react";

import { Alert, Button } from "@/components/ui";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The message stays in the server log; the visitor only gets the digest.
    console.error("Admin route error:", error);
  }, [error]);

  return (
    <section className="admin-page" aria-labelledby="admin-error-heading">
      <header className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Organizer</p>
          <h1 id="admin-error-heading">Dashboard unavailable</h1>
          <p className="auth-lede">
            The organizer dashboard could not finish loading. Nothing was changed.
          </p>
        </div>
      </header>

      <Alert tone="danger" title="The dashboard did not load">
        Try again in a moment.{" "}
        {error.digest ? (
          <>
            If it keeps failing, quote reference <code>{error.digest}</code>.
          </>
        ) : (
          "If it keeps failing, the server log has the details."
        )}
      </Alert>

      <div style={{ marginTop: "20px" }}>
        <Button variant="primary" onClick={reset}>
          Reload dashboard
        </Button>
      </div>
    </section>
  );
}
