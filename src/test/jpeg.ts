export const SOI = Buffer.from([0xff, 0xd8]);
export const EOI = Buffer.from([0xff, 0xd9]);

export function segment(marker: number, payload: Buffer | string = Buffer.alloc(0)): Buffer {
  const data = typeof payload === "string" ? Buffer.from(payload, "binary") : payload;
  const header = Buffer.from([0xff, marker, 0x00, 0x00]);
  header.writeUInt16BE(data.length + 2, 2);
  return Buffer.concat([header, data]);
}

/** Minimal but structurally valid JPEG: SOI, APP0, extras, DQT, SOF0, SOS, entropy, EOI. */
export function buildJpeg(extra: Buffer[] = [], entropy: Buffer = Buffer.from([0x12, 0x34])): Buffer {
  return Buffer.concat([
    SOI,
    segment(0xe0, "JFIF\0"),
    ...extra,
    segment(0xdb, Buffer.alloc(4, 0x01)),
    segment(0xc0, Buffer.from([0x08, 0x00, 0x08, 0x00, 0x08, 0x03])),
    segment(0xda),
    entropy,
    EOI,
  ]);
}

/** Marker bytes in order, including SOS (0xda) where scanning stops. */
export function jpegMarkers(buffer: Buffer): number[] {
  const markers: number[] = [];
  let pos = 2;

  while (pos + 4 <= buffer.length && buffer[pos] === 0xff) {
    const marker = buffer[pos + 1];
    markers.push(marker);
    if (marker === 0xda || marker === 0xd9) {
      break;
    }
    const length = buffer.readUInt16BE(pos + 2);
    if (length < 2) {
      break;
    }
    pos += 2 + length;
  }

  return markers;
}
