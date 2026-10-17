import { expect, type Page } from "@playwright/test";

import { env } from "./env";
import { completeOnboarding } from "./onboarding";
import { waitForAppUrl } from "./sign-in";

/**
 * Steps shared by the Polar-sandbox paid journeys (`payment.e2e.ts` for the
 * web, `payment-desktop.e2e.ts` for the Tauri desktop flow). Both are opt-in
 * (`E2E_PAYMENT=1`): every run leaves a cancelled trial in the sandbox and
 * needs the Hub ↔ Polar ↔ Meridian webhooks live (see README).
 */

/** Polar accepts it (the domain has MX records); nobody receives the mail. */
export const BILLING_EMAIL = "jevb-billing-test@stageholder.com";

/** Tailored error the Hub returns while the org's billing email has no MX. */
export const NO_MX_ERROR = /billing email's domain doesn't accept mail/;

export interface Payer {
  email: string;
  password: string;
}

/**
 * Register a brand-new account on the local Hub and finish Meridian
 * onboarding in the same page. The new org's billing email is the sign-up
 * email, whose e2e domain has no MX — checkout is refused until
 * `setBillingEmail` runs.
 */
export async function registerPayer(page: Page, label: string): Promise<Payer> {
  const email = `jevb+meridian-${label}-${Date.now()}@e2e.stageholder.com`;
  const password = `Jevb-${crypto.randomUUID()}-Aa1!`;
  await page.goto(`${env.hubWebUrl}/auth/register`);
  await page
    .getByRole("textbox", { name: "Full name" })
    .fill(`JEVB E2E ${label} payer`);
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  // Hub sign-up provisions the user + org; it can take a while on a slow link.
  await expect(page).toHaveURL(/\/account/, { timeout: 60_000 });
  await page.goto("/");
  await waitForAppUrl(page);
  await expect(page).toHaveURL(/\/onboarding$/);
  await completeOnboarding(page);
  return { email, password };
}

/** Sign in on the Hub web login page (a browser that has no Hub session yet). */
export async function signInToHubWeb(page: Page, payer: Payer): Promise<void> {
  await page.goto(`${env.hubWebUrl}/auth/login`);
  const emailBox = page.getByRole("textbox", { name: /email/i });
  await emailBox.waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await emailBox.fill(payer.email);
  await page.locator('input[type="password"]').fill(payer.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/account/, { timeout: 30_000 });
}

/** On the Hub org settings page: switch the billing email to one Polar accepts. */
export async function setBillingEmail(hub: Page): Promise<void> {
  await expect(hub).toHaveURL(/\/account\/[^/]+\/settings$/);
  await hub.getByRole("textbox", { name: "Billing Email" }).fill(BILLING_EMAIL);
  // The save is the only write the page makes: wait for the Hub to accept it
  // (a slow Hub can take seconds), then read the value back from the server —
  // the Hub is asked to create a checkout right after this.
  const saved = hub.waitForResponse(
    (r) => r.request().method() !== "GET" && r.status() < 400,
    { timeout: 60_000 },
  );
  await hub.getByRole("button", { name: /save/i }).first().click();
  await saved;
  await hub.reload();
  await expect(hub.getByRole("textbox", { name: "Billing Email" })).toHaveValue(
    BILLING_EMAIL,
    {
      timeout: 30_000,
    },
  );
}

/**
 * On the Polar sandbox checkout: enter the 4242 test card and start the
 * trial. Stripe's card frame is cross-origin and ignores clicks but takes
 * keyboard focus: Shift+Tab from "Cardholder name" walks back through CVC →
 * expiry → card number.
 */
export async function submitPolarTrialCheckout(
  page: Page,
  cardholder: string,
): Promise<void> {
  await page.waitForURL((u) => u.host.includes("polar.sh"), {
    timeout: 60_000,
  });
  const name = page.getByRole("textbox", { name: "Cardholder name" });
  await name.waitFor({ timeout: 60_000 });
  await page.waitForTimeout(4000);
  await name.fill(cardholder);
  await name.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.type("123", { delay: 60 });
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.type("1230", { delay: 60 });
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.type("4242424242424242", { delay: 40 });
  await page.getByRole("button", { name: "Start trial" }).click();
}

/**
 * On the Polar customer portal: cancel EVERY still-active Meridian
 * subscription ("Meridian Unlimited — Monthly" cards). Every test account
 * shares one sandbox billing email (= one Polar customer), so the portal
 * lists earlier runs' Meridian trials too; other products' subscriptions are
 * never touched. Never a silent no-op: at least one (this run's own trial)
 * must be there.
 */
export async function cancelAllMeridianTrials(page: Page): Promise<void> {
  await page.waitForURL((u) => u.host.includes("polar.sh"), {
    timeout: 60_000,
  });
  const heading = page.getByRole("heading", { name: /^Meridian\b/, level: 3 });
  await heading.first().waitFor({ timeout: 60_000 });
  // A subscription card = the heading's nearest ancestor holding a
  // "Manage subscription" button; a cancelled one also offers "Uncancel".
  const active = heading
    .locator(
      "xpath=ancestor::*[.//button[contains(normalize-space(.),'Manage subscription')]][1]",
    )
    .filter({ hasNot: page.getByRole("button", { name: "Uncancel" }) });
  expect(await active.count()).toBeGreaterThan(0);
  // No page.reload() between cancels: the sandbox portal's session does not
  // survive one ("Something went wrong") — wait for the card to flip instead.
  for (let guard = 0; guard < 15 && (await active.count()) > 0; guard++) {
    const remaining = await active.count();
    await active
      .first()
      .getByRole("button", { name: "Manage subscription" })
      .click();
    await page.getByRole("button", { name: "Cancel Subscription" }).click();
    const survey = page
      .getByRole("dialog")
      .filter({ hasText: "sorry to see you go" });
    await survey.getByText("Other (please share below)").click();
    await survey.getByRole("button", { name: "Cancel Subscription" }).click();
    await expect(survey).toBeHidden({ timeout: 30_000 });
    await page.keyboard.press("Escape"); // close the subscription side panel
    await expect
      .poll(() => active.count(), { timeout: 30_000 })
      .toBeLessThan(remaining);
  }
  expect(await active.count()).toBe(0);
}
