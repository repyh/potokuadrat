import { expect, test as setup } from "@playwright/test";
import path from "node:path";

/**
 * Signs in once and writes the browser storage state the admin project reuses.
 *
 * Credentials come from the seed (scripts/seed.ts): `admin@potokuadrat.local` /
 * `potokuadrat-seed`. If the seed changes, this is the one place to update.
 */
const STORAGE = path.join(".e2e", "admin.json");

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@potokuadrat.local";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "potokuadrat-seed";

setup("authenticate as the seeded admin", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  // The login page redirects an already-authenticated admin, and loginAction
  // redirects to /admin on success, so the sidebar is the success signal.
  await expect(page.getByRole("navigation", { name: "Admin sections" })).toBeVisible({
    timeout: 15_000,
  });

  await page.context().storageState({ path: STORAGE });
});
