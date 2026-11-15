import { describe, expect, it } from "vitest";

import { organizationSettingsSchema } from "./validation";

describe("organizationSettingsSchema", () => {
  it("accepts a minimal input", () => {
    expect(organizationSettingsSchema.safeParse({ name: "Studio" }).success).toBe(true);
  });

  it("accepts nulls that clear optional values", () => {
    expect(
      organizationSettingsSchema.safeParse({
        name: "Studio",
        title: null,
        logo: null,
        accent: null,
        footerEnabled: false,
        stripMetadata: false,
      }).success,
    ).toBe(true);
  });

  it("rejects a short name, a bad accent, an unknown field, and long text", () => {
    expect(organizationSettingsSchema.safeParse({ name: "S" }).success).toBe(false);
    expect(
      organizationSettingsSchema.safeParse({ name: "Studio", accent: "blue" }).success,
    ).toBe(false);
    expect(
      organizationSettingsSchema.safeParse({ name: "Studio", extra: true }).success,
    ).toBe(false);
    expect(
      organizationSettingsSchema.safeParse({ name: "Studio", title: "x".repeat(121) }).success,
    ).toBe(false);
  });
});
