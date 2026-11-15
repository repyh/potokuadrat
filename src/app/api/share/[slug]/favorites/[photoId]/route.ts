import type { FavoritesResponse } from "@/contracts/share";

import type { FavoritesResult } from "@/server/shares/favorites";
import { addFavorite, removeFavorite } from "@/server/shares/favorites";
import { getShareRepository } from "@/server/shares/runtime";

type Context = { params: Promise<{ slug: string; photoId: string }> };

async function respond(result: FavoritesResult): Promise<Response> {
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  const body: FavoritesResponse = result.favorites;
  return Response.json(body, { headers: { "cache-control": "no-store" } });
}

export async function PUT(request: Request, { params }: Context): Promise<Response> {
  const { slug, photoId } = await params;
  return respond(await addFavorite(getShareRepository(), request, slug, photoId));
}

export async function DELETE(request: Request, { params }: Context): Promise<Response> {
  const { slug, photoId } = await params;
  return respond(await removeFavorite(getShareRepository(), request, slug, photoId));
}
