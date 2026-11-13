import type { ReactNode } from "react";

export type AlertTone = "neutral" | "success" | "warning" | "danger";

export interface AlertProps {
  tone?: AlertTone;
  title: string;
  children: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
}

export interface BannerProps {
  title: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}

export interface SkeletonProps {
  lines?: number;
  height?: string;
  className?: string;
}

export interface ProgressBarProps {
  label: string;
  value: number;
  max: number;
  unitLabel?: string;
}

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
}

function ToneIcon({ tone }: { tone: AlertTone }) {
  if (tone === "success") {
    return (
      <svg className="ui-alert-icon" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <circle cx="9" cy="9" r="7.25" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M5.75 9.25L7.9 11.4L12.4 6.6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (tone === "warning" || tone === "danger") {
    return (
      <svg className="ui-alert-icon" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <circle cx="9" cy="9" r="7.25" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9 5.5v4.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="9" cy="12.4" r="0.9" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg className="ui-alert-icon" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="7.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 8v4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="9" cy="5.6" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function Alert({
  tone = "neutral",
  title,
  children,
  action,
  onDismiss,
}: AlertProps) {
  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={`ui-alert ui-alert-${tone}`}
    >
      <ToneIcon tone={tone} />
      <div className="ui-alert-body">
        <p className="ui-alert-title">{title}</p>
        <div className="ui-alert-copy">{children}</div>
        {action && <div className="ui-alert-action">{action}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notice"
          className="ui-alert-dismiss"
        >
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M4.5 4.5l7 7M11.5 4.5l-7 7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

export function Banner({
  title,
  detail,
  actionLabel,
  onAction,
  onDismiss,
}: BannerProps) {
  return (
    <div role="region" aria-label={title} className="ui-banner">
      <div className="ui-banner-copy">
        <strong className="ui-banner-title">{title}</strong>
        {detail && <span className="ui-banner-detail">{detail}</span>}
      </div>
      <div className="ui-banner-actions">
        {actionLabel && onAction && (
          <button type="button" onClick={onAction} className="ui-banner-btn">
            <span>{actionLabel}</span>
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M3.5 8h8.5M8.5 4.5L12 8l-3.5 3.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss announcement"
            className="ui-banner-dismiss"
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M4.5 4.5l7 7M11.5 4.5l-7 7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export function Skeleton({ lines = 3, height = "14px", className = "" }: SkeletonProps) {
  return (
    <div className={`ui-skeleton-group ${className}`.trim()} aria-busy="true" aria-live="polite">
      {Array.from({ length: lines }).map((_, idx) => (
        <span
          key={idx}
          className="ui-skeleton-bar"
          style={{
            height,
            width: idx === lines - 1 && lines > 1 ? "68%" : "100%",
          }}
        />
      ))}
    </div>
  );
}

export function ProgressBar({ label, value, max, unitLabel }: ProgressBarProps) {
  const safeMax = max > 0 ? max : 100;
  const clamped = Math.min(Math.max(value, 0), safeMax);
  const percent = Math.round((clamped / safeMax) * 100);

  return (
    <div className="ui-progress">
      <div className="ui-progress-header">
        <span className="ui-progress-label">{label}</span>
        <span className="ui-progress-readout">
          {clamped} / {safeMax} {unitLabel ?? `(${percent}%)`}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        className="ui-progress-track"
      >
        <div className="ui-progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <div className="ui-empty-state">
      <div className="ui-empty-copy">
        <h3 className="ui-empty-title">{title}</h3>
        <p className="ui-empty-description">{description}</p>
      </div>
      {(action || secondaryAction) && (
        <div className="ui-empty-actions">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
