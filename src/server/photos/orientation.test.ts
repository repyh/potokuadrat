import { describe, expect, it } from "vitest";

import { orientationFor } from "./orientation";

describe("orientationFor", () => {
  it("classifies landscape, portrait, and square", () => {
    expect(orientationFor(6000, 4000)).toBe("landscape");
    expect(orientationFor(4000, 6000)).toBe("portrait");
    expect(orientationFor(4000, 4000)).toBe("landscape");
  });

  it("returns unknown when dimensions are missing", () => {
    expect(orientationFor(null, 4000)).toBe("unknown");
    expect(orientationFor(0, 0)).toBe("unknown");
    expect(orientationFor(undefined, undefined)).toBe("unknown");
  });
});
