import "server-only";

import { readFile } from "node:fs/promises";

import type { ServiceAccount } from "./jwt";

export interface DriveConfig {
  keyFile: string;
  /** Nested folder levels below an album folder. */
  indexMaxDepth: number;
  concurrency: number;
  cacheDir: string;
  cacheMaxBytes: number;
  cacheMaxFiles: number;
  stripMetadata: boolean;
}

function positiveInt(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer, received "${value}".`);
  }
  return parsed;
}

export function readDriveConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): DriveConfig {
  const keyFile = env.GOOGLE_DRIVE_KEY_FILE?.trim();
  if (!keyFile) {
    throw new Error("GOOGLE_DRIVE_KEY_FILE must point at a service-account JSON key.");
  }

  const stripSetting = (env.STRIP_METADATA ?? "1").trim().toLowerCase();

  return {
    keyFile,
    indexMaxDepth: positiveInt(env.DRIVE_INDEX_MAX_DEPTH, 5, "DRIVE_INDEX_MAX_DEPTH"),
    concurrency: positiveInt(env.DRIVE_CONCURRENCY, 4, "DRIVE_CONCURRENCY"),
    cacheDir: env.THUMB_CACHE_DIR?.trim() || ".cache/thumbs",
    cacheMaxBytes: positiveInt(env.THUMB_CACHE_MAX_BYTES, 5 * 1024 ** 3, "THUMB_CACHE_MAX_BYTES"),
    cacheMaxFiles: positiveInt(env.THUMB_CACHE_MAX_FILES, 200_000, "THUMB_CACHE_MAX_FILES"),
    stripMetadata: !["0", "false", "no"].includes(stripSetting),
  };
}

export function parseServiceAccount(raw: string): ServiceAccount {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Service-account key is not valid JSON.");
  }

  const account = parsed as Partial<ServiceAccount>;
  if (typeof account.client_email !== "string" || !account.client_email.includes("@")) {
    throw new Error("Service-account key is missing client_email.");
  }
  if (typeof account.private_key !== "string" || !account.private_key.includes("PRIVATE KEY")) {
    throw new Error("Service-account key is missing private_key.");
  }

  return {
    client_email: account.client_email,
    private_key: account.private_key.replace(/\\n/g, "\n"),
  };
}

const accountCache = new Map<string, Promise<ServiceAccount>>();

/** Reads and validates the key once per process. */
export function loadServiceAccount(keyFile: string): Promise<ServiceAccount> {
  let pending = accountCache.get(keyFile);
  if (!pending) {
    pending = readFile(keyFile, "utf8").then(parseServiceAccount);
    pending.catch(() => accountCache.delete(keyFile));
    accountCache.set(keyFile, pending);
  }
  return pending;
}
