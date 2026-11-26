import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getAdminSessionMock = vi.fn();

vi.mock("@/server/auth/api", () => ({
  getAdminSession: (...args: unknown[]) => getAdminSessionMock(...args),
}));

import { POST } from "./route";

describe("admin branding logo upload route", () => {
  let tmpDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "pk-brand-"));
    process.env.BRANDING_DIR = tmpDir;
  });

  afterEach(async () => {
    delete process.env.BRANDING_DIR;
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("rejects unauthenticated requests", async () => {
    getAdminSessionMock.mockResolvedValue(null);

    const form = new FormData();
    form.append("file", new File(["abc"], "logo.png", { type: "image/png" }));
    const res = await POST(new Request("https://example.test/api/admin/branding/logo", { method: "POST", body: form }));

    expect(res.status).toBe(401);
  });

  it("validates MIME type and writes valid PNG logos locally", async () => {
    getAdminSessionMock.mockResolvedValue({ user: { id: "user-1" } });

    const badForm = new FormData();
    badForm.append("file", new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" }));
    const badRes = await POST(
      new Request("https://example.test/api/admin/branding/logo", { method: "POST", body: badForm }),
    );
    expect(badRes.status).toBe(400);

    const okForm = new FormData();
    okForm.append("file", new File([new Uint8Array([137, 80, 78, 71])], "logo.png", { type: "image/png" }));
    const okRes = await POST(
      new Request("https://example.test/api/admin/branding/logo", { method: "POST", body: okForm }),
    );
    expect(okRes.status).toBe(201);
    const json = (await okRes.json()) as { url: string };
    expect(json.url).toMatch(/^\/api\/branding\/logo\/[0-9a-f-]+\.png$/i);
  });
});
