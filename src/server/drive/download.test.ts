import { describe, expect, it } from "vitest";

import { baseName, makeContentDisposition } from "./download";

describe("makeContentDisposition", () => {
  it("keeps a normal filename", () => {
    expect(makeContentDisposition("TOP00607.jpg")).toBe('attachment; filename="TOP00607.jpg"');
  });

  it("neutralises quotes and CR/LF", () => {
    expect(makeContentDisposition('a"b\r\nc.jpg')).toBe('attachment; filename="a_b__c.jpg"');
  });

  it("replaces characters outside the allow-list", () => {
    expect(makeContentDisposition("foto 01 – akhir.jpg")).toBe(
      'attachment; filename="foto 01 _ akhir.jpg"',
    );
  });

  it("falls back when the name is empty", () => {
    expect(makeContentDisposition("")).toBe('attachment; filename="photo"');
  });
});

describe("baseName", () => {
  it("drops only the final extension", () => {
    expect(baseName("TOP00607.jpg")).toBe("TOP00607");
    expect(baseName("archive.tar.gz")).toBe("archive.tar");
    expect(baseName("no-extension")).toBe("no-extension");
    expect(baseName("")).toBe("photo");
  });
});
