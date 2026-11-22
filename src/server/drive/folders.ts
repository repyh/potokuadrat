import "server-only";

import type { DriveFolderOption } from "@/contracts/admin";

import { DriveError } from "./client";
import { readDriveConfig } from "./config";
import { getDriveRuntime } from "./index";

export interface DriveFolderListing {
  /** Shared Drives first, then folders shared with the service account. */
  folders: DriveFolderOption[];
  error: string | null;
  /** Nested folder levels the indexer walks; shown read-only in the picker. */
  maxDepth: number;
}

function configuredDepth(): number {
  try {
    return readDriveConfig().indexMaxDepth;
  } catch {
    return 5;
  }
}

/**
 * Shared folders and drives visible to the service account. Failures never throw:
 * the picker still works by pasting a folder URL, so the caller gets a message.
 */
export async function listDriveFolderOptions(): Promise<DriveFolderListing> {
  const maxDepth = configuredDepth();

  try {
    const drive = getDriveRuntime().client;
    const [sharedFolders, sharedDrives] = await Promise.all([
      drive.listSharedFolders(),
      drive.listSharedDrives(),
    ]);

    return { folders: [...sharedDrives, ...sharedFolders], error: null, maxDepth };
  } catch (error) {
    if (error instanceof DriveError) {
      return {
        folders: [],
        error: "Drive could not list folders for the service account.",
        maxDepth,
      };
    }
    console.error("[admin] folder discovery failed:", error);
    return { folders: [], error: "Folder discovery failed.", maxDepth };
  }
}
