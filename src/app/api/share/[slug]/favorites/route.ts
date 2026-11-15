import type { FavoritesResponse } from "@/contracts/share";

import { listFavorites } from "@/server/shares/favorites";
import { getShareRepository } from "@/server/shares/runtime";

type Context = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Context): Promise<Response> {
  const { slug } = await params;
  const result = await listFavorites(getShareRepository(), request, slug);

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  const body: FavoritesResponse = result.favorites;
  return Response.json(body, { headers: { "cache-control": "no-store" } });
}
