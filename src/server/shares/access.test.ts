import { describe, expect, it } from "vitest";

import { resolveShareAccess, statusForAccess } from "./access";

const now = new Date("2026-11-15T10:00:00Z");

describe("resolveShareAccess", () => {
  it("opens a public share", () => {
    expect(resolveShareAccess({ mode: "public", expiresAt: null }, now)).toBe("ok");
  });

  it("expires at the boundary", () => {
    expect(resolveShareAccess({ mode: "public", expiresAt: now }, now)).toBe("expired");
    expect(
      resolveShareAccess({ mode: "public", expiresAt: new Date("2026-11-15T10:00:01Z") }, now),
    ).toBe("ok");
  });

  it("closes password and magic-link shares until the gate exists", () => {
    expect(resolveShareAccess({ mode: "password", expiresAt: null }, now)).toBe(
      "password_required",
    );
    expect(resolveShareAccess({ mode: "magic_link", expiresAt: null }, now)).toBe("unavailable");
  });
});

describe("statusForAccess", () => {
  it("maps access states to HTTP statuses", () => {
    expect(statusForAccess("expired")).toBe(410);
    expect(statusForAccess("password_required")).toBe(403);
    expect(statusForAccess("unavailable")).toBe(404);
  });
});
