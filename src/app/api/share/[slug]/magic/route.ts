import { createHash } from "node:crypto";

import { z } from "zod";

import { isShareActive } from "@/server/shares/policy";
import {
  createShareCookieValue,
  shareCookieHeader,
  shareCookieName,
} from "@/server/shares/cookie";
import { clientKey, magicAttemptLimiter } from "@/server/shares/rate-limit";
import { getShareRepository } from "@/server/shares/runtime";

const SESSION_DAYS = 7;

const bodySchema = z.object({
  token: z.string().min(10, "Enter the link token.").max(500),
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
  if (share.mode !== "magic_link") {
    return Response.json({ error: "This share does not use magic links." }, { status: 400 });
  }

  const limit = magicAttemptLimiter.consume(clientKey(request, share.id));
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
      { error: parsed.error.issues[0]?.message ?? "Enter the link token." },
      { status: 400 },
    );
  }

  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const recipient = await repository.consumeRecipient(share.id, tokenHash);
  if (!recipient) {
    return Response.json({ error: "This link is invalid or already used." }, { status: 401 });
  }

  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  // A returning recipient keeps the same session row, and with it their favorites.
  const session = await repository.findOrCreateClientSession(
    share.id,
    recipient.email,
    expiresAt,
  );
  const cookie = createShareCookieValue(share.id, {
    sessionId: session.id,
    maxAgeSeconds: SESSION_DAYS * 24 * 60 * 60,
  });

  const response = Response.json({ ok: true, data: { access: "ok", email: session.email } });
  response.headers.set(
    "set-cookie",
    shareCookieHeader(shareCookieName(share.id), cookie.value, cookie.maxAge),
  );
  return response;
}
