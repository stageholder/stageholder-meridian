import { readFileSync, existsSync } from "node:fs";
import { Webhook } from "svix";

import { test, expect } from "./support/fixtures";
import { env, uniqueName } from "./support/env";

/**
 * API-level contracts that no screen exercises but a launch depends on.
 * They run against the same local API as the browser journeys.
 */

/** STAGEHOLDER_WEBHOOK_SECRET from the env, else apps/api/.env (never printed). */
function webhookSecret(): string | undefined {
  if (process.env.STAGEHOLDER_WEBHOOK_SECRET)
    return process.env.STAGEHOLDER_WEBHOOK_SECRET;
  const file = new URL("../../api/.env", import.meta.url).pathname;
  if (!existsSync(file)) return undefined;
  return readFileSync(file, "utf8")
    .match(/^STAGEHOLDER_WEBHOOK_SECRET=(.+)$/m)?.[1]
    ?.trim();
}

const WEBHOOK_URL = `${env.apiUrl}/api/v1/webhooks/stageholder`;

test.describe("api", () => {
  test("GET /feedback returns only the caller's own feedback", async ({
    api,
  }) => {
    const message = uniqueName("feedback");
    await api.post("/feedback", { type: "bug", message });
    const res = await api.get<{
      data: Array<{ userSub: string; message: string }>;
    }>("/feedback?limit=100");
    expect(res.data.map((f) => f.message)).toContain(message);
    // Regression: this used to list EVERY user's feedback.
    const owners = new Set(res.data.map((f) => f.userSub));
    expect(owners.size).toBe(1);
  });

  test("Free plan caps: seeded groups don't count; unarchive honours max_habits", async ({
    api,
  }) => {
    type Item = { id: string };
    const ent = await api.get<{
      plan: string;
      limits: { max_habits: number; max_habit_groups: number };
    }>("/me/entitlement");
    test.skip(ent.plan !== "free", "account is not on the Free plan");
    // MeridianApi throws `METHOD /path → <status>: <body>`.
    const limitReached = /→ 402: .*limit_reached/;

    // Free allows `max_habit_groups` (5) groups. The 4 seeded time-of-day
    // groups must NOT eat that allowance (they used to: one custom group fit).
    const groups: Item[] = [];
    for (let i = 1; i <= ent.limits.max_habit_groups; i++) {
      groups.push(
        await api.post<Item>("/habit-groups", { name: uniqueName(`grp${i}`) }),
      );
    }
    await expect(
      api.post("/habit-groups", { name: uniqueName("grp6") }),
    ).rejects.toThrow(limitReached);

    // Free allows `max_habits` (3) active habits. Archiving frees a slot;
    // unarchiving must be refused once the slot is taken again (it used to
    // bypass the cap).
    const habits: Item[] = [];
    for (let i = 1; i <= ent.limits.max_habits; i++) {
      habits.push(
        await api.post<Item>("/habits", {
          name: uniqueName(`habit${i}`),
          frequency: "daily",
          targetCount: 1,
        }),
      );
    }
    await api.post(`/habits/${habits[0]!.id}/archive`);
    await api.post<Item>("/habits", {
      name: uniqueName("habit4"),
      frequency: "daily",
      targetCount: 1,
    });
    await expect(
      api.post(`/habits/${habits[0]!.id}/unarchive`),
    ).rejects.toThrow(limitReached);

    for (const g of groups) await api.delete(`/habit-groups/${g.id}`);
  });

  test("Hub webhook: signed → 200, forged → 401", async () => {
    const secret = webhookSecret();
    test.skip(!secret, "STAGEHOLDER_WEBHOOK_SECRET not set (apps/api/.env)");
    const id = `msg_e2e_${Date.now()}`;
    const ts = new Date();
    const body = JSON.stringify({
      id: `evt_e2e_${Date.now()}`,
      type: "user.profile_updated",
      timestamp: ts.toISOString(),
      data: { userId: "00000000-0000-0000-0000-000000000000" },
    });
    const headers = {
      "content-type": "application/json",
      "svix-id": id,
      "svix-timestamp": String(Math.floor(ts.getTime() / 1000)),
    };
    const ok = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        ...headers,
        "svix-signature": new Webhook(secret!).sign(id, ts, body),
      },
      body,
    });
    // Regression: a pre-registered express.json() swallowed req.rawBody, so
    // every genuine delivery failed (500 "missing rawBody").
    expect(ok.status).toBe(200);

    const forged = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        ...headers,
        "svix-id": `${id}_forged`,
        "svix-signature": "v1,AAAA",
      },
      body,
    });
    // 401 (not 500): the webhook exception filter must win over the catch-all.
    expect(forged.status).toBe(401);
  });
});
