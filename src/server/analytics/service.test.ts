import { describe, expect, it, vi } from "vitest";

import type { ViewEventRepository } from "./repository";
import {
  clientAddress,
  createAnalyticsService,
  hashVisitor,
  visitorDayKey,
} from "./service";

const NOW = new Date("2026-11-23T08:30:00.000Z");

function repository(overrides: Partial<ViewEventRepository> = {}): ViewEventRepository {
  return { record: vi.fn(async () => {}), ...overrides };
}

function headers(values: Record<string, string>): Headers {
  return new Headers(values);
}

describe("analytics helpers", () => {
  it("uses the first forwarded hop, then the direct address, then a fallback", () => {
    expect(clientAddress(headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe(
      "203.0.113.9",
    );
    expect(clientAddress(headers({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(clientAddress(headers({}))).toBe("unknown");
  });

  it("hashes the visitor with the UTC day and never keeps the address", () => {
    const hash = hashVisitor("203.0.113.9", visitorDayKey(NOW));

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("203.0.113.9");
    expect(hash).not.toContain("203");
    expect(visitorDayKey(NOW)).toBe("2026-11-23");
    expect(hashVisitor("203.0.113.9", "2026-11-24")).not.toBe(hash);
    expect(hashVisitor("203.0.113.9", visitorDayKey(NOW))).toBe(hash);
  });
});

describe("recordGalleryView", () => {
  it("stores a hashed view for the share", async () => {
    const repo = repository();
    const service = createAnalyticsService({ repository: repo, now: () => NOW });

    await service.recordGalleryView(
      "share-1",
      headers({ "x-forwarded-for": "203.0.113.9" }),
    );

    expect(repo.record).toHaveBeenCalledWith({
      shareId: "share-1",
      visitorHash: hashVisitor("203.0.113.9", "2026-11-23"),
      at: NOW,
    });
  });

  it("never throws when the insert fails", async () => {
    const repo = repository({
      record: vi.fn(async () => {
        throw new Error("database is down");
      }),
    });
    const service = createAnalyticsService({ repository: repo, now: () => NOW });

    await expect(
      service.recordGalleryView("share-1", headers({})),
    ).resolves.toBeUndefined();
  });
});
