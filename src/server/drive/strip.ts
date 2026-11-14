/**
 * Drops APP1 (EXIF/XMP), APP13 (IPTC) and COM segments without decoding the image, so
 * pixels, dimensions and colour profile are untouched. Anything that is not a
 * well-formed JPEG is returned byte for byte.
 */
export function stripJpegMetadata(input: Buffer | Uint8Array): Buffer {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);

  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return buffer;
  }

  const parts: Buffer[] = [buffer.subarray(0, 2)];
  let pos = 2;

  while (pos + 4 <= buffer.length) {
    if (buffer[pos] !== 0xff) {
      return buffer;
    }

    const marker = buffer[pos + 1];

    if (marker === 0xda || marker === 0xd9) {
      parts.push(buffer.subarray(pos));
      return Buffer.concat(parts);
    }

    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(buffer.subarray(pos, pos + 2));
      pos += 2;
      continue;
    }

    const length = buffer.readUInt16BE(pos + 2);
    if (length < 2 || pos + 2 + length > buffer.length) {
      return buffer;
    }

    const drop = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (!drop) {
      parts.push(buffer.subarray(pos, pos + 2 + length));
    }
    pos += 2 + length;
  }

  // Ran out of bytes before SOS/EOI: the JPEG is truncated, so return it untouched
  // instead of handing back a partial image.
  return buffer;
}
