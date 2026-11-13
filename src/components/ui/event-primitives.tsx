import type { FormEvent } from "react";

export interface ScheduleRowProps {
  time: string;
  title: string;
  stage: string;
  lead: string;
  duration: string;
  onInspect?: () => void;
  disabled?: boolean;
}

export interface DocumentRowProps {
  mark: string;
  kind: string;
  title: string;
  fileSize: string;
  readingTime: string;
  onOpen?: () => void;
  disabled?: boolean;
}

export interface GuestPassRowProps {
  name: string;
  organization: string;
  passId: string;
  checkedIn: boolean;
  onToggleCheckIn: () => void;
  disabled?: boolean;
}

export interface AccessCodeGateProps {
  value: string;
  onChange: (nextValue: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  disabled?: boolean;
  error?: string;
}

export function ScheduleRow({
  time,
  title,
  stage,
  lead,
  duration,
  onInspect,
  disabled = false,
}: ScheduleRowProps) {
  return (
    <div className="ui-schedule-row">
      <span className="ui-schedule-time">{time}</span>
      <div className="ui-schedule-main">
        <strong className="ui-schedule-title">{title}</strong>
        <span className="ui-schedule-meta">
          {stage} · {lead}
        </span>
      </div>
      <span className="ui-schedule-duration">{duration}</span>
      {onInspect && (
        <button
          type="button"
          disabled={disabled}
          onClick={onInspect}
          className="ui-btn ui-btn-ghost ui-btn-sm"
        >
          Inspect cue
        </button>
      )}
    </div>
  );
}

export function DocumentRow({
  mark,
  kind,
  title,
  fileSize,
  readingTime,
  onOpen,
  disabled = false,
}: DocumentRowProps) {
  return (
    <div className="ui-doc-row">
      <span className="ui-doc-mark" aria-hidden="true">
        {mark}
      </span>
      <div className="ui-doc-main">
        <span className="ui-doc-kind">{kind}</span>
        <strong className="ui-doc-title">{title}</strong>
      </div>
      <span className="ui-doc-meta">
        {readingTime} · {fileSize}
      </span>
      {onOpen && (
        <button
          type="button"
          disabled={disabled}
          onClick={onOpen}
          className="ui-btn ui-btn-secondary ui-btn-sm"
        >
          <span>Open</span>
          <svg
            className="ui-btn-inline-svg"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
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
    </div>
  );
}

export function GuestPassRow({
  name,
  organization,
  passId,
  checkedIn,
  onToggleCheckIn,
  disabled = false,
}: GuestPassRowProps) {
  return (
    <div className="ui-guest-row">
      <div className="ui-guest-main">
        <strong className="ui-guest-name">{name}</strong>
        <span className="ui-guest-org">{organization}</span>
      </div>
      <span className="ui-guest-code">{passId}</span>
      <span className="ui-guest-status">
        {checkedIn ? "Checked in" : "Awaiting arrival"}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={onToggleCheckIn}
        className={`ui-btn ${checkedIn ? "ui-btn-secondary" : "ui-btn-primary"} ui-btn-sm`}
      >
        {checkedIn ? "Undo check-in" : "Check in guest"}
      </button>
    </div>
  );
}

export function AccessCodeGate({
  value,
  onChange,
  onSubmit,
  loading = false,
  disabled = false,
  error,
}: AccessCodeGateProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!disabled && !loading) {
      onSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="ui-access-gate" noValidate>
      <div className="ui-access-gate-row">
        <label htmlFor="client-vault-code" className="ui-sr-only">
          Client vault access code
        </label>
        <input
          id="client-vault-code"
          type="text"
          value={value}
          disabled={disabled || loading}
          aria-invalid={Boolean(error) || undefined}
          onChange={(e) => onChange(e.target.value)}
          placeholder="PK-2026-AUTUMN"
          className={`ui-access-input ${error ? "ui-input-invalid" : ""}`.trim()}
        />
        <button
          type="submit"
          disabled={disabled || loading}
          aria-busy={loading || undefined}
          className="ui-btn ui-btn-primary ui-btn-md"
        >
          {loading ? "Verifying…" : "Unlock vault"}
        </button>
      </div>
      {error && (
        <p className="ui-field-error" role="alert">
          <span>{error}</span>
        </p>
      )}
    </form>
  );
}
