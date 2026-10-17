import type { Page } from "@playwright/test";

import { test, expect, open } from "./support/fixtures";
import { env, uniqueName } from "./support/env";

/**
 * End-to-end encrypted journal. The account's passphrase was set up on the
 * first run (or by first-run.e2e.ts for a fresh account); the decrypted key
 * lives in memory only, so every page load starts LOCKED.
 */
async function unlockJournal(page: Page, passphrase = env.journalPassphrase) {
  await open(page, "/journal");
  const locked = page.getByRole("heading", { name: "Journal Locked" });
  const setUp = page.getByRole("button", { name: "Set Up", exact: true });
  await expect(
    locked
      .or(setUp)
      .or(page.getByRole("button", { name: "New Journal" }))
      .first(),
  ).toBeVisible();
  if (await setUp.isVisible().catch(() => false)) {
    // First run on this account: set the passphrase up.
    await setUp.click();
    const d = page.getByRole("dialog", { name: "Set Up Journal Encryption" });
    await d
      .getByRole("textbox", { name: "Encryption Passphrase" })
      .fill(passphrase);
    await d
      .getByRole("textbox", { name: "Confirm Passphrase" })
      .fill(passphrase);
    await d.getByRole("button", { name: "Set Up Encryption" }).click();
    await page
      .getByRole("button", { name: /done|saved|continue/i })
      .first()
      .click();
    return;
  }
  if (await locked.isVisible().catch(() => false)) {
    await page
      .getByRole("textbox", { name: "Encryption passphrase" })
      .fill(passphrase);
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(locked).toBeHidden();
  }
}

test.describe("journal", () => {
  test.skip(!env.journalPassphrase, "E2E_JOURNAL_PASSPHRASE not set");

  test.beforeEach(async ({ api }) => {
    await api.resetAccount();
  });
  test.afterAll(async ({ api }) => {
    await api.resetAccount();
  });

  test("wrong passphrase keeps the journal locked", async ({ page }) => {
    await open(page, "/journal");
    const locked = page.getByRole("heading", { name: "Journal Locked" });
    const setUp = page.getByRole("button", { name: "Set Up", exact: true });
    await expect(locked.or(setUp).first()).toBeVisible();
    test.skip(
      await setUp.isVisible(),
      "journal not set up yet on this account",
    );
    await page
      .getByRole("textbox", { name: "Encryption passphrase" })
      .fill("definitely-wrong-passphrase");
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(
      page.getByText(/incorrect|wrong|invalid/i).first(),
    ).toBeVisible();
    await expect(locked).toBeVisible();
  });

  test("write an entry: autosaved as ciphertext, decrypts after reload + unlock", async ({
    page,
    api,
  }) => {
    const secret = uniqueName("secret words");
    await unlockJournal(page);
    await page.getByRole("button", { name: "New Journal" }).click();
    await expect(page).toHaveURL(/\/journal\/new$/);

    const saved = page.waitForRequest(
      (r) => r.method() === "POST" && /\/api\/v1\/journals$/.test(r.url()),
    );
    const editor = page.getByRole("textbox", { name: "Text editor" });
    await editor.click();
    await page.keyboard.type(secret);
    const req = await saved;
    // E2E encryption: the entry text must never leave the browser in clear.
    expect(req.postData() ?? "", "journal POST body").not.toContain(secret);
    expect((await req.response())?.status()).toBeLessThan(300);

    await expect.poll(async () => (await api.list("/journals")).length).toBe(1);

    // Reload drops the in-memory key → locked → unlock → plaintext again.
    await page.goto("/journal");
    await expect(
      page.getByRole("heading", { name: "Journal Locked" }),
    ).toBeVisible();
    await unlockJournal(page);
    await expect(page.getByText(secret).first()).toBeVisible();
  });
});
