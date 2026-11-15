import { describe, expect, it } from "vitest";

import { createShareSchema, updateShareSchema } from "./validation";

describe("createShareSchema", () => {
  it("accepts a public share with defaults left out", () => {
    expect(createShareSchema.safeParse({ mode: "public" }).success).toBe(true);
  });

  it("requires a password for password shares", () => {
    const parsed = createShareSchema.safeParse({ mode: "password" });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("A password share needs a password.");
  });

  it("rejects short passwords, bad colors, duplicate qualities, and unknown fields", () => {
    expect(
      createShareSchema.safeParse({ mode: "password", password: "short" }).success,
    ).toBe(false);
    expect(
      createShareSchema.safeParse({
        mode: "public",
        branding: { accent: "red" },
      }).success,
    ).toBe(false);
    expect(
      createShareSchema.safeParse({
        mode: "public",
        allowedQualities: ["web", "web"],
      }).success,
    ).toBe(false);
    expect(
      createShareSchema.safeParse({ mode: "public", somethingElse: true }).success,
    ).toBe(false);
  });

  it("validates the expiry and recipient emails", () => {
    expect(
      createShareSchema.safeParse({ mode: "public", expiresAt: "not-a-date" }).success,
    ).toBe(false);
    expect(
      createShareSchema.safeParse({
        mode: "magic_link",
        recipients: ["not-an-email"],
      }).success,
    ).toBe(false);
  });
});

describe("updateShareSchema", () => {
  it("accepts a partial update", () => {
    expect(updateShareSchema.safeParse({ allowDownload: false }).success).toBe(true);
    expect(updateShareSchema.safeParse({ expiresAt: null }).success).toBe(true);
  });

  it("still validates the values it receives", () => {
    expect(updateShareSchema.safeParse({ allowedQualities: [] }).success).toBe(false);
    expect(updateShareSchema.safeParse({ photoIds: ["nope"] }).success).toBe(false);
  });
});
