import { beforeEach, describe, expect, it, vi } from "vitest";

const { pingDatabase } = vi.hoisted(() => ({
  pingDatabase: vi.fn<() => Promise<void>>(),
}));

vi.mock("@/server/db/client", () => ({ pingDatabase }));
// `connection()` needs a request scope that a unit test does not have.
vi.mock("next/server", () => ({ connection: async () => {} }));

async function getHealth(): Promise<Response> {
  const { GET } = await import("@/app/api/health/route");
  return GET();
}

describe("GET /api/health", () => {
  beforeEach(() => {
    pingDatabase.mockReset();
  });

  it("reports ok when the database answers", async () => {
    pingDatabase.mockResolvedValueOnce();

    const response = await getHealth();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ status: "ok", database: "up" });
  });

  it("returns 503 when the database is unreachable", async () => {
    pingDatabase.mockRejectedValueOnce(new Error("connect ECONNREFUSED 10.0.0.5:5432"));

    const response = await getHealth();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      status: "unavailable",
      database: "down",
    });
  });

  it("never echoes the driver error in the body", async () => {
    // The endpoint is reachable without authentication, so the message must not
    // carry hostnames, ports or connection strings.
    pingDatabase.mockRejectedValueOnce(
      new Error("password authentication failed for user potokuadrat at 10.0.0.5:5432"),
    );

    const response = await getHealth();
    const body = JSON.stringify(await response.json());

    expect(body).not.toMatch(/potokuadrat|10\.0\.0\.5|5432|authentication/);
  });
});
