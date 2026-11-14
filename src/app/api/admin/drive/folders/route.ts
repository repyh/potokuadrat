import type { DriveFoldersResponse } from "@/contracts/admin";
import { getAdminSession, jsonError } from "@/server/auth/api";
import { DriveError } from "@/server/drive/client";
import { getDriveRuntime } from "@/server/drive";

export async function GET(): Promise<Response> {
  const session = await getAdminSession();
  if (!session) {
    return jsonError(401, "Unauthorized.");
  }

  try {
    const drive = getDriveRuntime().client;
    const [sharedFolders, sharedDrives] = await Promise.all([
      drive.listSharedFolders(),
      drive.listSharedDrives(),
    ]);

    const body: DriveFoldersResponse = { folders: [...sharedDrives, ...sharedFolders] };
    return Response.json(body);
  } catch (error) {
    if (error instanceof DriveError) {
      return jsonError(502, "Drive could not list folders for the service account.");
    }
    console.error("[admin] folder discovery failed:", error);
    return jsonError(500, "Folder discovery failed.");
  }
}
