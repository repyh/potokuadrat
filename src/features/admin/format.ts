/**
 * Display helpers for the organizer surfaces. They take an explicit `now` so the
 * server render and the browser hydration produce the same string.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

export function formatRelative(iso: string | null, now: number): string {
  if (!iso) {
    return "—";
  }

  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) {
    return "—";
  }

  const elapsed = Math.max(0, now - time);
  if (elapsed < MINUTE) {
    return "just now";
  }
  if (elapsed < HOUR) {
    return `${Math.floor(elapsed / MINUTE)}m ago`;
  }
  if (elapsed < DAY) {
    return `${Math.floor(elapsed / HOUR)}h ago`;
  }
  if (elapsed < 2 * DAY) {
    return "yesterday";
  }
  if (elapsed < WEEK) {
    return `${Math.floor(elapsed / DAY)}d ago`;
  }
  return `${Math.floor(elapsed / WEEK)}w ago`;
}

/** Short calendar day, e.g. "12 Dec". */
export function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" }).format(
    new Date(iso),
  );
}
