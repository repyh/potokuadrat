import { expect, test } from "@playwright/test";

/**
 * The organizer side: an admin signs in and walks the dashboard.
 *
 * Every test here starts already authenticated through the storage state the
 * setup project wrote, so a broken login fails in one place instead of ten.
 */
test.describe("dashboard", () => {
  test("lands on the overview with the signed-in admin", async ({ page }) => {
    await page.goto("/admin");

    const nav = page.getByRole("navigation", { name: "Admin sections" });
    await expect(nav).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // The email also renders inside the admin page body ("Signed in as ..."),
    // so scope to the spine's user block rather than matching the text globally.
    const spine = page.getByRole("complementary", { name: "Organizer navigation" });
    await expect(spine.getByText("admin@potokuadrat.local")).toBeVisible();
  });

  test("navigates to every section from the spine", async ({ page }) => {
    await page.goto("/admin");

    // Breadcrumbs repeat the same labels ("Albums") inside the workspace, so
    // every click is scoped to the navigation landmark, not the whole page.
    const nav = page.getByRole("navigation", { name: "Admin sections" });

    for (const [label, url] of [
      ["Albums", "/admin/albums"],
      ["Shares", "/admin/shares"],
      ["Settings", "/admin/settings"],
    ] as const) {
      await nav.getByRole("link", { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`${url}$`));
      // aria-current is how the shell reports the active section; asserting it
      // catches a link that navigates but never updates the nav state.
      await expect(nav.getByRole("link", { name: label })).toHaveAttribute(
        "aria-current",
        "page",
      );
    }
  });

  test("lists the seeded album with its photo count", async ({ page }) => {
    await page.goto("/admin/albums");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // The seed creates exactly one album: "Seed Gallery", ready, with 24 photos.
    // The title alone proves the row rendered; the count is what proves the
    // album carries its indexed photos rather than an empty shell. Assert the
    // real number — `/seed.gallery/i` alone passes even when the count is 0.
    const row = page.getByRole("row").filter({ hasText: /seed.gallery/i }).first();
    await expect(row).toBeVisible();
    await expect(row.getByText("Seed Gallery", { exact: true })).toBeVisible();

    // Photos column is `albumPhotoLabel()`: a plain count once status is
    // "ready" (a "12 / 24" fraction would mean it is still indexing).
    await expect(row.getByText("24", { exact: true })).toBeVisible();
    await expect(row.getByText(/\d+\s*\/\s*\d+/)).toHaveCount(0);
  });

  test("lists all five seeded shares", async ({ page }) => {
    await page.goto("/admin/shares");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // The seed creates five shares, one per access mode plus an expiring one.
    // Listing all five by slug is the point: the earlier version checked four
    // and called itself "five", so a share missing from the index stayed green.
    // seed-expiring is the one that used to slip through.
    for (const slug of [
      "seed-public",
      "seed-password",
      "seed-expired",
      "seed-expiring",
      "seed-magic",
    ]) {
      await expect(page.getByText(`/s/${slug}`, { exact: true })).toBeVisible();
    }

    // And the count, not just presence: a row rendered twice (duplicate key,
    // double fetch) would pass five `toBeVisible()` checks with six rows.
    await expect(page.getByRole("row").filter({ hasText: /\/s\/seed-/ })).toHaveCount(5);
  });

  test("rejects an album with no Drive folder selected", async ({ page }) => {
    await page.goto("/admin/albums/new");
    await expect(page.getByRole("heading", { name: "New album" })).toBeVisible();

    // Title alone is not enough. The form must stop the submit and say so,
    // rather than firing a Server Action that the server would reject anyway —
    // and this path needs no Drive credentials, so it runs in any environment.
    await page.getByLabel("Title").fill("Autumn Wedding — Kusuma");
    await page.getByRole("button", { name: "Save album" }).click();

    await expect(page.getByText("Pick at least one Drive folder to index.")).toBeVisible();

    // Nothing was created: a rejected submit must not navigate off the form.
    await expect(page).toHaveURL(/\/admin\/albums\/new$/);
    await expect(page.getByRole("heading", { name: "New album" })).toBeVisible();
  });

  test("shows the settings form with the organization", async ({ page }) => {
    await page.goto("/admin/settings");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("tablist").first()).toBeVisible();
  });
});

test.describe("auth guards", () => {
  test("sends an anonymous visitor from /admin to the login page", async ({ browser }) => {
    // browser.newContext() inherits the project's `use.storageState`, so the
    // context would still carry the admin cookie. Passing an empty state is what
    // actually makes this an anonymous visitor.
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto("/admin");

    // requireAdmin() calls redirect() from a Server Component, so Next answers
    // the document request with 200 and an __next_error__ shell carrying a
    // NEXT_REDIRECT payload; the browser then navigates client-side. The test
    // therefore waits for the URL rather than for an HTTP status, and asserts
    // the login heading afterwards to prove the redirect landed somewhere real.
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    // The admin shell must not be reachable before the redirect resolves.
    await expect(page.getByRole("navigation", { name: "Admin sections" })).toHaveCount(0);

    await context.close();
  });
});

/**
 * Signing out revokes the session it holds, so this test must never touch the
 * session the rest of the suite reuses. It mints its own by signing in inside a
 * throwaway context, and the empty storage state is what makes `/login` render
 * the form instead of redirecting an already-authenticated admin to /admin.
 *
 * It spends one /sign-in/email call. Better Auth caps that at 5 per minute per
 * client (src/server/auth/auth.ts), so the rest of the file deliberately does
 * not sign in again after the setup project.
 */
test.describe("sign out", () => {
  test("revokes the session and blocks the dashboard", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      // Better Auth keys the sign-in limiter on the client IP
      // (src/server/auth/auth.ts: /sign-in/email = 5 per 60s). A distinct
      // forwarded address gives this test its own bucket, so a local re-run
      // minutes apart does not spend the setup project's budget.
      extraHTTPHeaders: { "x-forwarded-for": "198.51.100.77" },
    });
    const page = await context.newPage();

    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await page.getByLabel("Email").fill("admin@potokuadrat.local");
    await page.getByLabel("Password").fill("potokuadrat-seed");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("navigation", { name: "Admin sections" })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: "Sign out" }).click();

    // Wait for the sign-out redirect to land before navigating again. Clicking
    // fires a Server Action which redirects to /login; issuing a second goto
    // while that is still in flight races the navigation and the second request
    // can be served with the pre-revocation render.
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });

    // Sign-out must actually revoke, not just navigate: visiting /admin again
    // has to bounce to the login page rather than render the shell from a
    // still-valid cookie.
    //
    // The redirect is client-side (requireAdmin() answers 200 with a
    // NEXT_REDIRECT payload), so polling the URL is the reliable signal.
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Admin sections" })).toHaveCount(0);

    await context.close();
  });
});
