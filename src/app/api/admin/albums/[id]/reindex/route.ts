import { getAdminSession, jsonError } from "@/server/auth/api";
import { getAlbumService } from "@/server/albums/runtime";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getAdminSession();
  if (!session) {
    return jsonError(401, "Unauthorized.");
  }

  const { id } = await params;
  const queued = await getAlbumService().reindex(id);

  if (!queued) {
    return jsonError(404, "Album not found.");
  }

  return Response.json({ ok: true, data: { albumId: id } }, { status: 202 });
}
