/**
 * Utility functions for parsing and validating Google Drive folder links and IDs.
 */

export function extractDriveFolderId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }

  // Handle full Google Drive URLs like https://drive.google.com/drive/folders/1XtiPMDZ5FWFJv...
  // or https://drive.google.com/drive/u/0/folders/1XtiPMDZ5FWFJv...
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match?.[1]) {
    return match[1];
  }

  // Handle direct id or query parameter link id=...
  const queryMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (queryMatch?.[1]) {
    return queryMatch[1];
  }

  return trimmed;
}

export function isValidDriveFolderId(id: string): boolean {
  const trimmed = id.trim();
  // Google Drive folder IDs are typically alphanumeric with hyphens/underscores, at least 10 chars
  return /^[a-zA-Z0-9_-]{10,100}$/.test(trimmed);
}
