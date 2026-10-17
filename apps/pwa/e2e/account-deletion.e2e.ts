import { existsSync, readFileSync } from "node:fs";
import { MongoClient } from "mongodb";

import { test, expect } from "./support/fixtures";
import { env } from "./support/env";
import { waitForAppUrl } from "./support/sign-in";
import { completeOnboarding } from "./support/onboarding";

/**
 * OPT-IN (`E2E_WEBHOOKS=1`): GDPR erasure. A brand-new account gets data in
 * every Meridian collection, deletes itself on the Hub (Account → Security →
 * Delete account), and the Hub's `user.deleted` webhook must leave ZERO rows
 * for that user in Meridian's database.
 *
 * Opt-in because it needs the live Hub → Svix → Meridian loop (Meridian's
 * API reachable through a tunnel and registered in the Hub — see README).
 * Reads Meridian's database directly: MONGODB_URI from the env or
 * apps/api/.env (never printed).
 */
test.use({ storageState: { cookies: [], origins: [] } });
test.setTimeout(300_000);

/** Every collection that stores a user's data, and how it is keyed. */
const OWNED: Record<string, (sub: string) => Record<string, string>> = {
  users: (sub) => ({ sub }),
  journal_security: (sub) => ({ _id: sub }),
  journals: (userSub) => ({ userSub }),
  habits: (userSub) => ({ userSub }),
  habit_entries: (userSub) => ({ userSub }),
  habit_groups: (userSub) => ({ userSub }),
  todos: (userSub) => ({ userSub }),
  todo_lists: (userSub) => ({ userSub }),
  tags: (userSub) => ({ userSub }),
  notifications: (userSub) => ({ userSub }),
  light_events: (userSub) => ({ userSub }),
  user_lights: (userSub) => ({ userSub }),
  activities: (userSub) => ({ userSub }),
  feedbacks: (userSub) => ({ userSub }),
};

function mongoUri(): string | undefined {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  const file = new URL("../../api/.env", import.meta.url).pathname;
  if (!existsSync(file)) return undefined;
  return readFileSync(file, "utf8")
    .match(/^MONGODB_URI=(.+)$/m)?.[1]
    ?.trim()
    .replace(/^"|"$/g, "");
}

async function countsFor(client: MongoClient, sub: string) {
  const db = client.db();
  const out: Record<string, number> = {};
  for (const [name, query] of Object.entries(OWNED)) {
    out[name] = await db.collection(name).countDocuments(query(sub) as never);
  }
  return out;
}

test("account deletion on the Hub erases every Meridian row (user.deleted)", async ({
  page,
}) => {
  test.skip(
    !process.env.E2E_WEBHOOKS,
    "set E2E_WEBHOOKS=1 (needs the live Hub → Meridian webhook)",
  );
  test.skip(
    !/localhost|127\.0\.0\.1/.test(env.hubWebUrl),
    "sign-up only on the local Hub",
  );
  const uri = mongoUri();
  test.skip(!uri, "MONGODB_URI not available (env or apps/api/.env)");

  const email = `jevb+meridian-del-${Date.now()}@e2e.stageholder.com`;
  const password = `Jevb-${crypto.randomUUID()}-Aa1!`;
  const passphrase = `Jevb-journal-${crypto.randomUUID()}`;

  // 1. New account → Meridian onboarding.
  await page.goto(`${env.hubWebUrl}/auth/register`);
  await page
    .getByRole("textbox", { name: "Full name" })
    .fill("JEVB E2E Deletee");
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account/, { timeout: 30_000 });
  await page.goto("/");
  await waitForAppUrl(page);
  await expect(page).toHaveURL(/\/onboarding$/);
  await completeOnboarding(page);

  // 2. Data everywhere: journal keys + an encrypted entry through the UI…
  await page.goto("/journal");
  await page.getByRole("button", { name: "Set Up", exact: true }).click();
  const setup = page.getByRole("dialog", { name: "Set Up Journal Encryption" });
  await setup
    .getByRole("textbox", { name: "Encryption Passphrase" })
    .fill(passphrase);
  await setup
    .getByRole("textbox", { name: "Confirm Passphrase" })
    .fill(passphrase);
  await setup.getByRole("button", { name: "Set Up Encryption" }).click();
  const codes = page.getByRole("dialog", { name: "Save Your Recovery Codes" });
  await codes.getByRole("checkbox").click();
  await codes.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "New Journal" }).click();
  const saved = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" && /\/api\/v1\/journals$/.test(r.url()),
  );
  await page.getByRole("textbox", { name: "Text editor" }).click();
  await page.keyboard.type("JEVB deletion test entry");
  await saved;

  // …and the rest through the API with the page's own session.
  const sub = await page.evaluate(async (apiUrl) => {
    const s = JSON.parse(localStorage.getItem("stageholder:session:meridian")!);
    const headers = {
      Authorization: `Bearer ${s.accessToken}`,
      "Content-Type": "application/json",
    };
    const api = async (method: string, path: string, body?: unknown) => {
      const r = await fetch(`${apiUrl}/api/v1${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!r.ok) throw new Error(`${method} ${path} → ${r.status}`);
      return r.json();
    };
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const habit = await api("POST", "/habits", {
      name: "JEVB del habit",
      frequency: "daily",
      targetCount: 1,
    });
    await api("POST", `/habits/${habit.id}/entries`, { date: today, value: 1 });
    await api("POST", "/habit-groups", { name: "JEVB del group" });
    const list = await api("POST", "/todo-lists", { name: "JEVB del list" });
    await api("POST", "/todos", { title: "JEVB del todo", listId: list.id });
    await api("POST", "/feedback", {
      type: "bug",
      message: "JEVB deletion test",
    });
    const payload = s.accessToken
      .split(".")[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    return JSON.parse(atob(payload)).sub as string;
  }, env.apiUrl);

  const client = new MongoClient(uri!);
  await client.connect();
  try {
    const before = await countsFor(client, sub);
    for (const name of [
      "users",
      "journal_security",
      "journals",
      "habits",
      "habit_entries",
      "habit_groups",
      "todos",
      "todo_lists",
      "light_events",
      "user_lights",
      "feedbacks",
    ]) {
      expect(before[name], `seeded ${name}`).toBeGreaterThan(0);
    }

    // 3. The customer deletes their own Stageholder account on the Hub.
    await page.goto(`${env.hubWebUrl}/account/settings/security`);
    await page.getByRole("button", { name: "Delete account" }).click();
    const confirm = page.getByRole("dialog", { name: "Delete your account?" });
    await confirm
      .getByRole("textbox", { name: "Enter your password to confirm" })
      .fill(password);
    await confirm.getByRole("button", { name: "Delete account" }).click();
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 30_000 });

    // 4. user.deleted (via Svix) must erase EVERY collection for that user.
    await expect
      .poll(async () => countsFor(client, sub), {
        timeout: 90_000,
        intervals: [2_000],
        message: "rows left for the deleted user",
      })
      .toEqual(Object.fromEntries(Object.keys(OWNED).map((k) => [k, 0])));
  } finally {
    await client.close();
  }
});
