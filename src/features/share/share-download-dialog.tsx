"use client";

import { useState } from "react";

import type { DownloadQuality, DownloadScope, ShareMode } from "@/contracts/share";
import { Alert, Button, Dialog, RadioGroup } from "@/components/ui";

export interface ShareDownloadDialogProps {
  open: boolean;
  onClose: () => void;
  slug: string;
  mode: ShareMode;
  allowedQualities: DownloadQuality[];
  totalCount: number;
  favoriteIds: string[];
}

export function ShareDownloadDialog({
  open,
  onClose,
  slug,
  mode,
  allowedQualities,
  totalCount,
  favoriteIds,
}: ShareDownloadDialogProps) {
  const defaultQuality: DownloadQuality = allowedQualities.includes("original")
    ? "original"
    : (allowedQualities[0] ?? "web");

  const [quality, setQuality] = useState<DownloadQuality>(defaultQuality);
  const [scope, setScope] = useState<DownloadScope>("all");

  const hasFavorites = favoriteIds.length > 0;
  const activeScope: DownloadScope = scope === "favorites" && hasFavorites ? "favorites" : "all";
  const selectedCount = activeScope === "favorites" ? favoriteIds.length : totalCount;

  const qualityOptions = [
    {
      value: "original",
      label: "Original resolution",
      hint: "Full-resolution files directly from the archive.",
      disabled: !allowedQualities.includes("original"),
    },
    {
      value: "web",
      label: "Web 2048px",
      hint: "Fast-downloading JPEG copies sized for sharing and screens.",
      disabled: !allowedQualities.includes("web"),
    },
  ].filter((opt) => !opt.disabled);

  const scopeOptions = [
    {
      value: "all",
      label: `All photos (${totalCount})`,
    },
    {
      value: "favorites",
      label: `Favorites only (${favoriteIds.length})`,
      disabled: !hasFavorites,
    },
  ];

  const params = new URLSearchParams({
    quality,
    scope: activeScope,
  });

  if (activeScope === "favorites" && mode !== "magic_link") {
    params.set("ids", favoriteIds.join(","));
  }

  const downloadUrl = `/api/share/${encodeURIComponent(slug)}/download.zip?${params.toString()}`;
  const canDownload = selectedCount > 0 && qualityOptions.length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Download archive"
      description="Choose image quality and which photos to include in your ZIP archive."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {canDownload ? (
            <a
              href={downloadUrl}
              download
              onClick={onClose}
              className="ui-btn ui-btn-primary ui-btn-md"
            >
              <span className="ui-btn-label">Download ZIP ({selectedCount})</span>
            </a>
          ) : (
            <Button variant="primary" disabled>
              Download ZIP ({selectedCount})
            </Button>
          )}
        </>
      }
    >
      <div className="share-download-form">
        {qualityOptions.length > 1 && (
          <RadioGroup
            name="download-quality"
            legend="Quality"
            value={quality}
            onChange={(val) => setQuality(val as DownloadQuality)}
            options={qualityOptions}
          />
        )}

        <RadioGroup
          name="download-scope"
          legend="Selection"
          value={activeScope}
          onChange={(val) => setScope(val as DownloadScope)}
          options={scopeOptions}
        />

        {selectedCount > 100 && (
          <Alert tone="neutral" title="Large archive">
            Large ZIP downloads stream directly and may take a moment to begin.
          </Alert>
        )}
      </div>
    </Dialog>
  );
}
