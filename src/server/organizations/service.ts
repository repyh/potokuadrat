import "server-only";

import type { OrganizationSettings, OrganizationSettingsInput } from "@/contracts/admin";

import type { OrganizationRecord, OrganizationRepository } from "./repository";

export interface OrganizationService {
  get(): Promise<OrganizationSettings>;
  update(input: OrganizationSettingsInput): Promise<OrganizationSettings>;
}

function toSettings(row: OrganizationRecord): OrganizationSettings {
  return {
    name: row.name,
    title: row.title,
    logo: row.logo,
    accent: row.accent,
    footerEnabled: row.footerEnabled,
    stripMetadata: row.stripMetadata,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createOrganizationService(deps: {
  repository: OrganizationRepository;
}): OrganizationService {
  return {
    async get() {
      return toSettings(await deps.repository.ensure());
    },

    async update(input) {
      return toSettings(await deps.repository.update(input));
    },
  };
}
