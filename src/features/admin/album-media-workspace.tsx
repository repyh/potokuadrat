"use client";

import { useMemo, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";

import type { AlbumStatus, Photo, ThumbStatus } from "@/contracts/album";
import {
  listAlbumPhotosAction,
  reorderAlbumPhotosAction,
  setAlbumCoverAction,
} from "@/app/admin/albums/actions";
import {
  Alert,
  Button,
  Dialog,
  EmptyState,
  Fieldset,
  Input,
  Select,
  Skeleton,
} from "@/components/ui";

import {
  adminPhotoThumbUrl,
  formatPhotoBytes,
  formatPhotoDimensions,
  movePhoto,
} from "./album-media";
import { formatDay } from "./format";

export interface AlbumMediaWorkspaceProps {
  albumId: string;
  albumStatus: AlbumStatus;
  initialCoverPhotoId: string | null;
  initialPhotos: Photo[];
  missingCount: number;
  onFeedback: (feedback: {
    tone: "success" | "danger";
    title: string;
    message: string;
  }) => void;
}

type OrientationFilter = "all" | "landscape" | "portrait";
type StatusFilter = "all" | "ready" | "pending" | "failed";

const INITIAL_VISIBLE_COUNT = 8;
const LOAD_MORE_STEP = 16;

const NON_READY_STATUS_LABEL: Record<Exclude<ThumbStatus, "ready">, string> = {
  pending: "Pending",
  failed: "Thumb failed",
  missing: "Removed from Drive",
};

export function AlbumMediaWorkspace({
  albumId,
  albumStatus,
  initialCoverPhotoId,
  initialPhotos,
  missingCount,
  onFeedback,
}: AlbumMediaWorkspaceProps) {
  const router = useRouter();
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [savedOrder, setSavedOrder] = useState<string[]>(() =>
    initialPhotos.map((photo) => photo.id),
  );
  const [coverPhotoId, setCoverPhotoId] = useState<string | null>(initialCoverPhotoId);

  const [query, setQuery] = useState("");
  const [orientation, setOrientation] = useState<OrientationFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const [previewPhotoId, setPreviewPhotoId] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [savingCoverId, setSavingCoverId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [brokenThumbIds, setBrokenThumbIds] = useState<Record<string, boolean>>({});

  const orderDirty =
    photos.length !== savedOrder.length ||
    photos.some((photo, index) => photo.id !== savedOrder[index]);

  const counts = useMemo(() => {
    let landscape = 0;
    let portrait = 0;
    let ready = 0;
    let pending = 0;
    let failed = 0;

    for (const photo of photos) {
      if (photo.orientation === "landscape") {
        landscape += 1;
      } else if (photo.orientation === "portrait") {
        portrait += 1;
      }

      if (photo.thumbStatus === "failed" || photo.thumbStatus === "missing" || brokenThumbIds[photo.id]) {
        failed += 1;
      } else if (photo.thumbStatus === "pending") {
        pending += 1;
      } else {
        ready += 1;
      }
    }

    return {
      all: photos.length,
      landscape,
      portrait,
      ready,
      pending,
      failed,
    };
  }, [photos, brokenThumbIds]);

  const needle = query.trim().toLowerCase();
  const hasActiveFilter = needle !== "" || orientation !== "all" || statusFilter !== "all";
  const reorderEnabled = !hasActiveFilter && photos.length > 1;

  const visiblePhotos = useMemo(() => {
    return photos.filter((photo) => {
      if (needle && !photo.name.toLowerCase().includes(needle)) {
        return false;
      }
      if (orientation !== "all" && photo.orientation !== orientation) {
        return false;
      }

      const isFailed =
        photo.thumbStatus === "failed" ||
        photo.thumbStatus === "missing" ||
        Boolean(brokenThumbIds[photo.id]);

      if (statusFilter === "failed") {
        return isFailed;
      }
      if (statusFilter === "pending") {
        return photo.thumbStatus === "pending" && !isFailed;
      }
      if (statusFilter === "ready") {
        return photo.thumbStatus === "ready" && !isFailed;
      }
      return true;
    });
  }, [photos, needle, orientation, statusFilter, brokenThumbIds]);

  const displayedPhotos = useMemo(
    () => visiblePhotos.slice(0, visibleCount),
    [visiblePhotos, visibleCount],
  );

  const coverPhoto = useMemo(
    () => (coverPhotoId ? photos.find((photo) => photo.id === coverPhotoId) ?? null : null),
    [photos, coverPhotoId],
  );

  const previewPhoto = useMemo(
    () => (previewPhotoId ? photos.find((photo) => photo.id === previewPhotoId) ?? null : null),
    [photos, previewPhotoId],
  );

  const clearFilters = () => {
    setQuery("");
    setOrientation("all");
    setStatusFilter("all");
    setVisibleCount(INITIAL_VISIBLE_COUNT);
  };

  const handleRefresh = async () => {
    if (refreshing) {
      return;
    }
    setRefreshing(true);
    const result = await listAlbumPhotosAction(albumId);
    setRefreshing(false);

    if (!result.ok) {
      onFeedback({
        tone: "danger",
        title: "Refresh failed",
        message: result.error,
      });
      return;
    }

    setPhotos(result.data.photos);
    setSavedOrder(result.data.photos.map((photo) => photo.id));
    setBrokenThumbIds({});
    router.refresh();
  };

  const handleSetCover = async (photoId: string | null) => {
    if (savingCoverId !== null) {
      return;
    }
    setSavingCoverId(photoId ?? "__clear__");
    const result = await setAlbumCoverAction(albumId, { photoId });
    setSavingCoverId(null);

    if (!result.ok) {
      onFeedback({
        tone: "danger",
        title: "Cover update failed",
        message: result.error,
      });
      return;
    }

    setCoverPhotoId(result.data.album.album.coverPhotoId);
    onFeedback({
      tone: "success",
      title: photoId ? "Album cover updated" : "Album cover cleared",
      message: photoId
        ? "Selected photo now represents this album in organizer lists."
        : "Album lists will fall back to the initial letter mark.",
    });
    router.refresh();
  };

  const handleMoveIndex = (fromIndex: number, toIndex: number) => {
    if (!reorderEnabled) {
      return;
    }
    setPhotos((prev) => movePhoto(prev, fromIndex, toIndex));
  };

  const handleResetOrder = () => {
    const byId = new Map(photos.map((photo) => [photo.id, photo]));
    const restored = savedOrder
      .map((id) => byId.get(id))
      .filter((photo): photo is Photo => Boolean(photo));
    if (restored.length === photos.length) {
      setPhotos(restored);
    }
  };

  const handleSaveOrder = async () => {
    if (savingOrder || !orderDirty || photos.length === 0) {
      return;
    }
    setSavingOrder(true);
    const result = await reorderAlbumPhotosAction(albumId, {
      photoIds: photos.map((photo) => photo.id),
    });
    setSavingOrder(false);

    if (!result.ok) {
      onFeedback({
        tone: "danger",
        title: "Reorder failed",
        message: result.error,
      });
      return;
    }

    setPhotos(result.data.photos);
    setSavedOrder(result.data.photos.map((photo) => photo.id));
    onFeedback({
      tone: "success",
      title: "Photo order saved",
      message: "Updated manual photo ordering for client shares.",
    });
    router.refresh();
  };

  const handleDropOn = (targetId: string) => {
    if (!reorderEnabled || !draggingId || draggingId === targetId) {
      setDraggingId(null);
      setDropTargetId(null);
      return;
    }

    setPhotos((prev) => {
      const fromIndex = prev.findIndex((item) => item.id === draggingId);
      const toIndex = prev.findIndex((item) => item.id === targetId);
      return movePhoto(prev, fromIndex, toIndex);
    });
    setDraggingId(null);
    setDropTargetId(null);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>, photoId: string) => {
    if (!reorderEnabled) {
      return;
    }
    event.preventDefault();
    if (draggingId && draggingId !== photoId) {
      setDropTargetId(photoId);
    }
  };

  const orientationChips: Array<{ id: OrientationFilter; label: string; count: number }> = [
    { id: "all", label: "All", count: counts.all },
    { id: "landscape", label: "Landscape", count: counts.landscape },
    { id: "portrait", label: "Portrait", count: counts.portrait },
  ];

  const canRenderCoverThumb =
    coverPhoto !== null &&
    coverPhoto.thumbStatus !== "failed" &&
    coverPhoto.thumbStatus !== "missing" &&
    !brokenThumbIds[coverPhoto.id];

  return (
    <Fieldset
      legend="Photos & Cover"
      description="Inspect uncropped thumbnails, choose an album cover, and drag or step frames to set folio order."
    >
      {photos.length > 0 && (
        <div className="admin-cover-band">
          <div className="admin-cover-band-thumb" aria-hidden="true">
            {coverPhoto && canRenderCoverThumb ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={adminPhotoThumbUrl(albumId, coverPhoto.id, 400)}
                  alt=""
                  className="admin-cover-img"
                />
              </>
            ) : (
              <span className="admin-cover-band-empty">—</span>
            )}
          </div>
          <div className="admin-cover-band-copy">
            <strong>{coverPhoto ? `Cover: ${coverPhoto.name}` : "No cover selected"}</strong>
            <span className="admin-quiet tabular-nums">
              {coverPhoto
                ? `${formatPhotoDimensions(coverPhoto.width, coverPhoto.height)} · ${formatPhotoBytes(coverPhoto.bytes)}`
                : "Choose any photo below to replace the initial mark in organizer album lists."}
            </span>
          </div>
          {coverPhotoId && (
            <Button
              variant="ghost"
              size="sm"
              loading={savingCoverId === "__clear__"}
              disabled={savingCoverId !== null && savingCoverId !== "__clear__"}
              onClick={() => void handleSetCover(null)}
            >
              Clear cover
            </Button>
          )}
        </div>
      )}

      <div className="admin-media-controls">
        {photos.length > 0 ? (
          <>
            <div className="admin-media-bar-primary">
              <Input
                type="search"
                className="admin-media-search"
                aria-label="Search photos by filename"
                placeholder="Search filename…"
                value={query}
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
                    onChange={(event) => {
                      setStatusFilter(event.target.value as StatusFilter);
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
                  variant="secondary"
                  size="md"
                  loading={refreshing}
                  onClick={() => void handleRefresh()}
                >
                  Refresh photos
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

              {hasActiveFilter ? (
                <div className="admin-media-filter-note">
                  <span>Clear filters to reorder frames</span>
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                </div>
              ) : (
                <span className="admin-quiet tabular-nums">
                  {photos.length} {photos.length === 1 ? "photo" : "photos"}
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="admin-media-bar-primary">
            <span className="admin-quiet tabular-nums">0 photos</span>
            <Button
              variant="secondary"
              size="md"
              loading={refreshing}
              onClick={() => void handleRefresh()}
            >
              Refresh photos
            </Button>
          </div>
        )}
      </div>

      {missingCount > 0 && (
        <Alert
          tone="warning"
          title={`${missingCount} tombstoned photo${missingCount === 1 ? "" : "s"}`}
        >
          Files removed from Google Drive during re-index are hidden from client shares and cannot be selected here.
        </Alert>
      )}

      {refreshing && photos.length === 0 ? (
        <div className="admin-media-grid" aria-busy="true" aria-label="Refreshing album photos">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="admin-media-card">
              <div className="admin-media-frame admin-media-placeholder">
                <Skeleton lines={1} height="14px" />
              </div>
              <Skeleton lines={2} height="13px" />
            </div>
          ))}
        </div>
      ) : photos.length === 0 ? (
        <EmptyState
          title={albumStatus === "indexing" ? "Indexing photos" : "No indexed photos yet"}
          description={
            albumStatus === "indexing"
              ? "The indexer is scanning linked Google Drive folders. Refresh shortly to inspect thumbnails."
              : "Check the linked Drive folders below and run a re-index to populate photos."
          }
        />
      ) : visiblePhotos.length === 0 ? (
        <EmptyState
          title="No photos match these filters"
          description="Try clearing the search query or changing orientation and thumbnail status filters."
          action={
            <Button variant="secondary" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <div className="admin-media-grid">
            {displayedPhotos.map((photo) => {
              const albumIndex = photos.findIndex((item) => item.id === photo.id);
              const isCover = coverPhotoId === photo.id;
              const thumbFailed =
                photo.thumbStatus === "failed" || Boolean(brokenThumbIds[photo.id]);
              const thumbMissing = photo.thumbStatus === "missing";
              const canLoadThumb = !thumbFailed && !thumbMissing;
              const cardClasses = [
                "admin-media-card",
                isCover ? "is-cover" : "",
                reorderEnabled ? "is-draggable" : "",
                draggingId === photo.id ? "is-dragging" : "",
                dropTargetId === photo.id ? "is-drop-target" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <article
                  key={photo.id}
                  className={cardClasses}
                  draggable={reorderEnabled && !savingOrder && !refreshing}
                  onDragStart={() => {
                    if (reorderEnabled) {
                      setDraggingId(photo.id);
                    }
                  }}
                  onDragOver={(event) => handleDragOver(event, photo.id)}
                  onDragLeave={() =>
                    setDropTargetId((current) => (current === photo.id ? null : current))
                  }
                  onDrop={(event) => {
                    event.preventDefault();
                    handleDropOn(photo.id);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setDropTargetId(null);
                  }}
                >
                  <div className="admin-media-frame">
                    {canLoadThumb ? (
                      <button
                        type="button"
                        className="admin-media-preview-btn"
                        aria-label={`Inspect ${photo.name}`}
                        onClick={() => setPreviewPhotoId(photo.id)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={adminPhotoThumbUrl(albumId, photo.id, 400)}
                          alt={photo.name}
                          className="admin-media-img"
                          loading="lazy"
                          decoding="async"
                          onError={() =>
                            setBrokenThumbIds((prev) => ({ ...prev, [photo.id]: true }))
                          }
                        />
                      </button>
                    ) : (
                      <div className="admin-media-placeholder">
                        <span>
                          {thumbMissing ? "Removed from Drive" : "Thumbnail unavailable"}
                        </span>
                      </div>
                    )}

                    {isCover && <span className="admin-cover-badge">Cover</span>}
                  </div>

                  <div className="admin-media-meta">
                    <div className="admin-media-head">
                      <strong className="admin-media-name" title={photo.name}>
                        {photo.name}
                      </strong>
                      <span className="admin-media-position tabular-nums">
                        #{String(albumIndex + 1).padStart(2, "0")}
                      </span>
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
                    <div className="admin-media-order-controls">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!reorderEnabled || albumIndex === 0 || savingOrder}
                        aria-label={`Move ${photo.name} earlier`}
                        onClick={() => handleMoveIndex(albumIndex, albumIndex - 1)}
                      >
                        ←
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!reorderEnabled || albumIndex === photos.length - 1 || savingOrder}
                        aria-label={`Move ${photo.name} later`}
                        onClick={() => handleMoveIndex(albumIndex, albumIndex + 1)}
                      >
                        →
                      </Button>
                    </div>

                    {isCover ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={savingCoverId === "__clear__"}
                        disabled={savingCoverId !== null && savingCoverId !== "__clear__"}
                        onClick={() => void handleSetCover(null)}
                      >
                        Clear cover
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={savingCoverId === photo.id}
                        disabled={
                          thumbMissing ||
                          (savingCoverId !== null && savingCoverId !== photo.id)
                        }
                        onClick={() => void handleSetCover(photo.id)}
                      >
                        Set cover
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {visiblePhotos.length > INITIAL_VISIBLE_COUNT && (
            <div className="admin-media-footer">
              <span className="admin-quiet tabular-nums">
                Showing {displayedPhotos.length} of {visiblePhotos.length} photos
              </span>
              <div className="specimen-inline-cluster">
                {displayedPhotos.length < visiblePhotos.length && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setVisibleCount((prev) =>
                          Math.min(visiblePhotos.length, prev + LOAD_MORE_STEP),
                        )
                      }
                    >
                      Show{" "}
                      {Math.min(LOAD_MORE_STEP, visiblePhotos.length - displayedPhotos.length)}{" "}
                      more
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setVisibleCount(visiblePhotos.length)}
                    >
                      Show all ({visiblePhotos.length})
                    </Button>
                  </>
                )}
                {visibleCount > INITIAL_VISIBLE_COUNT && (
                  <Button
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

      {orderDirty && (
        <div className="admin-media-savebar" role="region" aria-label="Unsaved photo order">
          <span>Photo order changed — client folios will reflect the new sequence once saved.</span>
          <div className="specimen-inline-cluster">
            <Button
              variant="ghost"
              size="sm"
              disabled={savingOrder}
              onClick={handleResetOrder}
            >
              Reset
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={savingOrder}
              onClick={() => void handleSaveOrder()}
            >
              Save order
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={Boolean(previewPhoto)}
        onClose={() => setPreviewPhotoId(null)}
        title={previewPhoto?.name ?? "Photo preview"}
        description={
          previewPhoto
            ? `${formatPhotoDimensions(previewPhoto.width, previewPhoto.height)} · ${formatPhotoBytes(previewPhoto.bytes)}${
                previewPhoto.takenAt ? ` · Captured ${formatDay(previewPhoto.takenAt)}` : ""
              }`
            : undefined
        }
        footer={
          previewPhoto ? (
            <>
              <Button variant="ghost" onClick={() => setPreviewPhotoId(null)}>
                Close
              </Button>
              {coverPhotoId === previewPhoto.id ? (
                <Button
                  variant="secondary"
                  loading={savingCoverId === "__clear__"}
                  onClick={() => void handleSetCover(null)}
                >
                  Clear album cover
                </Button>
              ) : (
                <Button
                  variant="primary"
                  loading={savingCoverId === previewPhoto.id}
                  onClick={() => void handleSetCover(previewPhoto.id)}
                >
                  Set as album cover
                </Button>
              )}
            </>
          ) : null
        }
      >
        {previewPhoto && (
          <div className="admin-media-lightbox">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={adminPhotoThumbUrl(albumId, previewPhoto.id, 1600)}
              alt={previewPhoto.name}
              className="admin-media-lightbox-img"
            />
          </div>
        )}
      </Dialog>
    </Fieldset>
  );
}
