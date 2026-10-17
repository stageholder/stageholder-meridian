import { test, expect } from "./support/fixtures";
import { env } from "./support/env";
import { waitForAppUrl } from "./support/sign-in";
import { completeOnboarding } from "./support/onboarding";

/**
 * A brand-new person: Hub sign-up → Meridian onboarding → first journal
 * encryption setup. Registers a throwaway `jevb+meridian-new-<ts>@…` account
 * on the LOCAL Hub every run (local Hub sign-up needs no email verification).
 *
 * Regression guard: the setup dialog used to unmount the moment the key was
 * created, so the recovery codes were never shown (encryption-gate.tsx).
 */
test.use({ storageState: { cookies: [], origins: [] } });

test("new user: sign-up → onboarding → journal setup shows recovery codes", async ({
  page,
}) => {
  test.skip(
    !/localhost|127\.0\.0\.1/.test(env.hubWebUrl),
    "sign-up only on the local Hub",
  );
  const email = `jevb+meridian-new-${Date.now()}@e2e.stageholder.com`;
  const password = `Jevb-${crypto.randomUUID()}-Aa1!`;
  const passphrase = `Jevb-journal-${crypto.randomUUID()}`;

  // 1. Hub sign-up, then the OIDC round-trip into Meridian.
  await page.goto(`${env.hubWebUrl}/auth/register`);
  await page
    .getByRole("textbox", { name: "Full name" })
    .fill("JEVB E2E Newcomer");
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  // Hub sign-up provisions the user + org; it can take a while on a slow link.
  await expect(page).toHaveURL(/\/account/, { timeout: 60_000 });

  await page.goto("/habits");
  await waitForAppUrl(page);

  // 2. A new account is sent through onboarding, never past it.
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByText(/Welcome to Meridian/)).toBeVisible();
  await completeOnboarding(page);
  await expect(page).toHaveURL(/localhost:\d+\/$/);
  await page.reload();
  await expect(page).not.toHaveURL(/\/onboarding/);

  // 3. First journal visit: set up encryption, recovery codes MUST show.
  await page.goto("/journal");
  await page.getByRole("button", { name: "Set Up", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Set Up Journal Encryption",
  });
  await dialog
    .getByRole("textbox", { name: "Encryption Passphrase" })
    .fill(passphrase);
  await dialog
    .getByRole("textbox", { name: "Confirm Passphrase" })
    .fill(passphrase);
  await dialog.getByRole("button", { name: "Set Up Encryption" }).click();

  const codes = page.getByRole("dialog", { name: "Save Your Recovery Codes" });
  await expect(codes).toBeVisible();
  await expect(
    codes.getByRole("button", { name: "Copy to Clipboard" }),
  ).toBeVisible();
  await codes.getByRole("checkbox").click();
  await codes.getByRole("button", { name: "Done" }).click();
  await expect(codes).toBeHidden();

  // 4. Unlocked: a new entry can be started.
  await page.getByRole("button", { name: "New Journal" }).click();
  await expect(
    page.getByRole("textbox", { name: "Text editor" }),
  ).toBeVisible();
});
