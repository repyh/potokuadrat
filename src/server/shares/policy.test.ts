import { describe, expect, it } from "vitest";

import {
  canDownload,
  isShareActive,
  orientationFor,
  resolveStripMetadata,
} from "./policy";

const base = {
  mode: "public" as const,
  expiresAt: null,
  allowDownload: true,
  allowedQualities: ["original", "web"] as const,
  stripMetadata: null,
};

describe("isShareActive", () => {
  it("treats a null expiry as never expiring", () => {
    expect(isShareActive({ expiresAt: null })).toBe(true);
  });

  it("expires exactly at the boundary", () => {
    const now = new Date("2026-11-13T10:00:00Z");
    expect(isShareActive({ expiresAt: new Date("2026-11-13T10:00:01Z") }, now)).toBe(true);
    expect(isShareActive({ expiresAt: new Date("2026-11-13T10:00:00Z") }, now)).toBe(false);
    expect(isShareActive({ expiresAt: new Date("2026-11-13T09:59:59Z") }, now)).toBe(false);
  });
});

describe("canDownload", () => {
  it("requires the download toggle", () => {
    expect(canDownload({ ...base, allowDownload: false }, "web")).toBe(false);
  });

  it("only allows the qualities the share lists", () => {
    const share = { ...base, allowedQualities: ["web"] as const };
    expect(canDownload(share, "web")).toBe(true);
    expect(canDownload(share, "original")).toBe(false);
  });

  it("allows both qualities by default", () => {
    expect(canDownload(base, "original")).toBe(true);
    expect(canDownload(base, "web")).toBe(true);
  });
});

describe("resolveStripMetadata", () => {
  it("inherits the organization setting when the share value is null", () => {
    expect(resolveStripMetadata({ stripMetadata: null }, true)).toBe(true);
    expect(resolveStripMetadata({ stripMetadata: null }, false)).toBe(false);
  });

  it("lets the share override the organization setting", () => {
    expect(resolveStripMetadata({ stripMetadata: false }, true)).toBe(false);
    expect(resolveStripMetadata({ stripMetadata: true }, false)).toBe(true);
  });
});

describe("orientationFor", () => {
  it("classifies landscape, portrait, and square", () => {
    expect(orientationFor(6000, 4000)).toBe("landscape");
    expect(orientationFor(4000, 6000)).toBe("portrait");
    expect(orientationFor(4000, 4000)).toBe("landscape");
  });

  it("returns unknown when dimensions are missing", () => {
    expect(orientationFor(null, 4000)).toBe("unknown");
    expect(orientationFor(0, 0)).toBe("unknown");
    expect(orientationFor(undefined, undefined)).toBe("unknown");
  });
});
