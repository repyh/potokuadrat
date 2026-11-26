import type { BrandingOverride } from "@/contracts/branding";
import type { CreateShareInput, DownloadQuality, ShareMode } from "@/contracts/share";

export type MetadataPolicyChoice = "inherit" | "strip" | "keep";
export type ExpiryChoice = "never" | "date";

export interface ShareComposerDraft {
  albumId: string;
  mode: ShareMode;
  password: string;
  recipientsText: string;
  expiryChoice: ExpiryChoice;
  expiryDate: string;
  allowDownload: boolean;
  allowOriginal: boolean;
  allowWeb: boolean;
  metadataPolicy: MetadataPolicyChoice;
  brandingTitle: string;
  brandingAccent: string;
  brandingWelcomeMessage: string;
}

export interface ShareComposerErrors {
  albumId?: string;
  password?: string;
  recipients?: string;
  expiryDate?: string;
  qualities?: string;
  brandingTitle?: string;
  brandingAccent?: string;
  brandingWelcomeMessage?: string;
}

const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function parseRecipients(raw: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const part of raw.split(/[\n,]+/)) {
    const email = part.trim();
    if (!email) {
      continue;
    }
    const key = email.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(email);
  }

  return result;
}

export function validateAndBuildShareInput(
  draft: ShareComposerDraft,
): { ok: true; albumId: string; input: CreateShareInput } | { ok: false; errors: ShareComposerErrors } {
  const errors: ShareComposerErrors = {};
  const albumId = draft.albumId.trim();

  if (!albumId) {
    errors.albumId = "Choose an album for this share.";
  }

  if (draft.mode === "password") {
    if (draft.password.length < 8) {
      errors.password = "Use at least 8 characters for the share password.";
    } else if (draft.password.length > 200) {
      errors.password = "Keep the share password under 200 characters.";
    }
  }

  const recipients = draft.mode === "magic_link" ? parseRecipients(draft.recipientsText) : [];
  if (draft.mode === "magic_link") {
    if (recipients.length > 50) {
      errors.recipients = "Add at most 50 recipients at once.";
    } else {
      const invalidEmail = recipients.find((email) => !SIMPLE_EMAIL_PATTERN.test(email));
      if (invalidEmail) {
        errors.recipients = `Enter a valid email address (${invalidEmail}).`;
      }
    }
  }

  let expiresAt: string | null = null;
  if (draft.expiryChoice === "date") {
    const trimmedDate = draft.expiryDate.trim();
    if (!DATE_INPUT_PATTERN.test(trimmedDate)) {
      errors.expiryDate = "Choose an expiration date.";
    } else {
      const parsed = new Date(`${trimmedDate}T23:59:59.999Z`);
      if (Number.isNaN(parsed.getTime())) {
        errors.expiryDate = "Enter a valid expiration date.";
      } else {
        expiresAt = parsed.toISOString();
      }
    }
  }

  const allowedQualities: DownloadQuality[] = [];
  if (draft.allowDownload) {
    if (draft.allowOriginal) {
      allowedQualities.push("original");
    }
    if (draft.allowWeb) {
      allowedQualities.push("web");
    }
    if (allowedQualities.length === 0) {
      errors.qualities = "Keep at least one download quality enabled.";
    }
  }

  const title = draft.brandingTitle.trim();
  const accent = draft.brandingAccent.trim();
  const welcomeMessage = draft.brandingWelcomeMessage.trim();

  if (title.length > 120) {
    errors.brandingTitle = "Keep the title under 120 characters.";
  }
  if (accent && !HEX_COLOR_PATTERN.test(accent)) {
    errors.brandingAccent = "Use a six-digit hex color like #b4532a.";
  }
  if (welcomeMessage.length > 500) {
    errors.brandingWelcomeMessage = "Keep the welcome note under 500 characters.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const branding: BrandingOverride = {};
  if (title) {
    branding.title = title;
  }
  if (accent) {
    branding.accent = accent;
  }
  if (welcomeMessage) {
    branding.welcomeMessage = welcomeMessage;
  }

  const stripMetadata =
    draft.metadataPolicy === "inherit" ? null : draft.metadataPolicy === "strip";

  const input: CreateShareInput = {
    mode: draft.mode,
    expiresAt,
    allowDownload: draft.allowDownload,
    ...(draft.allowDownload ? { allowedQualities } : {}),
    stripMetadata,
    branding: Object.keys(branding).length > 0 ? branding : null,
    // Frozen subset picker requires the album media workspace (#77).
    photoIds: null,
    ...(draft.mode === "password" ? { password: draft.password } : {}),
    ...(draft.mode === "magic_link" && recipients.length > 0 ? { recipients } : {}),
  };

  return { ok: true, albumId, input };
}
