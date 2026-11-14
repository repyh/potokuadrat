/**
 * `Content-Disposition` with a quoted filename. Quotes and CR/LF are replaced before
 * the allow-list so a Drive filename can never break out of the header.
 */
export function makeContentDisposition(filename: string): string {
  const safe = String(filename || "photo")
    .replace(/[\r\n"]/g, "_")
    .replace(/[^A-Za-z0-9._ -]/g, "_");

  return `attachment; filename="${safe || "photo"}"`;
}

/** `TOP00607.jpg` -> `TOP00607`, used for download names with a width suffix. */
export function baseName(filename: string): string {
  return filename.replace(/\.[^.]+$/, "") || "photo";
}
