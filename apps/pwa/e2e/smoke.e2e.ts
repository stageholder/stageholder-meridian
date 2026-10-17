import { test, expect, open, expectNoErrorBoundary } from "./support/fixtures";

/**
 * Stack + account sanity check, and a render pass over every app route.
 * Run first: if this fails, the rest of the suite will too.
 */
test.describe("smoke", () => {
  test("signed in, dashboard greets the test account", async ({ page }) => {
    await open(page, "/");
    await expect(page).toHaveURL(/localhost:\d+\/$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /^Good (morning|afternoon|evening|night)/,
      }),
    ).toBeVisible();
    await expectNoErrorBoundary(page);
  });

  const routes: Array<[string, RegExp | string]> = [
    ["/habits", "New Habit"],
    ["/habits/archived", /archived/i],
    ["/todos/inbox", "Add a todo…"],
    ["/todos/upcoming", "Upcoming"],
    ["/todos/completed", "Completed"],
    ["/journal", /New Journal|Journal Locked/],
    ["/calendar", /calendar|today/i],
    ["/journey", /light|journey/i],
    ["/settings", "Save changes"],
    ["/settings/billing", "Your subscription"],
    ["/settings/billing/upgrade", /plan/i],
  ];

  for (const [path, marker] of routes) {
    test(`renders ${path}`, async ({ page }) => {
      await open(page, path);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(
        page.locator("main").getByText(marker).first(),
      ).toBeVisible();
      await expectNoErrorBoundary(page);
    });
  }
});
