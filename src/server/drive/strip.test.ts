import { describe, expect, it } from "vitest";

import { buildJpeg, jpegMarkers, segment } from "@/test/jpeg";

import { stripJpegMetadata } from "./strip";

const exif = segment(0xe1, "Exif\0\0MM\0*\0\0\0GPS");
const iptc = segment(0xed, "Photoshop 3.0\0IPTC");
const comment = segment(0xfe, "shot by a named photographer");

describe("stripJpegMetadata", () => {
  it("removes APP1, APP13, and COM segments", () => {
    const input = buildJpeg([exif, iptc, comment]);
    const output = stripJpegMetadata(input);

    expect(jpegMarkers(output)).toEqual([0xe0, 0xdb, 0xc0, 0xda]);
    expect(output.length).toBe(input.length - exif.length - iptc.length - comment.length);
    expect(output.includes(Buffer.from("Photoshop 3.0"))).toBe(false);
    expect(output.includes(Buffer.from("shot by a named photographer"))).toBe(false);
    expect(output.includes(Buffer.from("Exif"))).toBe(false);
  });

  it("keeps pixels, dimensions, and colour data untouched", () => {
    const input = buildJpeg([exif]);
    const output = stripJpegMetadata(input);
    const inputTailStart = input.indexOf(Buffer.from([0xff, 0xdb]));
    const outputTailStart = output.indexOf(Buffer.from([0xff, 0xdb]));

    expect(output.subarray(outputTailStart)).toEqual(input.subarray(inputTailStart));
  });

  it("returns non-JPEG input byte for byte", () => {
    const notJpeg = Buffer.from("plain text pretending to be an image");
    expect(stripJpegMetadata(notJpeg)).toEqual(notJpeg);
  });

  it("returns a malformed JPEG untouched instead of corrupting it", () => {
    const input = buildJpeg([exif]);
    const truncated = input.subarray(0, 12);
    expect(stripJpegMetadata(truncated)).toEqual(truncated);
  });

  it("accepts Uint8Array input", () => {
    const input = buildJpeg([exif]);
    expect(stripJpegMetadata(new Uint8Array(input))).toEqual(stripJpegMetadata(input));
  });
});
