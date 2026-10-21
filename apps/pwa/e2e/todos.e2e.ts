import type { Locator, Page } from "@playwright/test";

import { test, expect, open } from "./support/fixtures";
import { uniqueName } from "./support/env";
import type { MeridianApi } from "./support/api";

type Todo = {
  id: string;
  title: string;
  status?: string;
  priority?: string;
  doDate?: string;
  listId?: string;
};

/** Local calendar date `days` from today as YYYY-MM-DD (the app's do-date). */
function isoDay(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${String(d.getDate()).padStart(2, "0")}`;
}

async function inboxId(api: MeridianApi): Promise<string> {
  const lists = await api.list<{ id: string; isDefault?: boolean }>(
    "/todo-lists",
  );
  const inbox = lists.find((l) => l.isDefault);
  if (!inbox) throw new Error("No default Inbox list");
  return inbox.id;
}

/**
 * The todo row for `title` once it has SETTLED: exactly one copy, fully
 * opaque. Adding a todo swaps the optimistic row (temp id) for the server row
 * (real id), so for ~1 s two copies cross-fade; and Playwright counts an
 * `opacity: 0` element as visible. Polling computed opacity catches a row
 * that never finishes its enter animation (a real bug class in Tamagui).
 */
/**
 * The row container. Since 2026-10-21 the row is a plain layout box holding
 * two separate press targets — the checkbox and the "Open todo details" body
 * — so we find the body by its name and step up to the row (`..`), which is
 * what animates and what holds the checkbox.
 */
function todoRow(page: Page, title: string): Locator {
  return page
    .getByRole("button", { name: "Open todo details" })
    .filter({ hasText: title })
    .locator("..");
}

async function settledRow(page: Page, title: string): Promise<Locator> {
  const rows = todoRow(page, title);
  await expect
    .poll(
      async () =>
        rows.evaluateAll((els) => els.map((e) => getComputedStyle(e).opacity)),
      { message: `one fully visible row for "${title}"` },
    )
    .toEqual(["1"]);
  return rows;
}

test.describe("todos", () => {
  test.beforeEach(async ({ api }) => {
    await api.resetAccount();
  });
  test.afterAll(async ({ api }) => {
    await api.resetAccount();
  });

  test("smart quick-add parses date + priority out of the title", async ({
    page,
    api,
  }) => {
    const title = uniqueName("todo");
    await open(page, "/todos/inbox");
    await page.getByRole("button", { name: "Add a todo…" }).click();
    const box = page.getByRole("textbox", { name: /Task name/ });
    await box.fill(`${title} tomorrow !p1`);
    // Parsed chips appear while typing.
    await expect(
      page.getByText("Tomorrow", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Urgent", { exact: true }).first(),
    ).toBeVisible();
    // First Enter accepts the open suggestion, second submits.
    await box.press("Enter");
    await box.press("Enter");

    const row = await settledRow(page, title);
    await expect(row).toContainText("Urgent");

    await expect
      .poll(async () =>
        (await api.list<Todo>("/todos")).some((t) => t.title === title),
      )
      .toBe(true);
    const [todo] = (await api.list<Todo>("/todos")).filter(
      (t) => t.title === title,
    );
    expect(todo, "todo saved with the date words stripped").toBeTruthy();
    expect(todo!.priority).toBe("urgent");
    expect(todo!.doDate?.slice(0, 10)).toBe(isoDay(1));

    await open(page, "/todos/upcoming");
    await expect(page.getByText(title).first()).toBeVisible();
    // The run's browser is pinned east of UTC (Asia/Jakarta), where a UTC
    // date key would name the wrong day and "Tomorrow" would never show.
    // (Mobile's copy of this label — @repo/core/todos/upcoming — had exactly
    // that bug; it is not reachable from these browser journeys.)
    await expect(
      page.locator("main").getByText("Tomorrow", { exact: true }).first(),
    ).toBeVisible();
  });

  test("complete → Completed; reopen → back in Inbox", async ({
    page,
    api,
  }) => {
    const title = uniqueName("complete");
    await api.post("/todos", { title, listId: await inboxId(api) });
    await open(page, "/todos/inbox");
    const row = todoRow(page, title);
    await row.getByRole("checkbox", { name: "Mark as complete" }).click();
    await expect(row).toBeHidden();

    await open(page, "/todos/completed");
    const done = page.getByText(title).first();
    await expect(done).toBeVisible();
    await expect
      .poll(
        async () =>
          (await api.list<Todo>("/todos")).find((t) => t.title === title)
            ?.status,
      )
      .toMatch(/done|completed/i);

    const doneRow = todoRow(page, title);
    await doneRow.getByRole("checkbox").click();
    await expect(doneRow).toBeHidden();
    await open(page, "/todos/inbox");
    await expect(page.getByText(title).first()).toBeVisible();
  });

  test("create a list and add a todo into it", async ({ page, api }) => {
    const listName = uniqueName("list");
    await open(page, "/todos/inbox");
    await page.getByRole("button", { name: "Create list" }).click();
    const dialog = page.getByRole("dialog", { name: "New List" });
    await dialog.getByRole("textbox").first().fill(listName);
    await dialog.getByRole("button", { name: /^(create|save|add)/i }).click();
    await expect(dialog).toBeHidden();

    await page.getByText(listName, { exact: true }).click();
    await expect(page).toHaveURL(/\/todos\/[^/]+$/);
    const title = uniqueName("in list");
    await page.getByRole("button", { name: "Add a todo…" }).click();
    await page.getByRole("textbox", { name: /Task name/ }).fill(title);
    await page.getByRole("button", { name: "Add Todo" }).click();
    await settledRow(page, title);

    await expect
      .poll(async () =>
        (await api.list<Todo>("/todos")).some((t) => t.title === title),
      )
      .toBe(true);
    const lists = await api.list<{ id: string; name: string }>("/todo-lists");
    const list = lists.find((l) => l.name === listName);
    expect(list).toBeTruthy();
    const todo = (await api.list<Todo>("/todos")).find(
      (t) => t.title === title,
    );
    expect(todo?.listId).toBe(list!.id);
  });
});
