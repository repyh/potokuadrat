"use client";

import { useState } from "react";
import type { AlbumIndexProgress, AlbumStatus } from "@/contracts/album";
import { Alert, Button, ProgressBar } from "@/components/ui";

export interface AlbumSyncCardProps {
  albumId: string;
  driveFolderId: string;
  folderName?: string;
  status: AlbumStatus;
  progress?: AlbumIndexProgress;
  onReindexTriggered?: () => void;
}

export const ALBUM_STATUS_STYLES: Record<AlbumStatus, { badge: string; label: string }> = {
  ready: { badge: "bg-[#dcfce7] text-[#15803d] border-[#15803d]", label: "Synced & Ready" },
  indexing: { badge: "bg-[#fef3c7] text-[#b45309] border-[#b45309]", label: "Indexing in progress…" },
  failed: { badge: "bg-[#fee2e2] text-[#b91c1c] border-[#b91c1c]", label: "Indexing Failed" },
};

export function getAlbumSyncBadge(status: AlbumStatus) {
  return ALBUM_STATUS_STYLES[status];
}

export function AlbumSyncCard({
  albumId,
  driveFolderId,
  folderName,
  status,
  progress,
  onReindexTriggered,
}: AlbumSyncCardProps) {
  const [reindexing, setReindexing] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "danger"; message: string } | null>(
    null,
  );

  const handleReindex = async (mode: "full" | "incremental" = "incremental") => {
    if (reindexing) return;
    setReindexing(true);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/admin/albums/${encodeURIComponent(albumId)}/reindex?mode=${mode}`,
        { method: "POST" },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setFeedback({
          tone: "danger",
          message: body?.error ?? "Failed to trigger re-indexing job.",
        });
        return;
      }

      setFeedback({
        tone: "success",
        message: "Re-indexing job queued successfully in background worker.",
      });

      if (onReindexTriggered) {
        onReindexTriggered();
      }
    } catch {
      setFeedback({
        tone: "danger",
        message: "Network error triggering re-indexing job.",
      });
    } finally {
      setReindexing(false);
    }
  };

  const currentBadge = getAlbumSyncBadge(status);

  return (
    <article className="admin-card space-y-4" aria-labelledby="drive-sync-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[10px] tracking-wider uppercase font-bold text-[var(--quiet)]">
            Google Drive Connection
          </span>
          <h2 id="drive-sync-heading" className="text-lg font-bold text-[var(--ink)]">
            {folderName || "Linked Folder"}
          </h2>
          <p className="font-mono text-xs text-[var(--quiet)] mt-0.5">ID: {driveFolderId}</p>
        </div>

        <span
          className={`px-2.5 py-1 text-xs font-bold border uppercase tracking-wider ${currentBadge.badge}`}
        >
          {currentBadge.label}
        </span>
      </div>

      {progress && progress.total > 0 && (
        <div className="py-2 border-t border-b border-[var(--line)]">
          <ProgressBar
            label="Photo Processing"
            value={progress.ready}
            max={progress.total}
            unitLabel="photos"
          />
          <div className="flex justify-between text-[11px] font-mono text-[var(--quiet)] mt-1.5">
            <span>Ready: {progress.ready}</span>
            <span>Pending: {progress.pending}</span>
            {progress.failed > 0 && <span className="text-[#b91c1c]">Failed: {progress.failed}</span>}
          </div>
        </div>
      )}

      {feedback && (
        <Alert tone={feedback.tone} title={feedback.tone === "success" ? "Sync Queued" : "Sync Error"}>
          {feedback.message}
        </Alert>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="button"
          variant="primary"
          loading={reindexing}
          disabled={status === "indexing" || reindexing}
          onClick={() => void handleReindex("incremental")}
        >
          Re-index now
        </Button>
        <Button
          type="button"
          variant="secondary"
          loading={reindexing}
          disabled={status === "indexing" || reindexing}
          onClick={() => void handleReindex("full")}
        >
          Full re-scan
        </Button>
      </div>
    </article>
  );
}
