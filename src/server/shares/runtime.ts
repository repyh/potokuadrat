import "server-only";

import { getDb } from "@/server/db/client";

import type { ShareRepository } from "./repository";
import { createDrizzleShareRepository } from "./repository";

let repository: ShareRepository | null = null;

export function getShareRepository(): ShareRepository {
  repository ??= createDrizzleShareRepository(getDb());
  return repository;
}
