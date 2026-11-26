/**
 * Cross-boundary branding values. Organization rows use explicit columns; a share
 * stores an override object where a missing key falls back to album, then organization.
 */
export interface BrandingOverride {
  title?: string;
  logo?: string;
  accent?: string;
  welcomeMessage?: string;
}

export interface AccentPreset {
  label: string;
  hex: string;
}

export const ACCENT_PRESETS: readonly AccentPreset[] = [
  { label: "Lime leaf", hex: "#d9ef63" },
  { label: "Warm ochre", hex: "#d4a24c" },
  { label: "Pale sky", hex: "#b8d8e8" },
  { label: "Blush", hex: "#f0c9c0" },
  { label: "Mint", hex: "#c9f0d4" },
  { label: "Butter", hex: "#f5e6a8" },
] as const;

/**
 * Effective branding resolved on the server (share override -> album -> organization).
 * Footer attribution visibility is organization-scoped (`organizations.footer_enabled`)
 * so studio policy applies consistently across all public links.
 */
export interface ResolvedBranding {
  title: string;
  logo: string | null;
  accent: string | null;
  welcomeMessage: string | null;
  footerEnabled: boolean;
}
