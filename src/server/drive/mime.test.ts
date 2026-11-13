import { describe, expect, it } from "vitest";

import { fileExtension, isImageFile } from "./mime";

describe("fileExtension", () => {
  it("lowercases the extension and tolerates missing dots", () => {
    expect(fileExtension("TOP00607.JPG")).toBe("jpg");
    expect(fileExtension("DSC01234.ARW")).toBe("arw");
    expect(fileExtension("no-extension")).toBe("");
    expect(fileExtension("archive.tar.gz")).toBe("gz");
  });
});

describe("isImageFile", () => {
  it("accepts anything Drive reports as an image", () => {
    expect(isImageFile({ name: "photo.jpg", mimeType: "image/jpeg" })).toBe(true);
    expect(isImageFile({ name: "raw.raw", mimeType: "image/arw" })).toBe(true);
    expect(isImageFile({ name: "shot.heic", mimeType: "image/heic" })).toBe(true);
  });

  it("never accepts a video MIME even when the name looks like a photo", () => {
    expect(isImageFile({ name: "clip.jpg", mimeType: "video/mp4" })).toBe(false);
  });

  it("falls back to the extension for RAW reported as a generic binary", () => {
    expect(isImageFile({ name: "DSC01234.ARW", mimeType: "application/octet-stream" })).toBe(
      true,
    );
    expect(isImageFile({ name: "IMG_0001.CR3", mimeType: "application/octet-stream" })).toBe(
      true,
    );
  });

  it("rejects unknown binaries and extensionless names", () => {
    expect(isImageFile({ name: "notes.txt", mimeType: "application/octet-stream" })).toBe(
      false,
    );
    expect(isImageFile({ name: "README", mimeType: null })).toBe(false);
    expect(isImageFile({ name: "photo.jpg", mimeType: null })).toBe(true);
  });
});
