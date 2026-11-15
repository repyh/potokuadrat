import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { organizations } from "@/server/db/schema";

const databaseUrl = process.env.TEST_DATABASE_URL;

type DbInstance = ReturnType<(typeof import("@/server/db/client"))["getDb"]>;
type Repository = ReturnType<
  (typeof import("./repository"))["createDrizzleOrganizationRepository"]
>;

let db: DbInstance;
let repository: Repository;
let closeDb: () => Promise<void>;

describe.skipIf(!databaseUrl)("organization repository", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    const dbModule = await import("@/server/db/client");
    const repositoryModule = await import("./repository");

    db = dbModule.getDb();
    closeDb = dbModule.closeDb;
    repository = repositoryModule.createDrizzleOrganizationRepository(db);

    await db.execute(sql`TRUNCATE TABLE organizations RESTART IDENTITY CASCADE`);
  });

  afterAll(async () => {
    await db.execute(sql`TRUNCATE TABLE organizations RESTART IDENTITY CASCADE`);
    await closeDb();
  });

  it("creates exactly one default organization", async () => {
    expect(await repository.get()).toBeNull();

    const first = await repository.ensure();
    const second = await repository.ensure("Other");

    expect(first.name).toBe("Potokuadrat");
    expect(second.id).toBe(first.id);

    const [counted] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(organizations);
    expect(counted.count).toBe(1);
  });

  it("persists branding and the metadata policy", async () => {
    const updated = await repository.update({
      name: "Studio",
      title: "Studio Gallery",
      logo: "https://cdn.example/logo.svg",
      accent: "#3366ff",
      footerEnabled: false,
      stripMetadata: false,
    });

    expect(updated).toMatchObject({
      name: "Studio",
      title: "Studio Gallery",
      logo: "https://cdn.example/logo.svg",
      accent: "#3366ff",
      footerEnabled: false,
      stripMetadata: false,
    });

    const fetched = await repository.get();
    expect(fetched).toMatchObject({ name: "Studio", stripMetadata: false });
  });

  it("creates the row on update when none exists", async () => {
    await db.execute(sql`DELETE FROM organizations`);

    const created = await repository.update({ name: "Fresh", accent: null });

    expect(created.name).toBe("Fresh");
    expect(created.accent).toBeNull();
    expect(created.stripMetadata).toBe(true);
  });
});
