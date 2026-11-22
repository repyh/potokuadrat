"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Alert, Button } from "@/components/ui";

export default function ShareError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The message stays in the server log; the visitor only gets the digest.
    console.error("Gallery route error:", error);
  }, [error]);

  return (
    <div className="auth-page">
      <section className="auth-panel" aria-labelledby="share-error-heading">
        <p className="hero-eyebrow">Potokuadrat Folio</p>
        <h1 id="share-error-heading">This folio could not be opened</h1>
        <p className="auth-lede">
          Something went wrong while preparing this collection. The photographs have not been
          changed.
        </p>

        <Alert tone="danger" title="The folio did not load">
          Try again in a moment.{" "}
          {error.digest ? (
            <>
              If it keeps failing, quote reference <code>{error.digest}</code> to the studio.
            </>
          ) : (
            "If it keeps failing, ask the studio for a fresh link."
          )}
        </Alert>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "12px",
            marginTop: "20px",
          }}
        >
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
          <Link href="/" className="ui-btn ui-btn-secondary ui-btn-md">
            Return home
          </Link>
        </div>
      </section>
    </div>
  );
}
