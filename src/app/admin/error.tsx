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
    console.error("Admin route error:", error);
  }, [error]);

  return (
    <section className="admin-section" aria-labelledby="admin-error-heading">
      <p className="hero-eyebrow">Organizer</p>
      <h1 id="admin-error-heading">Dashboard Error</h1>
      <p className="auth-lede">
        An error occurred while communicating with the administrative services.
      </p>

      <div className="my-6">
        <Alert tone="danger" title="Service Error">
          {error.message || "An unexpected error occurred in the organizer portal."}
        </Alert>
      </div>

      <Button variant="primary" onClick={reset}>
        Reload dashboard
      </Button>
    </section>
  );
}
