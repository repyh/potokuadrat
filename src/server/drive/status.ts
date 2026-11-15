import "server-only";

import type { DriveStatus } from "@/contracts/admin";

import type { DriveClient } from "./client";
import { getDriveRuntime } from "./index";

export interface DriveStatusDeps {
  configured: () => boolean;
  drive: () => Pick<DriveClient, "listSharedDrives" | "listSharedFolders">;
  now?: () => Date;
}

export type DriveStatusCheck = () => Promise<DriveStatus>;

/**
 * Probes the service account with a read-only listing. Errors never reach the client:
 * the UI only learns whether the connection is missing, reachable, or failing.
 */
export function createDriveStatusCheck(deps: DriveStatusDeps): DriveStatusCheck {
  return async () => {
    const checkedAt = (deps.now?.() ?? new Date()).toISOString();

    if (!deps.configured()) {
      return {
        state: "not_configured",
        message: "Google Drive credentials are not configured.",
        folderCount: null,
        checkedAt,
      };
    }

    try {
      const drive = deps.drive();
      const [sharedDrives, sharedFolders] = await Promise.all([
        drive.listSharedDrives(),
        drive.listSharedFolders(),
      ]);

      return {
        state: "reachable",
        message: "Drive is reachable.",
        folderCount: sharedDrives.length + sharedFolders.length,
        checkedAt,
      };
    } catch {
      return {
        state: "failing",
        message: "Drive could not be reached with the current service account.",
        folderCount: null,
        checkedAt,
      };
    }
  };
}

export const checkDriveStatus = createDriveStatusCheck({
  configured: () => Boolean(process.env.GOOGLE_DRIVE_KEY_FILE?.trim()),
  drive: () => getDriveRuntime().client,
});
