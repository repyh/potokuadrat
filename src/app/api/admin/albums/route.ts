import { getAdminSession, jsonError } from "@/server/auth/api";
import { getAlbumService } from "@/server/albums/runtime";
import { AlbumValidationError } from "@/server/albums/service";
import { createAlbumSchema } from "@/server/albums/validation";

export async function GET(): Promise<Response> {
  const session = await getAdminSession();
  if (!session) {
    return jsonError(401, "Unauthorized.");
  }

  const albums = await getAlbumService().list(session.user.id);
  return Response.json({ albums });
}

export async function POST(request: Request): Promise<Response> {
  const session = await getAdminSession();
  if (!session) {
    return jsonError(401, "Unauthorized.");
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createAlbumSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid album input." },
      { status: 400 },
    );
  }

  try {
    const album = await getAlbumService().create(session.user.id, parsed.data);
    return Response.json({ ok: true, data: album }, { status: 201 });
  } catch (error) {
    if (error instanceof AlbumValidationError) {
      return Response.json({ ok: false, error: error.message }, { status: 400 });
    }
    console.error("[admin] album creation failed:", error);
    return Response.json(
      { ok: false, error: "Could not create the album. Try again." },
      { status: 500 },
    );
  }
}
