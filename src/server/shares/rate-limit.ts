export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  consume(key: string, now?: number): RateLimitResult;
}

/**
 * In-process fixed-window limiter. One VPS runs one app process in v1, so a shared
 * store is not needed yet. Keys are derived per share and client address.
 */
export function createRateLimiter(options: { windowMs: number; max: number }): RateLimiter {
  const hits = new Map<string, number[]>();

  return {
    consume(key, now = Date.now()) {
      const cutoff = now - options.windowMs;
      const recent = (hits.get(key) ?? []).filter((time) => time > cutoff);

      if (recent.length >= options.max) {
        hits.set(key, recent);
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((recent[0] + options.windowMs - now) / 1000),
        );
        return { ok: false, retryAfterSeconds };
      }

      recent.push(now);
      hits.set(key, recent);
      return { ok: true, retryAfterSeconds: 0 };
    },
  };
}

/** Five password attempts per minute per share and client. */
export const passwordAttemptLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });

/** Ten magic-link exchanges per minute per share and client. */
export const magicAttemptLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

export function clientKey(request: Request, shareId: string): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${shareId}:${forwarded || "local"}`;
}
