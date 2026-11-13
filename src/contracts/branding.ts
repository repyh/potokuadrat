/**
 * Cross-boundary branding values. Organization rows use explicit columns; a share
 * stores an override object where a missing key falls back to the organization.
 */
export interface BrandingOverride {
  title?: string;
  logo?: string;
  accent?: string;
  welcomeMessage?: string;
}
