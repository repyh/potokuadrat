"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/contracts/actions";
import type { DriveFolderOption, DriveStatus } from "@/contracts/admin";
import { getAdminSession } from "@/server/auth/api";
import { listDriveFolderOptions } from "@/server/drive/folders";
import { checkDriveStatus } from "@/server/drive/status";

export interface RecheckDriveResult {
  status: DriveStatus;
  folders: DriveFolderOption[];
  foldersError: string | null;
}

export async function recheckDriveAction(): Promise<ActionResult<RecheckDriveResult>> {
  const session = await getAdminSession();
  if (!session) {
    return { ok: false, error: "Unauthorized.", code: "unauthorized" };
  }

  const [status, listing] = await Promise.all([
    checkDriveStatus(),
    listDriveFolderOptions(),
  ]);

  revalidatePath("/admin/drive");
  revalidatePath("/admin");

  return {
    ok: true,
    data: {
      status,
      folders: listing.folders,
      foldersError: listing.error,
    },
  };
}
