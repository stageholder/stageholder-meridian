import { expect, type Page } from "@playwright/test";

/**
 * Walk the `/onboarding` wizard (welcome → profile → goals → features → all
 * set) with the defaults, picking the first goal. No-op when the page is not
 * on onboarding.
 */
export async function completeOnboarding(page: Page): Promise<void> {
  const onOnboarding = () =>
    new URL(page.url()).pathname.startsWith("/onboarding");
  if (!onOnboarding()) return;
  for (let step = 0; step < 8 && onOnboarding(); step++) {
    const finish = page.getByRole("button", { name: "Go to Dashboard" });
    if (await finish.isVisible().catch(() => false)) {
      await finish.click();
      break;
    }
    const goal = page.getByRole("checkbox").first();
    if (
      (await goal.isVisible().catch(() => false)) &&
      !(await goal.isChecked().catch(() => true))
    ) {
      await goal.click();
    }
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.waitForTimeout(400);
  }
  await expect(page).not.toHaveURL(/\/onboarding/);
}
