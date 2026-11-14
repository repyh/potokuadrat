import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Runs only when TEST_DATABASE_URL points at a disposable Postgres with the migrations
 * applied. It proves the hand-written Better Auth tables match the adapter's
 * expectations, including plural table names.
 */
const databaseUrl = process.env.TEST_DATABASE_URL;

type AuthInstance = ReturnType<(typeof import("./auth"))["createAuth"]>;
type DbInstance = ReturnType<(typeof import("@/server/db/client"))["getDb"]>;

let auth: AuthInstance;
let db: DbInstance;
let closeDb: () => Promise<void>;

const credentials = {
  name: "Gallery Admin",
  email: "admin@example.com",
  password: "correct horse battery staple",
};

function requestHeaders(): Headers {
  return new Headers({ origin: "http://localhost:3000" });
}

async function resetDatabase(): Promise<void> {
  await db.execute(
    sql`TRUNCATE TABLE organizations, users, sessions, accounts, verifications RESTART IDENTITY CASCADE`,
  );
}

describe.skipIf(!databaseUrl)("Better Auth against Postgres", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.BETTER_AUTH_SECRET = "test-secret-".padEnd(48, "x");
    process.env.BETTER_AUTH_URL = "http://localhost:3000";

    const authModule = await import("./auth");
    const dbModule = await import("@/server/db/client");

    auth = authModule.getAuth();
    db = dbModule.getDb();
    closeDb = dbModule.closeDb;

    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await closeDb();
  });

  it("creates the first user through the plural tables", async () => {
    const result = await auth.api.signUpEmail({
      body: credentials,
      headers: requestHeaders(),
    });

    expect(result.user.email).toBe(credentials.email);

    const rows = await db.execute<{ email: string; role: string }>(
      sql`SELECT email, role FROM users WHERE email = ${credentials.email}`,
    );

    expect(rows.rows[0]).toEqual({ email: credentials.email, role: "member" });
  });

  it("blocks a second sign-up", async () => {
    await expect(
      auth.api.signUpEmail({
        body: { ...credentials, email: "second@example.com" },
        headers: requestHeaders(),
      }),
    ).rejects.toThrow();
  });

  it("rejects a wrong password and accepts the right one", async () => {
    await expect(
      auth.api.signInEmail({
        body: { email: credentials.email, password: "wrong password" },
        headers: requestHeaders(),
      }),
    ).rejects.toThrow();

    const response = await auth.api.signInEmail({
      body: { email: credentials.email, password: credentials.password },
      headers: requestHeaders(),
      asResponse: true,
    });

    expect(response.status).toBe(200);

    const cookie = response.headers.getSetCookie?.()[0] ?? response.headers.get("set-cookie");
    expect(cookie).toBeTruthy();

    const session = await auth.api.getSession({
      headers: new Headers({ cookie: cookie.split(";")[0] }),
    });

    expect(session?.user.email).toBe(credentials.email);
  });
});
