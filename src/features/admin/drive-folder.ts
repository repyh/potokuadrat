/** Accepts a bare Drive folder id or a folder URL and returns the id. */
export function extractDriveFolderId(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? trimmed;
}
