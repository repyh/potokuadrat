import { describe, expect, it, vi } from "vitest";

import type { OrganizationRecord, OrganizationRepository } from "./repository";
import { createOrganizationService } from "./service";

const now = new Date("2026-11-15T10:00:00Z");
const row: OrganizationRecord = {
  id: "org-1",
  name: "Studio",
  title: "Studio Gallery",
  logo: null,
  accent: "#3366ff",
  footerEnabled: true,
  stripMetadata: true,
  updatedAt: now,
};

function repository(overrides: Partial<OrganizationRepository> = {}): OrganizationRepository {
  return {
    get: vi.fn(async () => row),
    ensure: vi.fn(async () => row),
    update: vi.fn(async () => row),
    ...overrides,
  };
}

describe("organization service", () => {
  it("returns the stored settings with ISO timestamps", async () => {
    const service = createOrganizationService({ repository: repository() });

    expect(await service.get()).toEqual({
      name: "Studio",
      title: "Studio Gallery",
      logo: null,
      accent: "#3366ff",
      footerEnabled: true,
      stripMetadata: true,
      updatedAt: now.toISOString(),
    });
  });

  it("creates the default organization when none exists", async () => {
    const ensure = vi.fn(async () => row);
    const service = createOrganizationService({ repository: repository({ ensure }) });

    await service.get();

    expect(ensure).toHaveBeenCalledTimes(1);
  });

  it("passes the update through and maps the result", async () => {
    const update = vi.fn(async () => ({
      ...row,
      name: "New Name",
      stripMetadata: false,
      updatedAt: new Date("2026-11-16T10:00:00Z"),
    }));
    const service = createOrganizationService({ repository: repository({ update }) });

    const settings = await service.update({ name: "New Name", stripMetadata: false });

    expect(update).toHaveBeenCalledWith({ name: "New Name", stripMetadata: false });
    expect(settings.name).toBe("New Name");
    expect(settings.stripMetadata).toBe(false);
    expect(settings.updatedAt).toBe("2026-11-16T10:00:00.000Z");
  });
});
