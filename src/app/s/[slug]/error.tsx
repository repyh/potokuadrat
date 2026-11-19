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
    // Log unexpected error for diagnostics
    console.error("Gallery route error:", error);
  }, [error]);

  return (
    <div className="auth-page">
      <section className="auth-panel text-center" aria-labelledby="share-error-heading">
        <p className="hero-eyebrow">Potokuadrat Folio</p>
        <h1 id="share-error-heading">Unable to load folio</h1>
        <p className="auth-lede">
          An unexpected error occurred while preparing this photographic collection.
        </p>

        <div className="my-6 text-left">
          <Alert tone="danger" title="Rendering Error">
            {error.message || "An unknown error prevented the photographs from loading."}
          </Alert>
        </div>

        <div className="flex justify-center gap-3">
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
