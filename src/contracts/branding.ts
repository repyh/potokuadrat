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
  { label: "Terracotta", hex: "#b4532a" },
  { label: "Botanical ink", hex: "#183c34" },
  { label: "Warm ochre", hex: "#d4a24c" },
  { label: "Slate blue", hex: "#3d5a73" },
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
