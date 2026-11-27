import { readFile } from "node:fs/promises";
import path from "node:path";

const SAFE_LOGO_NAME = /^[0-9a-f-]+\.(png|jpg|webp)$/i;
const EXT_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

function brandingDir(): string {
  return process.env.BRANDING_DIR?.trim() || path.join(process.cwd(), ".data", "branding");
}

type Context = { params: Promise<{ filename: string }> };

export async function GET(_request: Request, { params }: Context): Promise<Response> {
  const { filename } = await params;
  if (!SAFE_LOGO_NAME.test(filename)) {
    return Response.json({ error: "Logo not found." }, { status: 404 });
  }

  const ext = filename.split(".").pop()?.toLowerCase() ?? "png";
  const filePath = path.join(brandingDir(), filename);

  try {
    const body = await readFile(filePath);
    return new Response(new Uint8Array(body), {
      status: 200,
      headers: {
        "content-type": EXT_TO_MIME[ext] ?? "image/png",
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "Logo not found." }, { status: 404 });
  }
}
