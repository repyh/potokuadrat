"use client";

import Link from "next/link";
import { Alert, Button, EmptyState, Skeleton } from "@/components/ui";

export interface NoAlbumsEmptyStateProps {
  onCreateAlbum?: () => void;
}

export function NoAlbumsEmptyState({ onCreateAlbum }: NoAlbumsEmptyStateProps) {
  return (
    <EmptyState
      title="No albums in your folio yet"
      description="Link a Google Drive folder to begin indexing photographs and publishing client shares."
      action={
        onCreateAlbum ? (
          <Button variant="primary" onClick={onCreateAlbum}>
            Create your first album
          </Button>
        ) : (
          <Link href="/admin/albums/new" className="ui-btn ui-btn-primary ui-btn-md">
            Create your first album
          </Link>
        )
      }
    />
  );
}

export interface NoSharesEmptyStateProps {
  onCreateShare?: () => void;
}

export function NoSharesEmptyState({ onCreateShare }: NoSharesEmptyStateProps) {
  return (
    <EmptyState
      title="No active share links"
      description="Every album can have several guest shares (public, password-protected, or client magic links)."
      action={
        onCreateShare ? (
          <Button variant="primary" onClick={onCreateShare}>
            Generate share link
          </Button>
        ) : undefined
      }
    />
  );
}

export interface DriveAlertProps {
  status: "indexing_failed" | "folder_unshared" | "service_account_rejected";
  detail?: string;
  onRetry?: () => void;
}

export function DriveStateAlert({ status, detail, onRetry }: DriveAlertProps) {
  if (status === "indexing_failed") {
    return (
      <Alert
        tone="danger"
        title="Google Drive indexing failed"
        action={
          onRetry ? (
            <Button variant="secondary" onClick={onRetry}>
              Retry sync
            </Button>
          ) : undefined
        }
      >
        {detail ??
          "The indexing job encountered an error while scanning files. Check your folder permissions or retry."}
      </Alert>
    );
  }

  if (status === "folder_unshared") {
    return (
      <Alert tone="warning" title="Drive folder permission revoked">
        {detail ??
          "The Google Drive service account no longer has Viewer access to this album's folder. Please share the folder again."}
      </Alert>
    );
  }

  return (
    <Alert tone="danger" title="Service account authentication rejected">
      {detail ??
        "Google credentials rejected or expired. Please check GOOGLE_DRIVE_KEY_FILE in your environment configuration."}
    </Alert>
  );
}

export function AdminDashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading organizer dashboard">
      <div className="space-y-2">
        <Skeleton lines={1} height="12px" className="w-24" />
        <Skeleton lines={1} height="36px" className="w-64" />
        <Skeleton lines={1} height="16px" className="w-96" />
      </div>

      <div className="admin-grid">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="admin-card space-y-3">
            <Skeleton lines={1} height="20px" className="w-28" />
            <Skeleton lines={2} height="14px" />
          </div>
        ))}
      </div>
    </div>
  );
}
