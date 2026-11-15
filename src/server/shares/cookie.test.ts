import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createShareCookieValue,
  readCookie,
  shareCookieHeader,
  shareCookieName,
  verifyShareCookieValue,
} from "./cookie";

beforeEach(() => {
  process.env.BETTER_AUTH_SECRET = "cookie-test-secret-0123456789abcdef";
});

afterEach(() => {
  delete process.env.BETTER_AUTH_SECRET;
});

describe("share cookie", () => {
  it("round-trips without a session id", () => {
    const { value, maxAge } = createShareCookieValue("share-1");
    const verified = verifyShareCookieValue("share-1", value);

    expect(maxAge).toBe(12 * 60 * 60);
    expect(verified).toEqual({ sessionId: null });
  });

  it("round-trips a magic-link session id", () => {
    const { value } = createShareCookieValue("share-1", {
      sessionId: "session-1",
      maxAgeSeconds: 60,
    });

    expect(verifyShareCookieValue("share-1", value)).toEqual({ sessionId: "session-1" });
  });

  it("rejects a tampered signature", () => {
    const { value } = createShareCookieValue("share-1");
    const [version, expiresAt, sessionId] = value.split(".");

    expect(verifyShareCookieValue("share-1", `${version}.${expiresAt}.${sessionId}.bad`)).toBeNull();
  });

  it("binds the cookie to one share", () => {
    const { value } = createShareCookieValue("share-1");
    expect(verifyShareCookieValue("share-2", value)).toBeNull();
  });

  it("rejects an expired cookie", () => {
    const now = new Date("2026-11-15T10:00:00Z");
    const { value } = createShareCookieValue("share-1", {
      now,
      maxAgeSeconds: 60,
    });
    const later = new Date("2026-11-15T10:01:01Z");

    expect(verifyShareCookieValue("share-1", value, later)).toBeNull();
  });

  it("names cookies from a hash of the share id", () => {
    const name = shareCookieName("share-1");
    expect(name).toMatch(/^pk_share_[0-9a-f]{16}$/);
    expect(name).not.toContain("share-1");
  });

  it("sets HttpOnly and SameSite on the header", () => {
    const header = shareCookieHeader("pk_share_x", "value", 60);
    expect(header).toContain("Path=/");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Max-Age=60");
  });
});

describe("readCookie", () => {
  it("finds a cookie among others", () => {
    expect(readCookie("a=1; pk_share_x=v=v; b=2", "pk_share_x")).toBe("v=v");
    expect(readCookie("a=1", "missing")).toBeNull();
    expect(readCookie(null, "a")).toBeNull();
  });
});
