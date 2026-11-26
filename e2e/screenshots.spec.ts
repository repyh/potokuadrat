import { expect, test, type Page } from "@playwright/test";

/**
 * Captures one screenshot per journey for the progress report. Not an assertion
 * suite — the assertions live in share.spec.ts and admin.spec.ts. This exists so
 * the demo has pictures.
 *
 * Run it against `npm run dev`, not the production build:
 * `isSeedMedia()` is gated on NODE_ENV !== "production", so only the dev server
 * serves the seeded photographs. Under `next start` every tile is a broken image.
 *
 * Two journeys cannot be reached in dev because React does not hydrate the share
 * route there (see the note in playwright.config.ts):
 *   - the lightbox, which needs a click to open
 *   - nothing else: password unlock is driven through the API below, because the
 *     gate is a POST that sets a cookie and the gallery is then server-rendered.
 */
const OUT = "e2e/screenshots";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@potokuadrat.local";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "potokuadrat-seed";

/** Scrolls the page so lazy images below the fold actually decode. */
async function loadAllImages(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const step = window.innerHeight;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  // Wait until every <img> reports a decoded bitmap.
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll("img")).every(
        (img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0,
      ),
    undefined,
    { timeout: 30_000 },
  );
}

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("navigation", { name: "Admin sections" })).toBeVisible({
    timeout: 15_000,
  });
}

test("01 login page", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.screenshot({ path: `${OUT}/01-login.png`, fullPage: true });
});

test("02 dashboard overview", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.screenshot({ path: `${OUT}/02-dashboard.png`, fullPage: true });
});

test("03 admin albums", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto("/admin/albums");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.screenshot({ path: `${OUT}/03-admin-albums.png`, fullPage: true });
});

test("04 admin shares", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto("/admin/shares");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.screenshot({ path: `${OUT}/04-admin-shares.png`, fullPage: true });
});

test("05 guest public gallery", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/s/seed-public");
  await expect(page.getByRole("heading", { name: "Seed Gallery" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Open .*\.jpe?g$/i }).first()).toBeVisible();
  await loadAllImages(page);
  await page.screenshot({ path: `${OUT}/05-guest-public.png`, fullPage: true });
});

test("07 password gate", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/s/seed-password");
  await expect(page.getByRole("heading", { name: "Enter share password" })).toBeVisible();
  await page.screenshot({ path: `${OUT}/07-password-gate.png`, fullPage: true });
});

test("08 password unlocked", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  // The gate is a POST that sets the share cookie; the gallery behind it is
  // server-rendered. Driving it through the API therefore reaches the unlocked
  // state without React, which is what makes this capturable under `next dev`.
  const unlocked = await page.request.post("/api/share/seed-password/access", {
    data: { password: "seed-pass-123" },
  });
  expect(unlocked.ok()).toBe(true);

  await page.goto("/s/seed-password");
  await expect(page.getByRole("button", { name: /^Open .*\.jpe?g$/i }).first()).toBeVisible({
    timeout: 15_000,
  });
  await loadAllImages(page);
  await page.screenshot({ path: `${OUT}/08-password-unlocked.png`, fullPage: true });
});

test("09 expired gate", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/s/seed-expired");
  await expect(
    page.getByRole("heading", { name: "This share link has expired" }),
  ).toBeVisible();
  await page.screenshot({ path: `${OUT}/09-expired-gate.png`, fullPage: true });
});

test("10 mobile guest gallery", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/s/seed-public");
  await expect(page.getByRole("heading", { name: "Seed Gallery" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Open .*\.jpe?g$/i }).first()).toBeVisible();
  await loadAllImages(page);
  await page.screenshot({ path: `${OUT}/10-mobile-gallery.png`, fullPage: true });
});
