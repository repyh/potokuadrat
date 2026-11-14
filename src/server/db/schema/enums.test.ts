import { describe, expect, it } from "vitest";

import { ALBUM_STATUSES, THUMB_STATUSES } from "@/contracts/album";
import { DOWNLOAD_QUALITIES, SHARE_MODES } from "@/contracts/share";

import { albumStatus, downloadQuality, shareMode, thumbStatus } from "./enums";

/**
 * The contracts intentionally do not import server code, so the enum values are
 * declared twice. This test is the guard against drift.
 */
describe("schema enums match the shared contracts", () => {
  it("album status", () => {
    expect(albumStatus.enumValues).toEqual([...ALBUM_STATUSES]);
  });

  it("thumbnail status", () => {
    expect(thumbStatus.enumValues).toEqual([...THUMB_STATUSES]);
  });

  it("share mode", () => {
    expect(shareMode.enumValues).toEqual([...SHARE_MODES]);
  });

  it("download quality", () => {
    expect(downloadQuality.enumValues).toEqual([...DOWNLOAD_QUALITIES]);
  });
});
