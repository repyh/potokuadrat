import { verifyPassword } from "better-auth/crypto";
import { z } from "zod";

import { isShareActive } from "@/server/shares/policy";
import {
  createShareCookieValue,
  shareCookieHeader,
  shareCookieName,
} from "@/server/shares/cookie";
import { clientKey, passwordAttemptLimiter } from "@/server/shares/rate-limit";
import { getShareRepository } from "@/server/shares/runtime";

const bodySchema = z.object({
  password: z.string().min(1, "Enter the share password.").max(200),
});

type Context = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: Context): Promise<Response> {
  const { slug } = await params;
  const repository = getShareRepository();
  const share = await repository.findBySlug(slug);

  if (!share) {
    return Response.json({ error: "Share not found." }, { status: 404 });
  }
  if (!isShareActive(share)) {
    return Response.json({ error: "Share expired." }, { status: 410 });
  }
  if (share.mode !== "password" || !share.passwordHash) {
    return Response.json({ error: "This share does not use a password." }, { status: 400 });
  }

  const limit = passwordAttemptLimiter.consume(clientKey(request, share.id));
  if (!limit.ok) {
    return Response.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Enter the share password." },
      { status: 400 },
    );
  }

  const valid = await verifyPassword({
    hash: share.passwordHash,
    password: parsed.data.password,
  });
  if (!valid) {
    return Response.json({ error: "Incorrect password." }, { status: 401 });
  }

  const cookie = createShareCookieValue(share.id);
  const response = Response.json({ ok: true, data: { access: "ok" } });
  response.headers.set(
    "set-cookie",
    shareCookieHeader(shareCookieName(share.id), cookie.value, cookie.maxAge),
  );
  return response;
}
