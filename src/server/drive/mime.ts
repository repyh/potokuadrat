const RAW_EXTENSIONS = new Set([
  "3fr",
  "arw",
  "cr2",
  "cr3",
  "dng",
  "erf",
  "iiq",
  "mef",
  "mos",
  "nef",
  "nrw",
  "orf",
  "pef",
  "raf",
  "rw2",
  "srw",
  "x3f",
]);

const IMAGE_EXTENSIONS = new Set([
  "avif",
  "bmp",
  "gif",
  "heic",
  "heif",
  "jpeg",
  "jpg",
  "png",
  "tif",
  "tiff",
  "webp",
  ...RAW_EXTENSIONS,
]);

export interface DriveFileIdentity {
  name: string;
  mimeType?: string | null;
}

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

/**
 * Drive MIME types are not consistent across cameras: ARW reports `image/arw`, other
 * RAW files can report `application/octet-stream`. The extension is the fallback, but
 * a clear video MIME is never overridden by a name.
 */
export function isImageFile(file: DriveFileIdentity): boolean {
  const mime = file.mimeType?.toLowerCase() ?? "";

  if (mime.startsWith("image/")) {
    return true;
  }
  if (mime.startsWith("video/")) {
    return false;
  }

  return IMAGE_EXTENSIONS.has(fileExtension(file.name));
}
