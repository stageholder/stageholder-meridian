import { test, expect, open } from "./support/fixtures";
import { uniqueName } from "./support/env";

type Habit = { id: string; name: string };
type Entry = { id: string; date: string; value: number };

test.describe("habits", () => {
  test.beforeEach(async ({ api }) => {
    await api.resetAccount();
  });
  test.afterAll(async ({ api }) => {
    await api.resetAccount();
  });

  test("create a habit from the dialog", async ({ page, api }) => {
    const name = uniqueName("habit");
    await open(page, "/habits");
    await page.getByRole("button", { name: "New Habit" }).click();
    const dialog = page.getByRole("dialog", { name: "New Habit" });
    await expect(dialog.getByRole("button", { name: "Create" })).toBeDisabled();
    await dialog.getByRole("textbox", { name: "Name" }).fill(name);
    await dialog.getByRole("button", { name: "Green" }).click();
    await dialog.getByRole("button", { name: "Create" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { level: 3, name })).toBeVisible();
    // Persisted, not only optimistic.
    await page.reload();
    await expect(page.getByRole("heading", { level: 3, name })).toBeVisible();
    const habits = await api.list<Habit>("/habits");
    expect(habits.map((h) => h.name)).toContain(name);
  });

  test("check in creates ONE entry for today; undo removes it", async ({
    page,
    api,
  }) => {
    const name = uniqueName("checkin");
    const habit = await api.post<Habit>("/habits", {
      name,
      frequency: "daily",
      targetCount: 1,
    });
    await open(page, "/habits");
    // Each test starts from an empty account, so this is the only card.
    const card = page.locator("main");
    await expect(page.getByRole("heading", { level: 3, name })).toBeVisible();

    await card.getByRole("button", { name: "Check In" }).click();
    await expect(card.getByText("Complete")).toBeVisible();
    await expect
      .poll(
        async () =>
          (await api.get<Entry[]>(`/habits/${habit.id}/entries`)).length,
      )
      .toBe(1);

    // A reload must not lose the check-in or duplicate it.
    await page.reload();
    await expect(card.getByText("Complete")).toBeVisible();
    expect((await api.get<Entry[]>(`/habits/${habit.id}/entries`)).length).toBe(
      1,
    );

    await card.getByRole("button", { name: "Undo last check-in" }).click();
    await expect(card.getByRole("button", { name: "Check In" })).toBeVisible();
    await expect
      .poll(async () => {
        const entries = await api.get<Entry[]>(`/habits/${habit.id}/entries`);
        return entries.filter((e) => e.value > 0).length;
      })
      .toBe(0);
  });

  test("habit detail page opens", async ({ page, api }) => {
    const name = uniqueName("detail");
    const habit = await api.post<Habit>("/habits", {
      name,
      frequency: "daily",
      targetCount: 1,
    });
    await open(page, "/habits");
    await page.getByRole("button", { name: `Open ${name}` }).click();
    await expect(page).toHaveURL(new RegExp(`/habits/${habit.id}$`));
    await expect(page.getByText(name).first()).toBeVisible();
  });

  test("archive moves the habit to Archived", async ({ page, api }) => {
    const name = uniqueName("archive");
    const habit = await api.post<Habit>("/habits", {
      name,
      frequency: "daily",
      targetCount: 1,
    });
    await open(page, "/habits");
    await page.getByRole("button", { name: "Habit options" }).click();
    await page.getByRole("menuitem", { name: /archive/i }).click();
    // Archiving may ask for confirmation.
    const confirm = page
      .getByRole("alertdialog")
      .getByRole("button", { name: /archive/i });
    if (await confirm.isVisible().catch(() => false)) await confirm.click();

    await expect(page.getByRole("heading", { level: 3, name })).toBeHidden();
    await expect
      .poll(async () =>
        (await api.list<Habit>("/habits?archivedOnly=true")).map((h) => h.id),
      )
      .toContain(habit.id);
    await open(page, "/habits/archived");
    await expect(page.getByText(name).first()).toBeVisible();
  });

  test("Free plan: the 4th habit opens the paywall, not a generic error", async ({
    page,
    api,
  }) => {
    const ent = await api.get<{ plan: string; limits: { max_habits: number } }>(
      "/me/entitlement",
    );
    test.skip(ent.plan !== "free", "account is not on the Free plan");
    for (let i = 0; i < ent.limits.max_habits; i++) {
      await api.post("/habits", {
        name: uniqueName(`cap ${i}`),
        frequency: "daily",
        targetCount: 1,
      });
    }
    await open(page, "/habits");
    await page.getByRole("button", { name: "New Habit" }).click();
    const dialog = page.getByRole("dialog", { name: "New Habit" });
    await dialog
      .getByRole("textbox", { name: "Name" })
      .fill(uniqueName("over cap"));
    await dialog.getByRole("button", { name: "Create" }).click();

    await expect(page.getByText("Plan limit reached")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Upgrade your plan" }),
    ).toBeVisible();
    expect((await api.list<Habit>("/habits")).length).toBe(
      ent.limits.max_habits,
    );
  });
});
