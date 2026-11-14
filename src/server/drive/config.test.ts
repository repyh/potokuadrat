import { describe, expect, it } from "vitest";

import { parseServiceAccount, readDriveConfig } from "./config";

describe("readDriveConfig", () => {
  it("requires a service-account key", () => {
    expect(() => readDriveConfig({})).toThrow(/GOOGLE_DRIVE_KEY_FILE/);
  });

  it("uses the documented defaults", () => {
    const config = readDriveConfig({ GOOGLE_DRIVE_KEY_FILE: "/run/secrets/key.json" });

    expect(config).toEqual({
      keyFile: "/run/secrets/key.json",
      indexMaxDepth: 5,
      concurrency: 4,
      cacheDir: ".cache/thumbs",
      cacheMaxBytes: 5 * 1024 ** 3,
      cacheMaxFiles: 200_000,
      stripMetadata: true,
    });
  });

  it("reads overrides and treats 0/false/no as strip off", () => {
    const config = readDriveConfig({
      GOOGLE_DRIVE_KEY_FILE: "/run/secrets/key.json",
      DRIVE_INDEX_MAX_DEPTH: "2",
      DRIVE_CONCURRENCY: "8",
      THUMB_CACHE_DIR: "/var/cache/thumbs",
      THUMB_CACHE_MAX_BYTES: "1024",
      THUMB_CACHE_MAX_FILES: "10",
      STRIP_METADATA: "false",
    });

    expect(config.indexMaxDepth).toBe(2);
    expect(config.concurrency).toBe(8);
    expect(config.cacheDir).toBe("/var/cache/thumbs");
    expect(config.cacheMaxBytes).toBe(1024);
    expect(config.cacheMaxFiles).toBe(10);
    expect(config.stripMetadata).toBe(false);
  });

  it("rejects non-positive integers", () => {
    expect(() =>
      readDriveConfig({ GOOGLE_DRIVE_KEY_FILE: "k", DRIVE_INDEX_MAX_DEPTH: "0" }),
    ).toThrow(/DRIVE_INDEX_MAX_DEPTH/);
    expect(() =>
      readDriveConfig({ GOOGLE_DRIVE_KEY_FILE: "k", THUMB_CACHE_MAX_BYTES: "ten" }),
    ).toThrow(/THUMB_CACHE_MAX_BYTES/);
  });
});

describe("parseServiceAccount", () => {
  it("accepts a key file and unescapes newlines", () => {
    const account = parseServiceAccount(
      JSON.stringify({
        client_email: "gallery@example.iam.gserviceaccount.com",
        private_key: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
      }),
    );

    expect(account.client_email).toBe("gallery@example.iam.gserviceaccount.com");
    expect(account.private_key).toContain("\nabc\n");
  });

  it("rejects invalid JSON and incomplete keys", () => {
    expect(() => parseServiceAccount("{")).toThrow(/valid JSON/);
    expect(() => parseServiceAccount(JSON.stringify({ client_email: "x" }))).toThrow(
      /client_email/,
    );
    expect(() => parseServiceAccount(JSON.stringify({ client_email: "a@b", private_key: "x" }))).toThrow(
      /private_key/,
    );
  });
});
