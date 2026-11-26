import type { PhotoSort } from "@/contracts/album";

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/** Natural filename order: `TOP2.jpg` sorts before `TOP10.jpg`. */
export function naturalCompare(a: string, b: string): number {
  return collator.compare(a, b);
}

export interface SortablePhoto {
  id: string;
  name: string;
  takenAt: Date | null;
  sortIndex: number;
}

export function comparePhotos(a: SortablePhoto, b: SortablePhoto, sort: PhotoSort): number {
  if (sort === "name") {
    const byName = naturalCompare(a.name, b.name);
    if (byName !== 0) {
      return byName;
    }
  } else if (sort === "taken") {
    const aTime = a.takenAt ? a.takenAt.getTime() : null;
    const bTime = b.takenAt ? b.takenAt.getTime() : null;
    if (aTime !== null && bTime !== null) {
      if (aTime !== bTime) {
        return aTime - bTime;
      }
    } else if (aTime !== null) {
      return -1;
    } else if (bTime !== null) {
      return 1;
    }
  }

  if (a.sortIndex !== b.sortIndex) {
    return a.sortIndex - b.sortIndex;
  }
  return a.id.localeCompare(b.id);
}
