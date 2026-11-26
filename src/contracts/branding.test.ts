import { describe, expect, it } from "vitest";

import { ACCENT_PRESETS } from "./branding";

const INK = "#183c34";

function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastWithInk(hex: string): number {
  const accent = luminance(hex);
  const ink = luminance(INK);
  const [lighter, darker] = accent > ink ? [accent, ink] : [ink, accent];
  return (lighter + 0.05) / (darker + 0.05);
}

describe("ACCENT_PRESETS", () => {
  it("keeps ink text on a primary button readable", () => {
    for (const preset of ACCENT_PRESETS) {
      expect(contrastWithInk(preset.hex), preset.label).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("uses six-digit hex colors", () => {
    for (const preset of ACCENT_PRESETS) {
      expect(preset.hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
