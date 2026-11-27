import "server-only";

import type { BrandingOverride, ResolvedBranding } from "@/contracts/branding";

export interface BrandingResolutionInput {
  share: BrandingOverride | null | undefined;
  album: BrandingOverride | null | undefined;
  organization: {
    name?: string | null;
    title?: string | null;
    logo?: string | null;
    accent?: string | null;
    footerEnabled?: boolean;
  } | null;
}

function pickNonEmpty(...candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return null;
}

/**
 * Resolves effective client folio branding on the server without UI merging:
 * share override -> album override -> organization default -> shipped default.
 */
export function resolveEffectiveBranding(input: BrandingResolutionInput): ResolvedBranding {
  const title =
    pickNonEmpty(
      input.share?.title,
      input.album?.title,
      input.organization?.title,
      input.organization?.name,
    ) ?? "Potokuadrat";

  const logo = pickNonEmpty(input.share?.logo, input.album?.logo, input.organization?.logo);
  const accent = pickNonEmpty(
    input.share?.accent,
    input.album?.accent,
    input.organization?.accent,
  );
  const welcomeMessage = pickNonEmpty(
    input.share?.welcomeMessage,
    input.album?.welcomeMessage,
  );

  return {
    title,
    logo,
    accent,
    welcomeMessage,
    footerEnabled: input.organization?.footerEnabled ?? true,
  };
}
