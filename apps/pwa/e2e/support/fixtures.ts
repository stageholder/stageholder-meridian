import { existsSync, readFileSync } from "node:fs";
import {
  test as base,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";

import { MeridianApi } from "./api";
import { OWNER_STATE, SKIP_FILE } from "./env";

/**
 * Shared fixtures for every journey:
 *
 * - skips the whole run with the reason global-setup recorded (stack down,
 *   credentials missing) instead of timing out;
 * - collects uncaught page errors and fails the test on any (an app crash is
 *   always a finding), unless the test opts out with `allowPageErrors`;
 * - collects failed (5xx) Meridian API responses the same way;
 * - `api`: REST helper (saved session) for setup and cleanup only.
 */
type Fixtures = {
  allowPageErrors: boolean;
  api: MeridianApi;
};

export const test = base.extend<Fixtures>({
  allowPageErrors: [false, { option: true }],

  page: async ({ page, allowPageErrors }, use) => {
    if (existsSync(SKIP_FILE)) {
      test.skip(true, readFileSync(SKIP_FILE, "utf8"));
    }
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(`${page.url()} :: ${error.message.split("\n")[0]}`);
    });
    page.on("response", (res) => {
      if (res.status() >= 500 && res.url().includes("/api/v1/")) {
        errors.push(`${res.request().method()} ${res.url()} → ${res.status()}`);
      }
    });
    await use(page);
    if (!allowPageErrors) {
      expect(errors, "uncaught page errors / API 5xx").toEqual([]);
    }
  },

  api: async ({}, use) => {
    await use(new MeridianApi(OWNER_STATE));
  },
});

export { expect };

/** The in-app crash screen (route error component). */
export async function expectNoErrorBoundary(page: Page): Promise<void> {
  await expect(
    page.getByText(/something went wrong|unexpected error|application error/i),
  ).toHaveCount(0);
}

/** A toast by text. Kit toasts have no live region, so match visible text. */
export function toast(page: Page, text: string | RegExp): Locator {
  return page.getByText(text).first();
}

/** Navigate inside the app and wait for the shell to render. */
export async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("navigation", { name: "Sidebar" })).toBeVisible({
    timeout: 30_000,
  });
}
