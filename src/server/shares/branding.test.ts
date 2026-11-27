import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { resolveEffectiveBranding } from "./branding";

describe("resolveEffectiveBranding", () => {
  it("prioritizes share override over album and organization defaults", () => {
    expect(
      resolveEffectiveBranding({
        share: {
          title: "Share Title",
          accent: "#b4532a",
          logo: "/api/branding/logo/share.png",
          welcomeMessage: "Share welcome",
        },
        album: {
          title: "Album Title",
          accent: "#183c34",
          logo: "/api/branding/logo/album.png",
          welcomeMessage: "Album welcome",
        },
        organization: {
          name: "Studio Name",
          title: "Org Title",
          logo: "/api/branding/logo/org.png",
          accent: "#d9ef63",
          footerEnabled: false,
        },
      }),
    ).toEqual({
      title: "Share Title",
      logo: "/api/branding/logo/share.png",
      accent: "#b4532a",
      welcomeMessage: "Share welcome",
      footerEnabled: false,
    });
  });

  it("falls back through album, organization title/name, and Potokuadrat default", () => {
    expect(
      resolveEffectiveBranding({
        share: { title: "   " },
        album: null,
        organization: {
          name: "Studio Kusuma",
          title: null,
          logo: "https://example.com/logo.png",
          accent: "#3d5a73",
          footerEnabled: true,
        },
      }),
    ).toEqual({
      title: "Studio Kusuma",
      logo: "https://example.com/logo.png",
      accent: "#3d5a73",
      welcomeMessage: null,
      footerEnabled: true,
    });

    expect(
      resolveEffectiveBranding({
        share: null,
        album: null,
        organization: null,
      }),
    ).toEqual({
      title: "Potokuadrat",
      logo: null,
      accent: null,
      welcomeMessage: null,
      footerEnabled: true,
    });
  });
});
