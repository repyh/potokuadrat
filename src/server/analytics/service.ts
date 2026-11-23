import "server-only";

import { createHash } from "node:crypto";

import type { ViewEventRepository } from "./repository";

export interface AnalyticsDeps {
  repository: ViewEventRepository;
  now?: () => Date;
}

export interface AnalyticsService {
  /** Best effort: a failed insert never breaks the gallery. */
  recordGalleryView(shareId: string, requestHeaders: Headers): Promise<void>;
}

const FALLBACK_ADDRESS = "unknown";

/** First proxy hop, then the direct address, then a fixed fallback. */
export function clientAddress(requestHeaders: Headers): string {
  const forwarded = requestHeaders.get("x-forwarded-for");
  const firstHop = forwarded?.split(",")[0]?.trim();
  if (firstHop) {
    return firstHop;
  }

  const realAddress = requestHeaders.get("x-real-ip")?.trim();
  return realAddress || FALLBACK_ADDRESS;
}

/** UTC day key, so one visitor is indistinguishable within a day and across shares. */
export function visitorDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function hashVisitor(address: string, dayKey: string): string {
  return createHash("sha256").update(`${address}:${dayKey}`).digest("hex");
}

export function createAnalyticsService(deps: AnalyticsDeps): AnalyticsService {
  return {
    async recordGalleryView(shareId, requestHeaders) {
      const at = deps.now?.() ?? new Date();

      try {
        await deps.repository.record({
          shareId,
          visitorHash: hashVisitor(clientAddress(requestHeaders), visitorDayKey(at)),
          at,
        });
      } catch (error) {
        console.error("[analytics] recording a gallery view failed:", error);
      }
    },
  };
}
