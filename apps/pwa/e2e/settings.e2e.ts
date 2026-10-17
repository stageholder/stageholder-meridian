import { test, expect, open } from "./support/fixtures";

test.describe("settings", () => {
  test("profile display name edit persists after reload", async ({ page }) => {
    await open(page, "/settings");
    const nameBox = page.getByRole("textbox", { name: "Display name" });
    const original = await nameBox.inputValue();
    const changed = `JEVB E2E ${Date.now().toString().slice(-6)}`;
    try {
      await nameBox.fill(changed);
      await page.getByRole("button", { name: "Save changes" }).click();
      await page.waitForLoadState("networkidle").catch(() => undefined);
      await page.reload();
      await expect(
        page.getByRole("textbox", { name: "Display name" }),
      ).toHaveValue(changed);
    } finally {
      // Always restore, so the next run (and the greeting) stay stable.
      const box = page.getByRole("textbox", { name: "Display name" });
      await box.fill(original);
      await page.getByRole("button", { name: "Save changes" }).click();
      await page.waitForLoadState("networkidle").catch(() => undefined);
    }
  });

  test("Targets and Account tabs render", async ({ page }) => {
    await open(page, "/settings");
    await page.getByRole("tab", { name: "Targets" }).click();
    await expect(page.getByRole("tabpanel", { name: "Targets" })).toBeVisible();
    await page.getByRole("tab", { name: "Account" }).click();
    await expect(page.getByRole("tabpanel", { name: "Account" })).toBeVisible();
  });

  test("billing shows the account's current plan and links to plans", async ({
    page,
    api,
  }) => {
    const { plan } = await api.get<{ plan: string }>("/me/entitlement");
    await open(page, "/settings/billing");
    await expect(
      page.getByRole("heading", { name: "Your subscription" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: plan === "free" ? "Free" : "Unlimited",
      }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: plan === "free" ? "See plans" : "Change plan",
      })
      .first()
      .click();
    await expect(page).toHaveURL(/\/settings\/billing\/upgrade$/);
  });
});
