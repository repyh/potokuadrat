import { getAdminSession, jsonError } from "@/server/auth/api";
import { getAlbumService } from "@/server/albums/runtime";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getAdminSession();
  if (!session) {
    return jsonError(401, "Unauthorized.");
  }

  const { id } = await params;
  const album = await getAlbumService().detail(id);

  if (!album) {
    return jsonError(404, "Album not found.");
  }

  return Response.json({ album });
}
