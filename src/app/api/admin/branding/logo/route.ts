import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getAdminSession } from "@/server/auth/api";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function brandingDir(): string {
  return process.env.BRANDING_DIR?.trim() || path.join(process.cwd(), ".data", "branding");
}

export async function POST(request: Request): Promise<Response> {
  const session = await getAdminSession();
  if (!session) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const entry = formData.get("file");
  if (!(entry instanceof File)) {
    return Response.json({ error: "Choose an image file to upload." }, { status: 400 });
  }

  const ext = MIME_TO_EXT[entry.type];
  if (!ext) {
    return Response.json(
      { error: "Use a PNG, JPEG, or WebP logo file." },
      { status: 400 },
    );
  }

  if (entry.size === 0 || entry.size > MAX_LOGO_BYTES) {
    return Response.json(
      { error: "Keep logo images at or under 2 MB." },
      { status: 400 },
    );
  }

  const filename = `${randomUUID()}.${ext}`;
  const dir = brandingDir();
  await mkdir(dir, { recursive: true });
  const buffer = Buffer.from(await entry.arrayBuffer());
  await writeFile(path.join(dir, filename), buffer);

  return Response.json({ url: `/api/branding/logo/${filename}` }, { status: 201 });
}
