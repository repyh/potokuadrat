import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Exercises the real setup and login server actions against a disposable Postgres.
 * `redirect()` throws in a non-Next runtime, which is what the assertions look for.
 */
const databaseUrl = process.env.TEST_DATABASE_URL;

type DbInstance = ReturnType<(typeof import("@/server/db/client"))["getDb"]>;
type SetupAction = (typeof import("@/app/(auth)/setup/actions"))["setupAction"];
type LoginAction = (typeof import("@/app/(auth)/login/actions"))["loginAction"];

let db: DbInstance;
let closeDb: () => Promise<void>;
let setupAction: SetupAction;
let loginAction: LoginAction;

const admin = {
  name: "Gallery Admin",
  email: "admin@example.com",
  password: "correct horse battery staple",
  organizationName: "Atelier Kusuma",
};

function setupForm(): FormData {
  const formData = new FormData();
  formData.set("name", admin.name);
  formData.set("email", admin.email);
  formData.set("password", admin.password);
  formData.set("organizationName", admin.organizationName);
  return formData;
}

function loginForm(email: string, password: string, redirectTo?: string): FormData {
  const formData = new FormData();
  formData.set("email", email);
  formData.set("password", password);
  if (redirectTo !== undefined) {
    formData.set("redirectTo", redirectTo);
  }
  return formData;
}

async function resetDatabase(): Promise<void> {
  await db.execute(
    sql`TRUNCATE TABLE organizations, users, sessions, accounts, verifications RESTART IDENTITY CASCADE`,
  );
}

describe.skipIf(!databaseUrl)("setup and login actions", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.BETTER_AUTH_SECRET = "test-secret-".padEnd(48, "x");
    process.env.BETTER_AUTH_URL = "http://localhost:3000";

    const dbModule = await import("@/server/db/client");
    const setupModule = await import("@/app/(auth)/setup/actions");
    const loginModule = await import("@/app/(auth)/login/actions");

    db = dbModule.getDb();
    closeDb = dbModule.closeDb;
    setupAction = setupModule.setupAction;
    loginAction = loginModule.loginAction;

    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await closeDb();
  });

  it("creates the organization and promotes the first user to admin", async () => {
    await expect(setupAction({}, setupForm())).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });

    const organizations = await db.execute<{ name: string; strip_metadata: boolean }>(
      sql`SELECT name, strip_metadata FROM organizations`,
    );
    expect(organizations.rows).toEqual([{ name: admin.organizationName, strip_metadata: true }]);

    const users = await db.execute<{ email: string; role: string }>(
      sql`SELECT email, role FROM users`,
    );
    expect(users.rows).toEqual([{ email: admin.email, role: "admin" }]);
  });

  it("refuses to run setup twice", async () => {
    const state = await setupAction({}, setupForm());

    expect(state.error).toMatch(/already complete/i);
  });

  it("rejects a wrong password and redirects on the right one", async () => {
    const failure = await loginAction({}, loginForm(admin.email, "wrong password"));
    expect(failure.error).toMatch(/invalid email or password/i);
    expect(failure.fields?.email).toBe(admin.email);

    await expect(loginAction({}, loginForm(admin.email, admin.password))).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });

  it("redirects to the requested same-origin path", async () => {
    await expect(
      loginAction({}, loginForm(admin.email, admin.password, "/admin/albums?view=grid")),
    ).rejects.toMatchObject({
      digest: "NEXT_REDIRECT;replace;/admin/albums?view=grid;307;",
    });
  });

  it("ignores redirect targets that leave the origin", async () => {
    const unsafeTargets = [
      "//evil.example",
      "/\\evil.example",
      "/\\/evil.example",
      "https://evil.example",
      " /\\evil.example",
      "/..//evil.example",
    ];

    for (const target of unsafeTargets) {
      await expect(
        loginAction({}, loginForm(admin.email, admin.password, target)),
        `target ${JSON.stringify(target)}`,
      ).rejects.toMatchObject({
        digest: "NEXT_REDIRECT;replace;/admin;307;",
      });
    }
  });

  it("rejects a member account without leaving a session behind", async () => {
    await db.execute(sql`UPDATE users SET role = 'member'`);
    await db.execute(sql`DELETE FROM sessions`);

    const state = await loginAction({}, loginForm(admin.email, admin.password));

    expect(state.error).toMatch(/organizer access/i);
    expect(state.fields?.email).toBe(admin.email);

    const sessions = await db.execute<{ id: string }>(sql`SELECT id FROM sessions`);
    expect(sessions.rows).toEqual([]);

    await db.execute(sql`UPDATE users SET role = 'admin'`);
  });
});
