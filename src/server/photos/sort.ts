const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/** Natural filename order: `TOP2.jpg` sorts before `TOP10.jpg`. */
export function naturalCompare(a: string, b: string): number {
  return collator.compare(a, b);
}
