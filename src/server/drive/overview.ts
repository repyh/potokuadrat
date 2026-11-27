import "server-only";

import type { DriveFolderOption, DriveStatus } from "@/contracts/admin";

import { loadServiceAccount, readDriveConfig } from "./config";
import { listDriveFolderOptions } from "./folders";
import { checkDriveStatus } from "./status";

export interface DriveLimits {
  indexMaxDepth: number;
  concurrency: number;
  cacheMaxBytes: number;
  cacheMaxFiles: number;
  evictionPolicy: "LRU";
}

export interface DriveOverview {
  status: DriveStatus;
  serviceAccountEmail: string | null;
  folders: DriveFolderOption[];
  foldersError: string | null;
  limits: DriveLimits;
}

const DEFAULT_CACHE_BYTES = 5 * 1024 ** 3;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

export function readDriveLimits(
  env: Readonly<Record<string, string | undefined>> = process.env,
): DriveLimits {
  try {
    const cfg = readDriveConfig(env);
    return {
      indexMaxDepth: cfg.indexMaxDepth,
      concurrency: cfg.concurrency,
      cacheMaxBytes: cfg.cacheMaxBytes,
      cacheMaxFiles: cfg.cacheMaxFiles,
      evictionPolicy: "LRU",
    };
  } catch {
    return {
      indexMaxDepth: parsePositiveInt(env.DRIVE_INDEX_MAX_DEPTH, 5),
      concurrency: parsePositiveInt(env.DRIVE_CONCURRENCY, 4),
      cacheMaxBytes: parsePositiveInt(env.THUMB_CACHE_MAX_BYTES, DEFAULT_CACHE_BYTES),
      cacheMaxFiles: parsePositiveInt(env.THUMB_CACHE_MAX_FILES, 200_000),
      evictionPolicy: "LRU",
    };
  }
}

async function resolveServiceAccountEmail(): Promise<string | null> {
  const keyFile = process.env.GOOGLE_DRIVE_KEY_FILE?.trim();
  if (!keyFile) {
    return null;
  }
  try {
    const account = await loadServiceAccount(keyFile);
    return account.client_email;
  } catch {
    return null;
  }
}

export async function getDriveOverview(): Promise<DriveOverview> {
  const [status, listing, serviceAccountEmail] = await Promise.all([
    checkDriveStatus(),
    listDriveFolderOptions(),
    resolveServiceAccountEmail(),
  ]);

  return {
    status,
    serviceAccountEmail,
    folders: listing.folders,
    foldersError: listing.error,
    limits: readDriveLimits(),
  };
}
