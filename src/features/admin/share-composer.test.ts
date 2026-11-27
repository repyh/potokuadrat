import { describe, expect, it } from "vitest";

import type { Photo } from "@/contracts/album";

import {
  countAlbumPhotosByFilter,
  filterAlbumPhotos,
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
    photoScope: "whole",
    selectedPhotoIds: [],
    metadataPolicy: "inherit",
    brandingTitle: "",
    brandingLogo: "",
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
        brandingLogo: " https://example.com/logo.png ",
        brandingAccent: " #b4532a ",
        brandingWelcomeMessage: "  Welcome home.  ",
      }),
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.input.stripMetadata).toBe(false);
      expect(ok.input.branding).toEqual({
        title: "Lina & Bima",
        logo: "https://example.com/logo.png",
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

  it("requires at least one photo for a frozen subset and deduplicates selected ids", () => {
    const empty = validateAndBuildShareInput(
      baseDraft({ photoScope: "frozen", selectedPhotoIds: [] }),
    );
    expect(empty.ok).toBe(false);
    if (!empty.ok) {
      expect(empty.errors.photoIds).toBeDefined();
    }

    const p1 = "22222222-2222-4222-8222-222222222221";
    const p2 = "22222222-2222-4222-8222-222222222222";
    const frozen = validateAndBuildShareInput(
      baseDraft({ photoScope: "frozen", selectedPhotoIds: [p1, p2, p1] }),
    );
    expect(frozen.ok).toBe(true);
    if (frozen.ok) {
      expect(frozen.input.photoIds).toEqual([p1, p2]);
    }

    const whole = validateAndBuildShareInput(
      baseDraft({ photoScope: "whole", selectedPhotoIds: [p1] }),
    );
    expect(whole.ok).toBe(true);
    if (whole.ok) {
      expect(whole.input.photoIds).toBeNull();
    }
  });
});

function samplePhoto(overrides: Partial<Photo> = {}): Photo {
  return {
    id: "p-1",
    name: "DSC_0001.jpg",
    width: 1600,
    height: 1067,
    bytes: 2_000_000,
    orientation: "landscape",
    thumbStatus: "ready",
    takenAt: "2026-10-01T10:00:00.000Z",
    sortIndex: 0,
    ...overrides,
  };
}

describe("countAlbumPhotosByFilter & filterAlbumPhotos", () => {
  const photos: Photo[] = [
    samplePhoto({ id: "p1", name: "Ceremony_01.jpg", orientation: "landscape", thumbStatus: "ready" }),
    samplePhoto({ id: "p2", name: "Portrait_02.jpg", orientation: "portrait", thumbStatus: "ready" }),
    samplePhoto({ id: "p3", name: "Ceremony_03.jpg", orientation: "portrait", thumbStatus: "pending" }),
    samplePhoto({ id: "p4", name: "Reception_04.jpg", orientation: "landscape", thumbStatus: "failed" }),
  ];

  it("counts orientations and thumbnail statuses including broken runtime thumbnails", () => {
    expect(countAlbumPhotosByFilter(photos, { p2: true })).toEqual({
      all: 4,
      landscape: 2,
      portrait: 2,
      ready: 1,
      pending: 1,
      failed: 2,
    });
  });

  it("filters by query, orientation, and thumbnail status", () => {
    expect(
      filterAlbumPhotos(photos, {
        query: "ceremony",
        orientation: "portrait",
        statusFilter: "pending",
      }).map((p) => p.id),
    ).toEqual(["p3"]);

    expect(
      filterAlbumPhotos(photos, {
        query: "",
        orientation: "all",
        statusFilter: "failed",
        brokenThumbIds: { p2: true },
      }).map((p) => p.id),
    ).toEqual(["p2", "p4"]);
  });
});
