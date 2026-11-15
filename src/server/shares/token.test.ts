import { describe, expect, it } from "vitest";

import {
  MAGIC_TOKEN_TTL_DAYS,
  createMagicToken,
  hashMagicToken,
  magicLinkUrl,
  magicTokenExpiry,
} from "./token";

describe("magic tokens", () => {
  it("creates an unguessable URL-safe token and stores only its hash", () => {
    const first = createMagicToken();
    const second = createMagicToken();

    expect(first.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.tokenHash).not.toContain(first.token);
    expect(first.tokenHash).toBe(hashMagicToken(first.token));
  });

  it("expires links after the configured window", () => {
    const now = new Date("2026-11-15T10:00:00Z");
    const expiry = magicTokenExpiry(now);

    expect(expiry.getTime() - now.getTime()).toBe(
      MAGIC_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
  });
});

describe("magicLinkUrl", () => {
  it("builds a copyable link and trims a trailing slash", () => {
    expect(magicLinkUrl("https://gallery.example/", "abc123", "tok en")).toBe(
      "https://gallery.example/s/abc123?token=tok%20en",
    );
  });
});
