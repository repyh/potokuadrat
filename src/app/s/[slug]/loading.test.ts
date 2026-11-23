import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ShareLoading from "./loading";

describe("guest folio loading boundary", () => {
  const markup = renderToStaticMarkup(createElement(ShareLoading));

  it("keeps the folio chrome and the filter toolbar", () => {
    expect(markup).toContain("navbar-brand");
    expect(markup).toContain("share-header-actions");
    expect(markup).toContain("share-filter-row");
    expect(markup).toContain("share-toolbar-count");
  });

  it("sizes the title like the real heading", () => {
    expect(markup).toContain("clamp(34px, 4.8vw, 56px)");
  });

  it("uses varied tile aspect ratios instead of one fixed height", () => {
    const tiles = markup.match(/share-tile share-tile-skeleton/g) ?? [];
    const ratios = [
      ...new Set(
        [...markup.matchAll(/aspect-ratio:([^;"]+)/g)].map((match) => match[1].trim()),
      ),
    ];

    expect(tiles).toHaveLength(12);
    expect(ratios.length).toBeGreaterThan(2);
  });
});
