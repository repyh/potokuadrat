import "server-only";

import { getDb } from "@/server/db/client";

import type { ViewEventRepository } from "./repository";
import { createDrizzleViewEventRepository } from "./repository";
import type { AnalyticsService } from "./service";
import { createAnalyticsService } from "./service";

let repository: ViewEventRepository | null = null;
let service: AnalyticsService | null = null;

export function getAnalyticsService(): AnalyticsService {
  repository ??= createDrizzleViewEventRepository(getDb());
  service ??= createAnalyticsService({ repository });
  return service;
}
