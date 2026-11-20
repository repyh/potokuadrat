"use client";

import Link from "next/link";
import { Alert, Button, EmptyState, Skeleton } from "@/components/ui";

export interface PhotoGridSkeletonProps {
  count?: number;
  className?: string;
}

export function PhotoGridSkeleton({ count = 8, className = "" }: PhotoGridSkeletonProps) {
  return (
    <div
      className={`share-grid ${className}`.trim()}
      aria-busy="true"
      aria-label="Loading photographs"
    >
      {Array.from({ length: count }).map((_, idx) => {
        // Vary aspect ratios matching mixed orientations in Figma C6
        const isPortrait = idx % 3 === 1;
        const aspectRatio = isPortrait ? "3 / 4" : "4 / 3";
        return (
          <div
            key={idx}
            className="share-tile share-tile-skeleton border border-[var(--line)] bg-[var(--ground)]"
            style={{ aspectRatio }}
          >
            <Skeleton height="100%" />
          </div>
        );
      })}
    </div>
  );
}

export interface EmptyFavoritesProps {
  onShowAll?: () => void;
}

export function EmptyFavoritesPrompt({ onShowAll }: EmptyFavoritesProps) {
  return (
    <EmptyState
      title="No favorite photos yet"
      description="Tap the heart button on any photograph to build your personal favorites collection."
      action={
        onShowAll ? (
          <Button variant="secondary" onClick={onShowAll}>
            Show all photos
          </Button>
        ) : undefined
      }
    />
  );
}

export interface ExpiredFolioAlertProps {
  contactEmail?: string | null;
}

export function ExpiredFolioAlert({ contactEmail }: ExpiredFolioAlertProps) {
  return (
    <div className="auth-page">
      <section className="auth-panel text-center" aria-labelledby="expired-heading">
        <p className="hero-eyebrow">Potokuadrat Folio</p>
        <h1 id="expired-heading">Link expired</h1>
        <p className="auth-lede">
          This photographic folio has reached its expiration date and is no longer public.
        </p>
        <Alert tone="warning" title="Access Closed">
          {contactEmail
            ? `Please contact ${contactEmail} to request renewed access.`
            : "Please contact the event organizer or photographer to request a fresh invitation link."}
        </Alert>
      </section>
    </div>
  );
}

export interface UnavailableFolioProps {
  title?: string;
  description?: string;
}

export function UnavailableFolioState({
  title = "Folio unavailable",
  description = "This collection could not be found or has been withdrawn by the organizer.",
}: UnavailableFolioProps) {
  return (
    <div className="auth-page">
      <section className="auth-panel text-center" aria-labelledby="unavail-heading">
        <p className="hero-eyebrow">Potokuadrat</p>
        <h1 id="unavail-heading">{title}</h1>
        <p className="auth-lede">{description}</p>
        <div className="mt-6 flex justify-center">
          <Link href="/" className="ui-btn ui-btn-secondary ui-btn-md">
            Return home
          </Link>
        </div>
      </section>
    </div>
  );
}

export function ShareFolioSkeleton() {
  return (
    <div className="folio-frame share-folio" aria-busy="true" aria-label="Loading folio">
      <header className="share-masthead">
        <div className="share-masthead-inner">
          <div className="share-titles space-y-2">
            <Skeleton lines={1} height="12px" className="w-28" />
            <Skeleton lines={1} height="36px" className="w-80" />
            <Skeleton lines={1} height="16px" className="w-48" />
          </div>
          <div className="share-actions">
            <Skeleton lines={1} height="44px" className="w-36" />
          </div>
        </div>
      </header>

      <main className="share-main">
        <div className="share-toolbar">
          <div className="flex gap-2">
            <Skeleton lines={1} height="32px" className="w-16" />
            <Skeleton lines={1} height="32px" className="w-20" />
            <Skeleton lines={1} height="32px" className="w-20" />
          </div>
        </div>

        <PhotoGridSkeleton count={8} />
      </main>
    </div>
  );
}
