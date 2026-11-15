import { getDriveRuntime } from "@/server/drive";
import { makeContentDisposition } from "@/server/drive/download";
import { prepareShareArchive } from "@/server/shares/archive";
import { getShareRepository } from "@/server/shares/runtime";

type Context = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Context): Promise<Response> {
  const { slug } = await params;
  const result = await prepareShareArchive(
    getShareRepository(),
    request,
    slug,
    new URL(request.url).searchParams,
    getDriveRuntime(),
  );

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return new Response(result.stream, {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": makeContentDisposition(result.filename),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
