export function adminPhotoThumbUrl(albumId: string, photoId: string, width = 400): string {
  return `/api/admin/albums/${encodeURIComponent(albumId)}/photos/${encodeURIComponent(photoId)}/thumb?w=${width}`;
}

export function movePhoto<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return [...items];
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function formatPhotoBytes(bytes: number | null): string {
  if (bytes === null || bytes < 0) {
    return "—";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb >= 100 ? Math.round(kb) : kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  if (mb < 1024) {
    return `${mb >= 100 ? Math.round(mb) : mb.toFixed(1)} MB`;
  }
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

export function formatPhotoDimensions(width: number | null, height: number | null): string {
  if (!width || !height || width <= 0 || height <= 0) {
    return "—";
  }
  return `${width} × ${height}`;
}
