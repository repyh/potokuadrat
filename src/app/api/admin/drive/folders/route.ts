import type { DriveFoldersResponse } from "@/contracts/admin";
import { getAdminSession, jsonError } from "@/server/auth/api";
import { listDriveFolderOptions } from "@/server/drive/folders";

export async function GET(): Promise<Response> {
  const session = await getAdminSession();
  if (!session) {
    return jsonError(401, "Unauthorized.");
  }

  const listing = await listDriveFolderOptions();
  if (listing.error) {
    return jsonError(502, listing.error);
  }

  const body: DriveFoldersResponse = { folders: listing.folders };
  return Response.json(body);
}
