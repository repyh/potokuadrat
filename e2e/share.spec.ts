import { expect, test, type Page } from "@playwright/test";

import { reseedMagicToken } from "./fixtures";

/**
 * A gallery that renders 24 tiles but 0 bitmaps is broken, and every assertion
 * on tiles alone passes anyway. Thumbnails come from `/s/<slug>/thumb/<id>`,
 * which proxies Google Drive and returns 502 when Drive is not configured — in
 * production builds the seed photos are unavailable on purpose (see
 * `isSeedMedia()`), so the whole grid is grey boxes.
 *
 * Asserting the <img> actually decoded is what separates "the layout renders"
 * from "the product works". It also fails loudly if a future change breaks
 * Drive proxying, instead of leaving a green suite over a broken gallery.
 */
async function expectPhotosRendered(page: Page): Promise<void> {
  const images = page.locator("img");
  await expect(images.first()).toBeVisible();

  // Lazy loading means a single read catches the grid half-decoded (measured
  // 11/24 right after the tiles appeared). Poll until nothing is left broken
  // instead of reading once, or the assertion reports a race as a failure.
  //
  // A broken thumbnail 502s from the Drive proxy, so naturalWidth stays 0 and
  // this never settles — that is the failure this guards against, and it is
  // also why the message names 502 rather than a timeout.
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const imgs = Array.from(document.querySelectorAll("img"));
          return {
            total: imgs.length,
            pending: imgs.filter((i) => (i as HTMLImageElement).naturalWidth === 0).length,
          };
        }),
      {
        message:
          "thumbnails never decoded — a stuck count means the thumbnail route 502'd (Drive proxy unavailable in this environment)",
        timeout: 20_000,
        intervals: [200, 400, 800],
      },
    )
    .toEqual({ total: 24, pending: 0 });
}

/**
 * The guest side of the product: what a client sees when they open a share link.
 *
 * The seed creates five shares, one per access mode, so every gate the access
 * resolver can return is reachable without Google credentials:
 *
 *   seed-public    no gate
 *   seed-password  password gate
 *   seed-expired   expired gate
 *   seed-magic     magic-link gate
 *
 * All of them expose the same 24-photo album, because the seed writes no
 * `share_photos` rows and an empty subset means "the whole album" by design
 * (src/server/shares/repository.ts, visiblePhotos: it accommodates re-indexing).
 * The `visits: 24 public · 9 password · 4 magic` the seed prints is view events,
 * not photo counts — don't read it as a gallery size.
 *
 * Selector notes, learned the hard way:
 * - The grid tile is `aria-label="Open <photo name>"`, so `Open folio` on the
 *   magic-link gate also matches /^Open /. Gate buttons are addressed by their
 *   exact label, and tiles are matched with /^Open .*\.jpe?g$/i to exclude them.
 * - The gate heading now names the album ("Open Seed Gallery", "Unlock Seed
 *   Gallery", "Seed Gallery has expired"), so the headings below follow the
 *   seeded title instead of the old generic gate copy.
 * - The lightbox <dialog> is labelled with the photo name; `aria-label="Photo
 *   preview"` exists only on the collapsed placeholder, which is never visible.
 */
const GATE_HEADING = {
  password: "Open Seed Gallery",
  expired: "Seed Gallery has expired",
  magic: "Unlock Seed Gallery",
  unavailable: "This folio is not available",
} as const;

test.describe("public share", () => {
  test("opens straight into the gallery with photos", async ({ page }) => {
    await page.goto("/s/seed-public");

    // A public share has no gate: the gallery heading renders immediately.
    await expect(page.getByRole("heading", { name: "Seed Gallery" })).toBeVisible();

    const tiles = page.getByRole("button", { name: /^Open .*\.jpe?g$/i });
    await expect(tiles.first()).toBeVisible();

    // The seed gives this share 24 photos, first page is capped at 50, so the
    // whole album is on screen. Assert the real number, not "greater than zero":
    // a loader that renders one photo and stops would pass the loose check.
    expect(await tiles.count()).toBe(24);

    // Tiles existing is not the same as photos loading: this suite was green
    // while all 24 thumbnails 502'd. The bitmap check only holds on the dev
    // server, because `isSeedMedia()` deliberately disables seed photos under
    // NODE_ENV=production — so it runs there, where someone is actually looking
    // at the gallery, and skips on the production build the default run uses.
    if (process.env.E2E_SEED_MEDIA === "1") {
      await expectPhotosRendered(page);
    }
  });

  test("filters the grid and narrows to the landscape subset", async ({ page }) => {
    await page.goto("/s/seed-public");
    await expect(page.getByRole("heading", { name: "Seed Gallery" })).toBeVisible();

    const tiles = page.getByRole("button", { name: /^Open .*\.jpe?g$/i });
    await expect(tiles.first()).toBeVisible();

    // The seed is 24 photos: 16 landscape and 8 portrait. Asserting the exact
    // numbers is the whole point — the previous version polled for
    // `toBeLessThanOrEqual(allCount)`, which passes when the filter returns all
    // 24 (not filtering at all) and passes when it returns 0 (filtering
    // everything). A test that can only fail if the count goes *up* is not
    // testing the filter.
    expect(await tiles.count()).toBe(24);

    await page.getByRole("tab", { name: "Landscape" }).click();
    // The grid re-renders from the route handler, so wait for the tab to report
    // selection before counting: the tiles stay mounted during the refetch.
    await expect(page.getByRole("tab", { name: "Landscape" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await expect
      .poll(async () => tiles.count(), {
        message: "Landscape should narrow 24 photos to the 16 landscape ones",
        timeout: 10_000,
      })
      .toBe(16);

    // Counting alone would still pass if the grid swapped 8 landscape for 8
    // portrait. The seed's orientation rhythm is `index % 3 === 2` → portrait
    // (src/server/drive/seed-photos.ts), so the 3rd photo is portrait and the
    // 4th is landscape. Assert one of each by name: a filter that keeps every
    // photo passes the count check but fails here.
    const stillWater = page.getByRole("button", { name: "Open Still Water, Dolomites.jpg" });
    const lakeRidge = page.getByRole("button", { name: "Open Lake and Pine Ridge.jpg" });
    await expect(lakeRidge).toBeVisible();
    await expect(stillWater).toHaveCount(0);
  });

  test("remembers a favorite across a reload", async ({ page }) => {
    await page.goto("/s/seed-public");

    // The tile's star is `aria-label="Favorite <name>"` and flips to
    // `aria-label="Remove <name> from favorites"` with `aria-pressed="true"`.
    // Both label and pressed state are asserted: a button that only restyles
    // itself would pass a colour check but leave `aria-pressed` stale.
    const star = page.getByRole("button", { name: /^Favorite / }).first();
    await expect(star).toBeVisible();
    await expect(star).toHaveAttribute("aria-pressed", "false");

    const photoName = (await star.getAttribute("aria-label"))?.replace(/^Favorite /, "");
    await star.click();

    const toggled = page.getByRole("button", {
      name: `Remove ${photoName} from favorites`,
      exact: true,
    });
    await expect(toggled).toHaveAttribute("aria-pressed", "true");

    // A public share keeps favorites in localStorage (magic-link shares use the
    // server). Reloading is what proves the write actually persisted instead of
    // living in React state that dies with the page.
    await page.reload();
    await expect(
      page.getByRole("button", { name: `Remove ${photoName} from favorites`, exact: true }),
    ).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });
  });

  test("opens the download dialog pointed at the archive route", async ({ page }) => {
    await page.goto("/s/seed-public");

    await page.getByRole("button", { name: "Download all" }).click();

    const dialog = page.getByRole("dialog", { name: "Download archive" });
    await expect(dialog).toBeVisible();

    // The CTA is an <a download>, not a button: it has to carry a real href to
    // the archive route or the browser never fetches anything. Asserting the
    // URL catches a handler that opens the dialog but forgets to build it.
    //
    // `selectedCount` is the photo total (24), which is also what proves the
    // scope defaulted to "all" rather than an empty selection.
    const archive = dialog.getByRole("link", { name: /Download ZIP \(24\)/ });
    await expect(archive).toHaveAttribute("href", /\/api\/share\/seed-public\/download\.zip\?/);
    await expect(archive).toHaveAttribute("href", /scope=all/);
    await expect(archive).toHaveAttribute("href", /quality=(original|web)/);
  });

  test("streams a complete ZIP archive", async ({ request }) => {
    // Only meaningful where the photos actually exist: `isSeedMedia()` is
    // compiled off in a production build, so every source image 502s and the
    // archive has nothing to pack. Run with E2E_SEED_MEDIA=1 against a dev
    // server, the same gate the bitmap check uses.
    test.skip(
      process.env.E2E_SEED_MEDIA !== "1",
      "seed media is disabled outside a dev server",
    );

    const response = await request.get("/api/share/seed-public/download.zip?quality=web&scope=all");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/zip");

    const body = await response.body();

    // A ZIP that answers 200 with a few hundred bytes is the failure worth
    // catching: the route starts streaming before the first image resolves, so a
    // Drive error mid-flight truncates the response instead of failing the
    // request. The client saves a corrupt file that looks successful.
    expect(body.subarray(0, 4).toString("binary")).toBe("PK\x03\x04");

    // Entry count comes from the central directory, one "PK\x01\x02" record per
    // file. Counting them proves the archive is complete, not merely non-empty.
    let entries = 0;
    for (let i = 0; i < body.length - 4; i += 1) {
      if (body[i] === 0x50 && body[i + 1] === 0x4b && body[i + 2] === 0x01 && body[i + 3] === 0x02) {
        entries += 1;
      }
    }
    expect(entries).toBe(24);

    // End-of-central-directory record: its absence is how `unzip` reports a
    // truncated file, so asserting it is the same check a user would run.
    expect(body.includes(Buffer.from([0x50, 0x4b, 0x05, 0x06]))).toBe(true);
  });

  test("opens the lightbox and closes it with Escape", async ({ page }) => {
    await page.goto("/s/seed-public");

    const tiles = page.getByRole("button", { name: /^Open .*\.jpe?g$/i });
    const firstName = (await tiles.first().getAttribute("aria-label"))?.replace(/^Open /, "");
    await tiles.first().click();

    // The dialog is labelled with the photo name, and it is a native <dialog>
    // opened with showModal(), so it is in the top layer and role=dialog.
    const dialog = page.getByRole("dialog", { name: firstName ?? "" });
    await expect(dialog).toBeVisible();

    // Escape must close it: proves the native dialog and its focus trap are
    // wired, not a styled div with a backdrop.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});

test.describe("password share", () => {
  test("hides the gallery until the password is accepted", async ({ page }) => {
    await page.goto("/s/seed-password");

    await expect(
      page.getByRole("heading", { name: GATE_HEADING.password }),
    ).toBeVisible();
    // No photo tile may render before the password is accepted.
    await expect(page.getByRole("button", { name: /^Open .*\.jpe?g$/i })).toHaveCount(0);

    await page.getByPlaceholder("Enter password").fill("seed-pass-123");
    await page.getByRole("button", { name: "Unlock album" }).click();

    // The gate swaps in the gallery once the route handler accepts the password.
    const tiles = page.getByRole("button", { name: /^Open .*\.jpe?g$/i });
    await expect(tiles.first()).toBeVisible({ timeout: 15_000 });

    // The unlocked share exposes the whole album, not a subset: the seed writes
    // no `share_photos` rows, and an empty subset means "everything" by design.
    // Asserting 24 here is what catches a future seed change that freezes a
    // subset without updating this expectation.
    expect(await tiles.count()).toBe(24);
  });

  test("rejects a wrong password and keeps the gallery closed", async ({ page }) => {
    await page.goto("/s/seed-password");

    await page.getByPlaceholder("Enter password").fill("not-the-password");
    await page.getByRole("button", { name: "Unlock album" }).click();

    await expect(
      page.getByRole("heading", { name: GATE_HEADING.password }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /^Open .*\.jpe?g$/i })).toHaveCount(0);
  });
});

test.describe("share access states", () => {
  test("shows the expired state for an expired share", async ({ page }) => {
    await page.goto("/s/seed-expired");

    await expect(page.getByRole("heading", { name: GATE_HEADING.expired })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Open .*\.jpe?g$/i })).toHaveCount(0);
  });

  test("asks for an invitation token on a magic-link share", async ({ page }) => {
    await page.goto("/s/seed-magic");

    await expect(page.getByRole("heading", { name: GATE_HEADING.magic })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Open .*\.jpe?g$/i })).toHaveCount(0);
  });

  test("redeems a magic-link token and reveals the gallery", async ({ page }) => {
    // The token is single use: consumeRecipient() stamps used_at, so a second
    // redemption fails. Re-seed just this recipient so the test can run more
    // than once against the same database.
    const token = `e2e-magic-${Date.now()}`;
    await reseedMagicToken(token);

    await page.goto("/s/seed-magic");
    await page.getByPlaceholder("Paste invitation token").fill(token);
    await page.getByRole("button", { name: "Open folio" }).click();

    await expect(page.getByRole("button", { name: /^Open .*\.jpe?g$/i }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("renders the unavailable gate for a slug that does not exist", async ({ page }) => {
    await page.goto("/s/this-slug-does-not-exist");

    await expect(
      page.getByRole("heading", { name: GATE_HEADING.unavailable }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /^Open .*\.jpe?g$/i })).toHaveCount(0);

    // KNOWN INCONSISTENCY, deliberately not asserted as correct here:
    // src/server/shares/access.ts exports statusForAccess(), which maps
    // "unavailable" to 404, and the API routes honour it (access-context.ts,
    // media.ts). The page in src/app/s/[slug]/page.tsx never calls notFound(),
    // so an unknown slug renders the unavailable gate with HTTP 200. The status
    // a crawler and a monitor see therefore disagrees with the status the API
    // returns for the same condition. Reported rather than fixed here: the fix
    // is in src/app/**, which belongs to the frontend owner.
  });
});
