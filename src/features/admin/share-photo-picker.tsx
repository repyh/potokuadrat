"use client";

import { useMemo, useState } from "react";

import type { Photo, ThumbStatus } from "@/contracts/album";
import {
  Alert,
  Button,
  Checkbox,
  EmptyState,
  Input,
  Select,
  Skeleton,
} from "@/components/ui";

import {
  adminPhotoThumbUrl,
  formatPhotoBytes,
  formatPhotoDimensions,
} from "./album-media";
import {
  countAlbumPhotosByFilter,
  filterAlbumPhotos,
  type PhotoOrientationFilter,
  type PhotoStatusFilter,
} from "./share-composer";

export interface SharePhotoPickerProps {
  albumId: string;
  photos: Photo[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  selectedPhotoIds: string[];
  onChangeSelected: (nextIds: string[]) => void;
  disabled?: boolean;
}

const INITIAL_VISIBLE_COUNT = 12;
const LOAD_MORE_STEP = 24;
const SKELETON_CARD_COUNT = 8;

const NON_READY_STATUS_LABEL: Record<Exclude<ThumbStatus, "ready">, string> = {
  pending: "Pending",
  failed: "Thumb failed",
  missing: "Removed from Drive",
};

const PLACEHOLDER_LABEL: Record<Exclude<ThumbStatus, "ready">, string> = {
  pending: "Thumbnail pending",
  failed: "Thumbnail unavailable",
  missing: "Removed from Drive",
};

export function SharePhotoPicker({
  albumId,
  photos,
  loading = false,
  error = null,
  onRetry,
  selectedPhotoIds,
  onChangeSelected,
  disabled = false,
}: SharePhotoPickerProps) {
  const [query, setQuery] = useState("");
  const [orientation, setOrientation] = useState<PhotoOrientationFilter>("all");
  const [statusFilter, setStatusFilter] = useState<PhotoStatusFilter>("all");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const [brokenThumbsByKey, setBrokenThumbsByKey] = useState<Record<string, boolean>>({});

  const brokenThumbIds = useMemo(() => {
    const map: Record<string, boolean> = {};
    const prefix = `${albumId}:`;
    for (const [key, value] of Object.entries(brokenThumbsByKey)) {
      if (value && key.startsWith(prefix)) {
        map[key.slice(prefix.length)] = true;
      }
    }
    return map;
  }, [albumId, brokenThumbsByKey]);

  const counts = useMemo(
    () => countAlbumPhotosByFilter(photos, brokenThumbIds),
    [photos, brokenThumbIds],
  );

  const filteredPhotos = useMemo(
    () =>
      filterAlbumPhotos(photos, {
        query,
        orientation,
        statusFilter,
        brokenThumbIds,
      }),
    [photos, query, orientation, statusFilter, brokenThumbIds],
  );

  const displayedPhotos = useMemo(
    () => filteredPhotos.slice(0, visibleCount),
    [filteredPhotos, visibleCount],
  );

  const selectedSet = useMemo(() => new Set(selectedPhotoIds), [selectedPhotoIds]);
  const selectedCount = useMemo(() => {
    let count = 0;
    for (const photo of photos) {
      if (selectedSet.has(photo.id)) {
        count += 1;
      }
    }
    return count;
  }, [photos, selectedSet]);

  const needle = query.trim();
  const hasActiveFilter = needle !== "" || orientation !== "all" || statusFilter !== "all";

  const clearFilters = () => {
    setQuery("");
    setOrientation("all");
    setStatusFilter("all");
    setVisibleCount(INITIAL_VISIBLE_COUNT);
  };

  const togglePhoto = (photoId: string, checked: boolean) => {
    if (disabled) {
      return;
    }
    if (checked) {
      if (!selectedSet.has(photoId)) {
        onChangeSelected([...selectedPhotoIds, photoId]);
      }
      return;
    }
    onChangeSelected(selectedPhotoIds.filter((id) => id !== photoId));
  };

  const handleSelectAllOrMatching = () => {
    if (disabled) {
      return;
    }
    if (!hasActiveFilter) {
      onChangeSelected(photos.map((photo) => photo.id));
      return;
    }

    const merged = [...selectedPhotoIds];
    for (const photo of filteredPhotos) {
      if (!selectedSet.has(photo.id)) {
        merged.push(photo.id);
      }
    }
    onChangeSelected(merged);
  };

  if (loading) {
    return (
      <div className="admin-media-grid" aria-busy="true" aria-label="Loading album photos">
        {Array.from({ length: SKELETON_CARD_COUNT }).map((_, index) => (
          <div key={index} className="admin-media-card">
            <Skeleton lines={1} height="192px" />
            <Skeleton lines={2} height="12px" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        tone="danger"
        title="Could not load album photos"
        action={
          onRetry ? (
            <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
              Retry
            </Button>
          ) : undefined
        }
      >
        {error}
      </Alert>
    );
  }

  if (photos.length === 0) {
    return (
      <EmptyState
        title="No indexed photos in this album"
        description="Re-index the album from Google Drive before freezing a photo subset."
      />
    );
  }

  const orientationChips: Array<{
    id: PhotoOrientationFilter;
    label: string;
    count: number;
  }> = [
    { id: "all", label: "All", count: counts.all },
    { id: "landscape", label: "Landscape", count: counts.landscape },
    { id: "portrait", label: "Portrait", count: counts.portrait },
  ];

  return (
    <div className="admin-dialog-stack">
      <div className="admin-media-controls">
        <div className="admin-media-bar-primary">
          <Input
            type="search"
            className="admin-media-search"
            aria-label="Search photos by filename"
            placeholder="Search filename…"
            value={query}
            disabled={disabled}
            onChange={(event) => {
              setQuery(event.target.value);
              setVisibleCount(INITIAL_VISIBLE_COUNT);
            }}
          />

          <div className="admin-media-bar-actions">
            <div className="admin-media-status-select">
              <Select
                aria-label="Filter by thumbnail status"
                value={statusFilter}
                disabled={disabled}
                onChange={(event) => {
                  setStatusFilter(event.target.value as PhotoStatusFilter);
                  setVisibleCount(INITIAL_VISIBLE_COUNT);
                }}
                options={[
                  { value: "all", label: "All statuses" },
                  { value: "ready", label: `Ready (${counts.ready})` },
                  { value: "pending", label: `Pending (${counts.pending})` },
                  { value: "failed", label: `Failed (${counts.failed})` },
                ]}
              />
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled || filteredPhotos.length === 0}
              onClick={handleSelectAllOrMatching}
            >
              {hasActiveFilter ? `Select matching (${filteredPhotos.length})` : "Select all"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || selectedCount === 0}
              onClick={() => onChangeSelected([])}
            >
              Clear
            </Button>
          </div>
        </div>

        <div className="admin-media-bar-secondary">
          <div className="admin-chips" role="group" aria-label="Filter by orientation">
            {orientationChips.map((chip) => {
              const active = orientation === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  aria-pressed={active}
                  disabled={disabled}
                  className={`admin-chip ${active ? "is-active" : ""}`.trim()}
                  onClick={() => {
                    setOrientation(chip.id);
                    setVisibleCount(INITIAL_VISIBLE_COUNT);
                  }}
                >
                  <span>{chip.label}</span>
                  <span className="tabular-nums admin-chip-count">{chip.count}</span>
                </button>
              );
            })}
          </div>

          <div className="admin-media-filter-note">
            <span className="admin-quiet tabular-nums">
              {selectedCount} of {photos.length} selected
            </span>
            {hasActiveFilter && (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        </div>
      </div>

      {filteredPhotos.length === 0 ? (
        <EmptyState
          title="No photos match these filters"
          description="Clear the filename query or filters to see all indexed photos."
          action={
            <Button type="button" variant="secondary" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <div className="admin-media-grid">
            {displayedPhotos.map((photo) => {
              const selected = selectedSet.has(photo.id);
              const thumbFailed =
                photo.thumbStatus === "failed" || Boolean(brokenThumbIds[photo.id]);
              const canLoadThumb = photo.thumbStatus === "ready" && !thumbFailed;

              return (
                <article
                  key={photo.id}
                  className={`admin-media-card ${selected ? "is-selected" : ""}`.trim()}
                >
                  <div className="admin-media-frame">
                    <button
                      type="button"
                      className="admin-media-select-btn"
                      disabled={disabled}
                      aria-pressed={selected}
                      aria-label={selected ? `Deselect ${photo.name}` : `Select ${photo.name}`}
                      onClick={() => togglePhoto(photo.id, !selected)}
                    >
                      {canLoadThumb ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={adminPhotoThumbUrl(albumId, photo.id, 400)}
                            alt={photo.name}
                            className="admin-media-img"
                            loading="lazy"
                            decoding="async"
                            onError={() =>
                              setBrokenThumbsByKey((prev) => ({
                                ...prev,
                                [`${albumId}:${photo.id}`]: true,
                              }))
                            }
                          />
                        </>
                      ) : (
                        <div className="admin-media-placeholder">
                          <span>
                            {photo.thumbStatus === "ready"
                              ? "Preview unavailable"
                              : PLACEHOLDER_LABEL[photo.thumbStatus]}
                          </span>
                        </div>
                      )}
                    </button>
                  </div>

                  <div className="admin-media-meta">
                    <div className="admin-media-head">
                      <strong className="admin-media-name" title={photo.name}>
                        {photo.name}
                      </strong>
                    </div>

                    <div className="admin-media-facts tabular-nums">
                      <span>
                        {formatPhotoDimensions(photo.width, photo.height)} ·{" "}
                        {formatPhotoBytes(photo.bytes)}
                      </span>
                      {photo.thumbStatus !== "ready" && (
                        <span className={`admin-thumb-pill is-${photo.thumbStatus}`}>
                          {NON_READY_STATUS_LABEL[photo.thumbStatus]}
                        </span>
                      )}
                      {photo.thumbStatus === "ready" && thumbFailed && (
                        <span className="admin-thumb-pill is-failed">Thumb failed</span>
                      )}
                    </div>
                  </div>

                  <div className="admin-media-actions">
                    <Checkbox
                      id={`share-picker-photo-${photo.id}`}
                      checked={selected}
                      disabled={disabled}
                      onChange={(event) => togglePhoto(photo.id, event.target.checked)}
                      label={selected ? "Included" : "Include"}
                    />
                  </div>
                </article>
              );
            })}
          </div>

          {filteredPhotos.length > INITIAL_VISIBLE_COUNT && (
            <div className="admin-media-footer">
              <span className="admin-quiet tabular-nums">
                Showing {displayedPhotos.length} of {filteredPhotos.length} photos
              </span>
              <div className="specimen-inline-cluster">
                {displayedPhotos.length < filteredPhotos.length && (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setVisibleCount((prev) =>
                          Math.min(filteredPhotos.length, prev + LOAD_MORE_STEP),
                        )
                      }
                    >
                      Show{" "}
                      {Math.min(LOAD_MORE_STEP, filteredPhotos.length - displayedPhotos.length)}{" "}
                      more
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setVisibleCount(filteredPhotos.length)}
                    >
                      Show all ({filteredPhotos.length})
                    </Button>
                  </>
                )}
                {visibleCount > INITIAL_VISIBLE_COUNT && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setVisibleCount(INITIAL_VISIBLE_COUNT)}
                  >
                    Show fewer
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
