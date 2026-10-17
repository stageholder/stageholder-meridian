import { existsSync } from "node:fs";
import { devices, defineConfig } from "@playwright/test";

/**
 * Playwright E2E journeys against the LOCAL dev stack.
 *
 * The operator starts the servers; these tests never do. If the PWA (:4001),
 * the API (:4000) or the Hub (:4828) does not answer, every journey is
 * skipped with a reason. Credentials come from the environment or the
 * gitignored `e2e/.env.e2e`. See e2e/README.md.
 */
const here = (p: string) => new URL(p, import.meta.url).pathname;

const envFile = here("./e2e/.env.e2e");
if (existsSync(envFile)) process.loadEnvFile(envFile);

export const E2E_BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4001";

/**
 * Visible Chromium window by default, so the operator can watch the journeys.
 * `E2E_HEADLESS=1` (or `bun run e2e:headless`, and always under CI) runs
 * without a window. `E2E_SLOWMO` slows each action by N ms; `bun run
 * e2e:watch` uses 250 so a person can follow every click.
 */
const HEADED = !process.env.E2E_HEADLESS && !process.env.CI;
const SLOWMO = Number(process.env.E2E_SLOWMO ?? 0);

export default defineConfig({
  testDir: here("./e2e"),
  // `*.e2e.ts` keeps journeys out of any unit-test glob.
  testMatch: "**/*.e2e.ts",
  // Throwaway exploration specs (gitignored) run only via e2e/.probe/config.ts.
  testIgnore: "**/.probe/**",
  outputDir: here("./test-results"),
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // Journeys share one account and the dev API; run serially so they never
  // race each other's data.
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: here("./playwright-report"), open: "never" }],
  ],
  globalSetup: here("./e2e/support/global-setup.ts"),
  use: {
    baseURL: E2E_BASE_URL,
    headless: !HEADED,
    storageState: `${process.env.E2E_AUTH_DIR ?? here("./e2e/.auth/")}owner.json`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    permissions: ["clipboard-read", "clipboard-write"],
    // East of UTC on purpose: date-key bugs (`toISOString()` on a local
    // midnight) only show there, so every run checks for them.
    timezoneId: "Asia/Jakarta",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        launchOptions: { slowMo: SLOWMO },
      },
    },
  ],
});
