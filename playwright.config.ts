import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests for the journeys a person actually walks: sign in, manage
 * albums in the dashboard, and open a share link as a guest.
 *
 * The suite runs against a real Next server and a real Postgres seeded by
 * `npm run db:seed`, not a mock. WORKFLOW.md calls the seed the source of the
 * reachable states, so the tests assert what the seed guarantees and nothing
 * they invented.
 *
 * IMPORTANT — run against a production build, not `next dev`:
 *
 *   npm run build && npm run start
 *   npx playwright test
 *
 * Under `next dev` with Turbopack (Next 16.4.5) the client bundle for /s/[slug]
 * serves 200 but React never attaches: the DOM has no `__reactProps` key and no
 * click handler fires. Verified directly — a probe of the filter tab found zero
 * React keys, and every interaction test failed while the same tests pass
 * against `next start`. Login hydrates fine in dev, so this is specific to the
 * share route; it is a dev-server bug, not an application bug, and it is why
 * `webServer` below points at the production server.
 *
 * The trade-off that follows: `isSeedMedia()` is gated on
 * `NODE_ENV !== "production"` (src/server/drive/seed-media.ts), so a production
 * build serves the seeded thumbnails as 500. Layout assertions and every
 * interaction still work; only the bitmap content is missing. `screenshots.spec.ts`
 * therefore documents how to capture with real photos (it needs the dev server).
 *
 * Trace and video are on failure only. A green run stays fast; a red one hands
 * back the exact frame where a flow broke.
 *
 * `webServer` runs a production build. Two caveats, both measured:
 *
 * 1. `next start` warns that it is unsupported with `output: "standalone"`, but
 *    it still serves static assets and hydrates correctly here (probe: 2 React
 *    keys, `window.next` present, filter tab 24→16 tiles). So `next start` works
 *    and is not a bug — the warning is only noise. `webServer` nevertheless runs
 *    `node .next/standalone/server.js` assembled the way `Dockerfile` does, so
 *    the suite exercises the same entrypoint production uses.
 * 2. `isSeedMedia()` is gated on `NODE_ENV !== "production"`
 *    (src/server/drive/seed-media.ts), so a production build serves the seeded
 *    thumbnails as 502. Layout and every interaction still work; only the bitmap
 *    content is missing. `screenshots.spec.ts` documents how to capture with real
 *    photos (it needs the dev server).
 *
 * Two settings exist to keep that guarantee honest:
 *
 * - `E2E_PORT` defaults to 3100, not 3000. A dev server left running on 3000 is
 *   common while iterating, and sharing a port with it is how the suite silently
 *   ends up measuring the wrong build.
 * - `reuseExistingServer` is false. Playwright must own the process it tests:
 *   reusing whatever already answers on the URL means a stale dev server passes
 *   or fails the suite without anyone noticing. `false` turns that into a loud
 *   "port in use" instead of a quiet wrong answer.
 */
const PORT = process.env.E2E_PORT ?? "3100";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      // Sign-in happens once and the storage state is reused, so the admin
      // journeys do not each pay for a login round trip.
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "guest",
      testMatch: "**/share.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "admin",
      testMatch: "**/admin.spec.ts",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: ".e2e/admin.json",
      },
    },
    {
      // Captures report screenshots. Opt-in only: it asserts nothing, so the
      // default `npx playwright test` must not run it. Enabling it needs a dev
      // server, because `isSeedMedia()` is gated on NODE_ENV !== "production"
      // and every seeded thumbnail 502s under `next start` — waiting for a
      // decoded bitmap there can only time out.
      //
      //   E2E_SCREENSHOTS=1 E2E_BASE_URL=http://127.0.0.1:3000 npx playwright test
      name: "screenshots",
      testMatch: "**/screenshots.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
  ].filter((project) => project.name !== "screenshots" || process.env.E2E_SCREENSHOTS === "1"),

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // Build, then assemble the standalone output exactly the way
        // `Dockerfile` does, then run it with `node server.js`.
        //
        // The env is loaded from `.env.local` explicitly. `cd .next/standalone`
        // moves the working directory, and Next resolves `.env*` relative to
        // cwd — so the server started there finds no environment file and dies
        // with "DATABASE_URL is required". `next start` from the project root
        // did not have this problem, which is why it only surfaced after
        // switching to the deploy entrypoint.
        command: [
          "npm run build",
          "cp -R public .next/standalone/public",
          "cp -R .next/static .next/standalone/.next/static",
          `set -a && . ./.env.local && set +a && cd .next/standalone && PORT=${PORT} HOSTNAME=127.0.0.1 node server.js`,
        ].join(" && "),
        url: `http://127.0.0.1:${PORT}/login`,
        reuseExistingServer: false,
        timeout: 240_000,
      },
});
