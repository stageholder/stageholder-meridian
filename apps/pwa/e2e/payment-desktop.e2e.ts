import { test, expect } from "./support/fixtures";
import { env } from "./support/env";
import {
  NO_MX_ERROR,
  cancelAllMeridianTrials,
  registerPayer,
  setBillingEmail,
  signInToHubWeb,
  submitPolarTrialCheckout,
} from "./support/polar";
import { installTauriStub, simulateReturnToApp } from "./support/tauri-stub";

/**
 * OPT-IN (`E2E_PAYMENT=1`): the DESKTOP paid journey. The Tauri app is this
 * same PWA bundle behind `window.__TAURI_INTERNALS__` (see
 * `support/tauri-stub.ts`), so the "app" is a stubbed Chromium page and the
 * "system browser" is a second, plain browser context with no app session —
 * which is exactly what a desktop user's browser looks like.
 *
 * What must hold on desktop (`lib/billing-return.ts`,
 * `hooks/use-billing-return-refresh.ts`, `routes/_auth/billing.complete.tsx`):
 *
 *   1. Checkout, the customer portal and "Update billing email" never load in
 *      the app window: they go to the OS opener, and the webview stays put.
 *   2. Polar sends the browser back to the PUBLIC `/billing/complete` page on
 *      the web origin — it renders without a session, no login bounce.
 *   3. When the user comes back to the app, it rotates the session on its own
 *      and shows the new plan (and later the cancellation) with no reload.
 *
 * Opt-in like `payment.e2e.ts`: every run leaves a cancelled trial in the
 * Polar sandbox and needs the Hub ↔ Polar ↔ Meridian webhooks live.
 */
test.use({ storageState: { cookies: [], origins: [] } });
test.setTimeout(480_000);

const TOKEN_ENDPOINT = /\/oidc\/oauth2\/token$/;

test("desktop paid journey: checkout + portal in the system browser, app refreshes on return", async ({
  page,
  browser,
}) => {
  test.skip(
    !process.env.E2E_PAYMENT,
    "set E2E_PAYMENT=1 to run the Polar sandbox journey",
  );
  test.skip(
    !/localhost|127\.0\.0\.1/.test(env.hubWebUrl),
    "sign-up only on the local Hub",
  );
  const appOrigin = new URL(env.pwaUrl).origin;

  // The "app": a page that looks like the Tauri webview from its first byte.
  const tauri = await installTauriStub(page);
  const payer = await registerPayer(page, "desk");
  expect(await page.evaluate(() => "__TAURI_INTERNALS__" in window)).toBe(true);

  // The "system browser": no Tauri, no Meridian session.
  const systemBrowser = await browser.newContext({ baseURL: env.pwaUrl });
  const sys = await systemBrowser.newPage();

  try {
    // 1. Billing email: the e2e domain has no MX → tailored error; "Update
    //    billing email" hands the Hub settings URL to the OS instead of
    //    opening a tab in the app.
    await page.goto("/settings/billing/upgrade");
    const trialButton = page.getByRole("button", {
      name: /Start 14-day free trial/,
    });
    await trialButton.waitFor({ timeout: 60_000 }); // pricing comes from the Hub
    await trialButton.click();
    await expect(page.getByText(NO_MX_ERROR)).toBeVisible();
    const hubSettingsUrl = await tauri.next(() =>
      page.getByRole("button", { name: "Update billing email" }).click(),
    );
    expect(new URL(hubSettingsUrl).origin).toBe(new URL(env.hubWebUrl).origin);
    expect(page.context().pages()).toHaveLength(1);
    await signInToHubWeb(sys, payer);
    await sys.goto(hubSettingsUrl);
    await setBillingEmail(sys);

    // 2. Checkout: the app hands Polar's URL to the OS and stays on the
    //    upgrade page.
    const checkoutUrl = await tauri.next(() =>
      page.getByRole("button", { name: /Start 14-day free trial/ }).click(),
    );
    expect(new URL(checkoutUrl).host).toContain("polar.sh");
    await expect(page).toHaveURL(/\/settings\/billing\/upgrade$/);

    // 3. Pay in the browser → Polar returns it to the public completion page
    //    on the web origin, which renders with no session and no app shell.
    await sys.goto(checkoutUrl);
    await submitPolarTrialCheckout(sys, "JEVB E2E Desktop Payer");
    await sys.waitForURL(/\/billing\/complete/, { timeout: 120_000 });
    expect(new URL(sys.url()).origin).toBe(appOrigin);
    await expect(
      sys.getByRole("heading", { name: "Payment complete" }),
    ).toBeVisible();
    await expect(sys.getByRole("navigation", { name: "Sidebar" })).toHaveCount(
      0,
    );
    await expect(sys).not.toHaveURL(/\/auth\//);

    // 4. Back to the app: the focus handler rotates the token and the upgrade
    //    page flips to the trialing state with no reload.
    const rotated = page.waitForResponse(
      (r) => TOKEN_ENDPOINT.test(r.url()) && r.request().method() === "POST",
      { timeout: 30_000 },
    );
    await simulateReturnToApp(page);
    await rotated;
    await expect(page.getByText("Currently trialing this plan")).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      page.getByRole("button", { name: /Start 14-day free trial/ }),
    ).toHaveCount(0);

    // 5. The session survived in the (stubbed) Tauri store: a reload keeps
    //    the user signed in and the billing page shows the trial.
    await page.goto("/settings/billing");
    await expect(
      page.getByRole("heading", { level: 1, name: "Unlimited" }),
    ).toBeVisible();
    await expect(
      page.getByText(/^Trial ends .*, then your first payment\.$/),
    ).toBeVisible();

    // 6. Portal: same shape — URL to the OS, cancel in the browser, the app
    //    picks the cancellation up on return.
    const portalUrl = await tauri.next(() =>
      page.getByRole("button", { name: "Manage payment" }).click(),
    );
    expect(new URL(portalUrl).host).toContain("polar.sh");
    await expect(page).toHaveURL(/\/settings\/billing$/);
    await sys.goto(portalUrl);
    await cancelAllMeridianTrials(sys);

    const rotatedAgain = page.waitForResponse(
      (r) => TOKEN_ENDPOINT.test(r.url()) && r.request().method() === "POST",
      { timeout: 30_000 },
    );
    await simulateReturnToApp(page);
    await rotatedAgain;
    await expect(
      page.getByText(/^Cancelled: Unlimited ends .*, then you move to Free\.$/),
    ).toBeVisible({ timeout: 60_000 });
  } finally {
    await systemBrowser.close();
  }
});
