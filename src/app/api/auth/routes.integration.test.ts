import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * Exercises the Better Auth catch-all route handler. It is the only route mounted at
 * `/api/auth/*`, so a regression here locks every user out of the app. The handler is
 * called directly with a Request, which is what Next does after routing.
 *
 * Better Auth rate-limits sign-in (5/min) and sign-up (3/5min) per client IP and keeps
 * the counters on a module-level singleton, so every test sends its own x-forwarded-for
 * to get a clean bucket. Without that the suite poisons itself: the first few tests
 * spend the budget and the rest see 429 instead of the status under test.
 */
const databaseUrl = process.env.TEST_DATABASE_URL;

type DbInstance = ReturnType<(typeof import("@/server/db/client"))["getDb"]>;
type AuthRoute = typeof import("@/app/api/auth/[...all]/route");

let db: DbInstance;
let closeDb: () => Promise<void>;
let authRoute: AuthRoute;

const CREDENTIALS = {
  name: "Gallery Admin",
  email: "admin@example.com",
  password: "correct horse battery staple",
};

let ipCounter = 0;

/** A fresh client IP per call keeps Better Auth's per-IP rate-limit buckets separate. */
function nextIp(): string {
  ipCounter += 1;
  return `198.51.100.${ipCounter}`;
}

function authRequest(path: string, body: unknown, ip = nextIp()): Request {
  return new Request(`http://localhost:3000/api/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

async function resetDatabase(): Promise<void> {
  await db.execute(
    sql`TRUNCATE TABLE organizations, users, sessions, accounts, verifications RESTART IDENTITY CASCADE`,
  );
}

async function signUp(ip = nextIp()): Promise<Response> {
  return authRoute.POST(authRequest("/sign-up/email", CREDENTIALS, ip));
}

describe.skipIf(!databaseUrl)("auth route handler", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.BETTER_AUTH_SECRET = "test-secret-".padEnd(48, "x");
    process.env.BETTER_AUTH_URL = "http://localhost:3000";

    const dbModule = await import("@/server/db/client");
    db = dbModule.getDb();
    closeDb = dbModule.closeDb;

    authRoute = await import("@/app/api/auth/[...all]/route");
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await closeDb();
  });

  it("exposes every HTTP verb Better Auth needs", () => {
    for (const verb of ["GET", "POST", "PATCH", "PUT", "DELETE"] as const) {
      expect(typeof authRoute[verb], verb).toBe("function");
    }
  });

  it("creates the first account through POST /api/auth/sign-up/email", async () => {
    const response = await signUp();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user.email).toBe(CREDENTIALS.email);

    const rows = await db.execute<{ email: string; role: string }>(
      sql`SELECT email, role FROM users WHERE email = ${CREDENTIALS.email}`,
    );
    expect(rows.rows[0]).toEqual({ email: CREDENTIALS.email, role: "member" });
  });

  it("refuses a second sign-up", async () => {
    await signUp();

    const response = await authRoute.POST(
      authRequest("/sign-up/email", { ...CREDENTIALS, email: "second@example.com" }),
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
    const rows = await db.execute<{ count: string }>(sql`SELECT count(*) FROM users`);
    expect(Number(rows.rows[0].count)).toBe(1);
  });

  it("rejects a wrong password and issues a session cookie for the right one", async () => {
    await signUp();
    const ip = nextIp();

    const wrong = await authRoute.POST(
      authRequest("/sign-in/email", { email: CREDENTIALS.email, password: "not the password" }, ip),
    );
    expect(wrong.status).toBe(401);

    const right = await authRoute.POST(
      authRequest("/sign-in/email", { email: CREDENTIALS.email, password: CREDENTIALS.password }, ip),
    );
    expect(right.status).toBe(200);

    const cookie = right.headers.getSetCookie?.()[0] ?? right.headers.get("set-cookie");
    expect(cookie).toBeTruthy();
    expect(cookie).toMatch(/HttpOnly/i);
  });

  it("returns the session for a signed-in cookie and null without one", async () => {
    await signUp();
    const signIn = await authRoute.POST(
      authRequest("/sign-in/email", {
        email: CREDENTIALS.email,
        password: CREDENTIALS.password,
      }),
    );
    const cookie = (signIn.headers.getSetCookie?.()[0] ?? "").split(";")[0];
    expect(cookie).not.toBe("");

    const withCookie = await authRoute.GET(
      new Request("http://localhost:3000/api/auth/get-session", { headers: { cookie } }),
    );
    expect(withCookie.status).toBe(200);
    expect((await withCookie.json()).user.email).toBe(CREDENTIALS.email);

    const anonymous = await authRoute.GET(
      new Request("http://localhost:3000/api/auth/get-session"),
    );
    expect(await anonymous.json()).toBeNull();
  });

  it("rejects a sign-up with a password below the minimum length", async () => {
    const response = await authRoute.POST(
      authRequest("/sign-up/email", { ...CREDENTIALS, password: "short" }),
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
    const rows = await db.execute<{ count: string }>(sql`SELECT count(*) FROM users`);
    expect(Number(rows.rows[0].count)).toBe(0);
  });

  it("rate-limits repeated sign-in attempts from one client", async () => {
    await signUp();
    const ip = nextIp();

    const statuses: number[] = [];
    for (let i = 0; i < 7; i += 1) {
      const response = await authRoute.POST(
        authRequest(
          "/sign-in/email",
          { email: CREDENTIALS.email, password: "wrong password" },
          ip,
        ),
      );
      statuses.push(response.status);
    }

    // Five sign-ins per minute per client, then 429.
    expect(statuses.slice(0, 5).every((status) => status === 401)).toBe(true);
    expect(statuses.slice(5)).toEqual([429, 429]);
  });
});
