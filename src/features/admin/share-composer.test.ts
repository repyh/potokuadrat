import { describe, expect, it } from "vitest";

import {
  parseRecipients,
  validateAndBuildShareInput,
  type ShareComposerDraft,
} from "./share-composer";

function baseDraft(overrides: Partial<ShareComposerDraft> = {}): ShareComposerDraft {
  return {
    albumId: "11111111-1111-4111-8111-111111111111",
    mode: "public",
    password: "",
    recipientsText: "",
    expiryChoice: "never",
    expiryDate: "",
    allowDownload: true,
    allowOriginal: true,
    allowWeb: true,
    metadataPolicy: "inherit",
    brandingTitle: "",
    brandingAccent: "",
    brandingWelcomeMessage: "",
    ...overrides,
  };
}

describe("parseRecipients", () => {
  it("splits comma and newline separated emails and deduplicates case-insensitively", () => {
    expect(
      parseRecipients("alice@example.com, bob@example.com\nALICE@example.com\n  carol@example.com "),
    ).toEqual(["alice@example.com", "bob@example.com", "carol@example.com"]);
  });
});

describe("validateAndBuildShareInput", () => {
  it("builds a valid public share payload with whole-album default and inherited metadata", () => {
    const result = validateAndBuildShareInput(baseDraft());

    expect(result).toEqual({
      ok: true,
      albumId: "11111111-1111-4111-8111-111111111111",
      input: {
        mode: "public",
        expiresAt: null,
        allowDownload: true,
        allowedQualities: ["original", "web"],
        stripMetadata: null,
        branding: null,
        photoIds: null,
      },
    });
  });

  it("blocks password mode when password is missing or shorter than 8 characters", () => {
    const missing = validateAndBuildShareInput(baseDraft({ mode: "password", password: "" }));
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.errors.password).toBeDefined();
    }

    const short = validateAndBuildShareInput(baseDraft({ mode: "password", password: "secret" }));
    expect(short.ok).toBe(false);
    if (!short.ok) {
      expect(short.errors.password).toBeDefined();
    }
  });

  it("blocks downloads when allowDownload is enabled without any quality selected", () => {
    const result = validateAndBuildShareInput(
      baseDraft({ allowDownload: true, allowOriginal: false, allowWeb: false }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.qualities).toBeDefined();
    }
  });

  it("allows disabling downloads entirely without quality errors", () => {
    const result = validateAndBuildShareInput(
      baseDraft({ allowDownload: false, allowOriginal: false, allowWeb: false }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input.allowDownload).toBe(false);
      expect(result.input.allowedQualities).toBeUndefined();
    }
  });

  it("maps expiry dates to end-of-day ISO timestamps and rejects missing or malformed dates", () => {
    const invalid = validateAndBuildShareInput(
      baseDraft({ expiryChoice: "date", expiryDate: "" }),
    );
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.errors.expiryDate).toBeDefined();
    }

    const valid = validateAndBuildShareInput(
      baseDraft({ expiryChoice: "date", expiryDate: "2027-03-15" }),
    );
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.input.expiresAt).toBe("2027-03-15T23:59:59.999Z");
    }
  });

  it("maps tri-state metadata policy and validates optional branding overrides", () => {
    const badColor = validateAndBuildShareInput(baseDraft({ brandingAccent: "terracotta" }));
    expect(badColor.ok).toBe(false);
    if (!badColor.ok) {
      expect(badColor.errors.brandingAccent).toBeDefined();
    }

    const ok = validateAndBuildShareInput(
      baseDraft({
        metadataPolicy: "keep",
        brandingTitle: "  Lina & Bima  ",
        brandingAccent: " #b4532a ",
        brandingWelcomeMessage: "  Welcome home.  ",
      }),
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.input.stripMetadata).toBe(false);
      expect(ok.input.branding).toEqual({
        title: "Lina & Bima",
        accent: "#b4532a",
        welcomeMessage: "Welcome home.",
      });
    }
  });

  it("validates magic-link recipients and passes valid emails through", () => {
    const invalid = validateAndBuildShareInput(
      baseDraft({ mode: "magic_link", recipientsText: "bad-email, ok@example.com" }),
    );
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.errors.recipients).toBeDefined();
    }

    const valid = validateAndBuildShareInput(
      baseDraft({
        mode: "magic_link",
        recipientsText: "guest@example.com\nsecond@example.com",
      }),
    );
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.input.recipients).toEqual(["guest@example.com", "second@example.com"]);
    }
  });
});
