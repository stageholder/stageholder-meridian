import { test, expect } from "./support/fixtures";
import { env } from "./support/env";
import {
  NO_MX_ERROR,
  cancelAllMeridianTrials,
  registerPayer,
  setBillingEmail,
  submitPolarTrialCheckout,
} from "./support/polar";

/**
 * OPT-IN (`E2E_PAYMENT=1`): the full paid journey on the Polar SANDBOX with a
 * brand-new account — Hub sign-up → billing email → Unlimited trial checkout
 * (test card 4242) → success page → caps lifted → billing page → cancel in
 * the Polar customer portal → billing page shows the cancellation.
 *
 * Opt-in because every run leaves a (cancelled) trial in the Polar sandbox
 * and needs the Hub ↔ Polar ↔ Meridian webhooks live (Hub reachable by
 * Polar, Meridian's endpoint registered — see README). The desktop variant
 * of this journey is `payment-desktop.e2e.ts`.
 */
test.use({ storageState: { cookies: [], origins: [] } });
test.setTimeout(420_000);

test("paid journey: trial checkout → caps lifted → cancel in portal", async ({
  page,
}) => {
  test.skip(
    !process.env.E2E_PAYMENT,
    "set E2E_PAYMENT=1 to run the Polar sandbox journey",
  );
  test.skip(
    !/localhost|127\.0\.0\.1/.test(env.hubWebUrl),
    "sign-up only on the local Hub",
  );

  // 1. New account → Meridian onboarding.
  await registerPayer(page, "pay");

  // 2. The e2e domain has no MX → Hub refuses checkout with the TAILORED
  //    message + a working "Update billing email" (opens Hub org settings in
  //    a new tab on the web).
  await page.goto("/settings/billing/upgrade");
  const trialButton = page.getByRole("button", {
    name: /Start 14-day free trial/,
  });
  await trialButton.waitFor({ timeout: 60_000 }); // pricing comes from the Hub
  await trialButton.click();
  await expect(page.getByText(NO_MX_ERROR)).toBeVisible();
  const hubTab = page.context().waitForEvent("page");
  await page.getByRole("button", { name: "Update billing email" }).click();
  const hub = await hubTab;
  await setBillingEmail(hub);
  await hub.close();

  // 3. Checkout on the Polar sandbox, in the same tab.
  await page.getByRole("button", { name: /Start 14-day free trial/ }).click();
  await submitPolarTrialCheckout(page, "JEVB E2E Payer");

  // 4. Back in Meridian: the success page must name the NEW plan (it used to
  //    say "You're on Free." — token rotated before the webhook landed).
  await page.waitForURL(/\/settings\/billing\/success/, { timeout: 120_000 });
  await expect(
    page.getByRole("heading", { name: "You're on Unlimited." }),
  ).toBeVisible({
    timeout: 60_000,
  });

  // 5. Billing page: trial, with its end date.
  await page.goto("/settings/billing");
  await expect(
    page.getByRole("heading", { level: 1, name: "Unlimited" }),
  ).toBeVisible();
  await expect(
    page.getByText(/^Trial ends .*, then your first payment\.$/),
  ).toBeVisible();

  // 6. Cancel in the Polar portal (same tab on the web).
  await page.getByRole("button", { name: "Manage payment" }).click();
  await cancelAllMeridianTrials(page);

  // 7. Meridian reflects the cancellation (Hub row via webhook).
  await page.goto("/settings/billing");
  await expect(
    page.getByText(/^Cancelled: Unlimited ends .*, then you move to Free\.$/),
  ).toBeVisible({ timeout: 60_000 });
});
