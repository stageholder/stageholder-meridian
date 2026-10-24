import { test, expect } from "./support/fixtures";
import { env } from "./support/env";
import { signInViaHub, waitForAppUrl } from "./support/sign-in";

/**
 * Auth round-trips through the Hub. Each test runs in a FRESH, anonymous
 * context: signing out (or a fresh sign-in) in the shared saved state would
 * revoke/rotate the refresh token every other journey reuses.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("auth", () => {
  test("anonymous visit bounces to Hub login with returnTo kept", async ({
    page,
  }) => {
    await page.goto("/journal");
    await expect(page).toHaveURL(new RegExp(`^${env.hubWebUrl}/auth/login`), {
      timeout: 30_000,
    });
    const url = new URL(page.url());
    expect(url.searchParams.get("client_id")).toBe("meridian");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
  });

  test("cross-origin returnTo is ignored: sign-in lands in the app, not /auth/error", async ({
    page,
  }) => {
    await page.goto("/auth/login?returnTo=https%3A%2F%2Fevil.example%2Fsteal");
    const emailBox = page.getByRole("textbox", { name: /email/i });
    await emailBox.waitFor({ state: "visible", timeout: 45_000 });
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await emailBox.fill(env.email);
    await page.locator('input[type="password"]').fill(env.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await waitForAppUrl(page);
    expect(new URL(page.url()).origin).toBe(new URL(env.pwaUrl).origin);
    await expect(page).not.toHaveURL(/\/auth\/error/);
  });

  test("/goodbye renders without a session", async ({ page }) => {
    await page.goto("/goodbye");
    await expect(page).toHaveURL(/\/goodbye/);
    await expect(page.locator("body")).not.toHaveText(/^\s*$/);
  });

  test("fresh sign-in lands on the requested page, sign-out ends the session", async ({
    page,
  }) => {
    await signInViaHub(page, env.email, env.password, "/todos/inbox");
    await expect(page).toHaveURL(/\/todos\/inbox$/);
    await expect(
      page.getByRole("button", { name: "Add a todo…" }),
    ).toBeVisible();

    // The avatar shows the account's initials, which change with the display
    // name, so target its accessible label instead.
    await page.getByLabel("User menu").first().click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).not.toHaveURL(/localhost:4001\/todos/, {
      timeout: 30_000,
    });
    // The session is gone: a protected URL needs the Hub again.
    await page.goto("/habits");
    await expect(page).toHaveURL(new RegExp(`^${env.hubWebUrl}/auth/login`), {
      timeout: 30_000,
    });
  });
});
