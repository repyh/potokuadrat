import "server-only";

import { getDb } from "@/server/db/client";

import type { OrganizationRepository } from "./repository";
import { createDrizzleOrganizationRepository } from "./repository";
import type { OrganizationService } from "./service";
import { createOrganizationService } from "./service";

let repository: OrganizationRepository | null = null;
let service: OrganizationService | null = null;

export function getOrganizationService(): OrganizationService {
  repository ??= createDrizzleOrganizationRepository(getDb());
  service ??= createOrganizationService({ repository });
  return service;
}
