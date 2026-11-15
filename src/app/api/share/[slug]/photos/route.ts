import type { PhotoPage } from "@/contracts/album";

import { listShareGallery } from "@/server/shares/gallery";
import { getShareRepository } from "@/server/shares/runtime";

type Context = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Context): Promise<Response> {
  const { slug } = await params;
  const result = await listShareGallery(
    getShareRepository(),
    request,
    slug,
    new URL(request.url).searchParams,
  );

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  const body: PhotoPage = result.page;
  return Response.json(body, { headers: { "cache-control": "no-store" } });
}
