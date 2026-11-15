import { describe, expect, it } from "vitest";

import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows up to the limit and then refuses", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
    const now = 1_700_000_000_000;

    expect(limiter.consume("key", now).ok).toBe(true);
    expect(limiter.consume("key", now).ok).toBe(true);

    const blocked = limiter.consume("key", now);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets after the window passes", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    const now = 1_700_000_000_000;

    expect(limiter.consume("key", now).ok).toBe(true);
    expect(limiter.consume("key", now + 59_000).ok).toBe(false);
    expect(limiter.consume("key", now + 61_000).ok).toBe(true);
  });

  it("tracks keys independently", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    const now = 1_700_000_000_000;

    expect(limiter.consume("share-a:1.2.3.4", now).ok).toBe(true);
    expect(limiter.consume("share-a:5.6.7.8", now).ok).toBe(true);
    expect(limiter.consume("share-b:1.2.3.4", now).ok).toBe(true);
  });
});
