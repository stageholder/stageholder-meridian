/**
 * Dev seed — populate a developer's account with realistic sample data so the
 * app is immediately explorable (todos, habits, journals, calendar, journey).
 *
 * Usage (from the repo root):
 *   bun db:seed you@example.com      # resolves the email to your sub, seeds it
 *   bun db:seed <yourSub>            # or pass the OIDC sub directly
 *   bun db:seed you@example.com --keep   # don't wipe existing data first
 *
 * Every collection is keyed by the Hub OIDC `sub`. Meridian itself never stores
 * emails, but the shared identity store on the same Mongo cluster does
 * (`user_profiles._id` === the sub), so an email arg is resolved through it —
 * cross-checked against Meridian's own users. A plain sub (or an email that
 * doesn't resolve) is used verbatim. The user row is reused if it exists, else
 * created.
 *
 * Idempotent: by default it WIPES the target user's app data first, then writes
 * a deterministic dataset (seeded from the sub), so re-runs are stable. Pass
 * `--keep` to append instead.
 *
 * Safe to run against plaintext: the API's at-rest encryption decrypts any
 * non-`mrdn.`-prefixed value as-is (see EncryptionService.decrypt), so seeding
 * plaintext title/content reads back correctly. Journals are written with
 * `encrypted: false`, so the client renders them without a DEK.
 *
 * Needs only MONGODB_URI (NOT the encryption key). Loaded from apps/api/.env.
 */

import { MongoClient, type Db } from "mongodb";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getTierForLight } from "@repo/core/types/light";

/* ----------------------------- env + CLI ------------------------------ */

function loadEnv(): void {
  if (process.env.MONGODB_URI) return;
  // The seed runs from the repo root; MONGODB_URI lives in apps/api/.env.
  for (const rel of ["apps/api/.env", ".env"]) {
    try {
      const text = readFileSync(join(process.cwd(), rel), "utf8");
      for (const line of text.split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]!]) {
          process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
        }
      }
      if (process.env.MONGODB_URI) return;
    } catch {
      /* file may not exist — try the next candidate */
    }
  }
}

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const subFlagIdx = args.indexOf("--sub");
const explicitSub = subFlagIdx !== -1 ? args[subFlagIdx + 1] : undefined;
const positional = args.filter(
  (a, i) => !a.startsWith("--") && args[i - 1] !== "--sub",
);
const identifier = positional[0];

if (flags.has("--help") || (!identifier && !explicitSub)) {
  console.log(
    "Usage: bun db:seed <you@example.com | yourSub> [--keep]\n" +
      "  <email>  resolved to your OIDC sub via the identity store.\n" +
      "  <sub>    used directly. The user row is created if it doesn't exist.\n" +
      "  --keep   append instead of wiping existing data first",
  );
  // Explicit --help is a success; a missing identifier is a usage error.
  process.exit(flags.has("--help") ? 0 : 1);
}

/* ----------------------- deterministic randomness --------------------- */

/** mulberry32 — a tiny deterministic PRNG so re-runs produce the same data. */
function makeRng(seedStr: string) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------- dates -------------------------------- */

const DAY_MS = 86_400_000;
const now = new Date();
/** Local `yyyy-MM-dd` for a date `n` days before today. */
function ymd(daysAgo: number): string {
  const d = new Date(now.getTime() - daysAgo * DAY_MS);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** A `Date` at ~10am, `daysAgo` before today — for created_at/updated_at. */
function ts(daysAgo: number): Date {
  return new Date(now.getTime() - daysAgo * DAY_MS - 8 * 3600_000);
}
function isoTs(daysAgo: number): string {
  return ts(daysAgo).toISOString();
}

/* --------------------------- content helpers -------------------------- */

/** Minimal TipTap doc (the app's new journal content format). */
function tiptap(paragraphs: string[]): Record<string, unknown> {
  return {
    type: "doc",
    content: paragraphs.map((text) => ({
      type: "paragraph",
      content: text ? [{ type: "text", text }] : [],
    })),
  };
}
function wordCount(paragraphs: string[]): number {
  return paragraphs.join(" ").trim().split(/\s+/).filter(Boolean).length;
}

/* ------------------------------ resolve ------------------------------- */

/**
 * Resolve the target sub. `--sub` (or a non-email arg) is used verbatim. An
 * email is looked up in the identity profile store on the same cluster —
 * `user_profiles._id` IS the OIDC sub — cross-checked against Meridian's own
 * users so we pick the profile that maps to a real Meridian account. Falls
 * back to using the arg literally if nothing resolves (never blocks).
 */
async function resolveSub(client: MongoClient): Promise<string> {
  const arg = explicitSub ?? identifier!;
  if (explicitSub || !arg.includes("@")) return arg;

  const merSubs = new Set(
    (
      await client
        .db()
        .collection("users")
        .find({}, { projection: { sub: 1 } })
        .toArray()
    ).map((u: any) => u.sub),
  );
  let dbNames: string[];
  try {
    dbNames = (await client.db().admin().listDatabases()).databases.map(
      (d: any) => d.name,
    );
  } catch {
    dbNames = [];
  }
  for (const name of dbNames) {
    if (["admin", "local", "config"].includes(name)) continue;
    let profile: any;
    try {
      profile = await client
        .db(name)
        .collection("user_profiles")
        .findOne({ email: arg });
    } catch {
      continue;
    }
    if (profile && merSubs.has(String(profile._id))) {
      console.log(
        `  resolved ${arg} → sub ${profile._id}  (via ${name}.user_profiles)`,
      );
      return String(profile._id);
    }
  }
  console.log(
    `  ⚠ couldn't map ${arg} to a Meridian account — using it as the sub literally`,
  );
  return arg;
}

/* ------------------------------- data --------------------------------- */

const SEED_COLLECTIONS = [
  "todos",
  "todo_lists",
  "habits",
  "habit_groups",
  "habit_entries",
  "journals",
  "tags",
  "light_events",
  "user_lights",
];

async function seed(db: Db, sub: string) {
  const rng = makeRng(sub);
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)]!;
  const chance = (p: number) => rng() < p;
  const docs: Record<string, unknown[]> = Object.fromEntries(
    SEED_COLLECTIONS.map((c) => [c, []]),
  );
  const base = (daysAgo: number) => ({
    created_at: ts(daysAgo),
    updated_at: ts(daysAgo),
    deleted_at: null,
  });

  /* --- Tags --- */
  const TAGS = [
    ["work", "#3B82F6"],
    ["personal", "#8B5CF6"],
    ["health", "#10B981"],
    ["urgent", "#EF4444"],
    ["ideas", "#F59E0B"],
    ["errands", "#6B7280"],
  ];
  for (const [name, color] of TAGS) {
    docs.tags.push({
      _id: randomUUID(),
      name,
      color,
      userSub: sub,
      ...base(30),
    });
  }

  /* --- Todo lists --- */
  const LISTS = [
    { name: "Inbox", color: "#6B7280", icon: "inbox", is_default: true },
    { name: "Work", color: "#3B82F6", icon: "briefcase", is_default: false },
    { name: "Personal", color: "#8B5CF6", icon: "user", is_default: false },
    { name: "Health", color: "#10B981", icon: "heart", is_default: false },
    { name: "Someday", color: "#F59E0B", icon: "sparkles", is_default: false },
  ];
  const listIds: string[] = [];
  LISTS.forEach((l, i) => {
    const _id = randomUUID();
    listIds.push(_id);
    docs.todo_lists.push({ _id, ...l, order: i, userSub: sub, ...base(30) });
  });

  /* --- Todos --- */
  const TODO_TITLES = [
    "Review the quarterly roadmap",
    "Reply to design feedback",
    "Book dentist appointment",
    "Refactor the auth module",
    "Plan weekend trip",
    "Buy groceries",
    "Write the release notes",
    "Call the bank about the transfer",
    "Prepare demo for Friday",
    "Water the plants",
    "Update dependencies",
    "Draft the blog post",
    "Schedule 1:1s",
    "Fix the flaky test",
    "Renew the domain",
    "Read two chapters",
    "Meal prep for the week",
    "Clear the inbox",
    "Sketch the new landing page",
    "Back up the laptop",
    "Follow up with the client",
    "Order new keyboard",
    "Reconcile the invoices",
    "Stretch for 10 minutes",
  ];
  const PRIORITIES = ["none", "low", "medium", "high"];
  const SUBTASKS = [
    "Outline it",
    "First pass",
    "Review",
    "Ship it",
    "Double-check",
  ];
  for (let i = 0; i < 42; i++) {
    const daysAgo = Math.floor(rng() * 30);
    const done = chance(0.42);
    const listId = pick(listIds);
    const _id = randomUUID();
    const hasSub = chance(0.35);
    const subtaskCount = hasSub ? 2 + Math.floor(rng() * 3) : 0;
    // Due dates spread across overdue / today / upcoming.
    const dueOffset = Math.floor(rng() * 14) - 7; // -7..+6
    const hasDue = chance(0.55);
    docs.todos.push({
      _id,
      title: TODO_TITLES[i % TODO_TITLES.length],
      description: chance(0.25) ? "Added by the dev seed." : null,
      status: done ? "done" : "todo",
      priority: pick(PRIORITIES),
      due_date: hasDue ? ymd(-dueOffset) : null,
      do_date: chance(0.3) ? ymd(Math.floor(rng() * 3)) : null,
      list_id: listId,
      userSub: sub,
      order: i,
      completed_at: done ? isoTs(Math.floor(rng() * daysAgo || 1)) : null,
      subtasks: Array.from({ length: subtaskCount }, (_, s) => ({
        _id: randomUUID(),
        title: SUBTASKS[s % SUBTASKS.length],
        status: done || chance(0.4) ? "done" : "todo",
        priority: "none",
        order: s,
        created_at: isoTs(daysAgo),
        updated_at: isoTs(daysAgo),
      })),
      ...base(daysAgo),
    });
  }

  /* --- Habit groups --- */
  const GROUPS = [
    { name: "Morning", color: "#F59E0B", icon: "sunrise" },
    { name: "Health", color: "#10B981", icon: "heart" },
    { name: "Focus", color: "#3B82F6", icon: "target" },
  ];
  const groupIds: string[] = [];
  GROUPS.forEach((g, i) => {
    const _id = randomUUID();
    groupIds.push(_id);
    docs.habit_groups.push({ _id, ...g, order: i, userSub: sub, ...base(30) });
  });

  /* --- Habits --- */
  // frequency: "daily" | "specific_days" | "weekly_target"
  const HABITS: Array<{
    name: string;
    icon: string;
    color: string;
    frequency: string;
    target_count?: number;
    scheduled_days?: number[];
    weekly_target?: number;
    unit?: string;
    group: number | null;
    archived?: boolean;
  }> = [
    {
      name: "Meditate",
      icon: "🧘",
      color: "#8B5CF6",
      frequency: "daily",
      group: 0,
    },
    {
      name: "Drink water",
      icon: "💧",
      color: "#3B82F6",
      frequency: "daily",
      target_count: 8,
      unit: "glasses",
      group: 1,
    },
    {
      name: "Read",
      icon: "📚",
      color: "#F59E0B",
      frequency: "daily",
      group: 2,
    },
    {
      name: "Exercise",
      icon: "🏃",
      color: "#10B981",
      frequency: "specific_days",
      scheduled_days: [1, 3, 5],
      group: 1,
    },
    {
      name: "Journal",
      icon: "✍️",
      color: "#EF4444",
      frequency: "daily",
      group: 0,
    },
    {
      name: "No phone after 10pm",
      icon: "🌙",
      color: "#6B7280",
      frequency: "daily",
      group: 0,
    },
    {
      name: "Deep work block",
      icon: "🎯",
      color: "#3B82F6",
      frequency: "specific_days",
      scheduled_days: [1, 2, 3, 4, 5],
      group: 2,
    },
    {
      name: "Stretch",
      icon: "🤸",
      color: "#10B981",
      frequency: "daily",
      group: 1,
    },
    {
      name: "Weekly review",
      icon: "📋",
      color: "#8B5CF6",
      frequency: "weekly_target",
      weekly_target: 1,
      group: 2,
    },
    {
      name: "Call a friend",
      icon: "📞",
      color: "#F59E0B",
      frequency: "weekly_target",
      weekly_target: 2,
      group: null,
    },
    {
      name: "Old habit (archived)",
      icon: "📦",
      color: "#6B7280",
      frequency: "daily",
      group: null,
      archived: true,
    },
  ];
  const habitMeta: Array<{ id: string; h: (typeof HABITS)[number] }> = [];
  HABITS.forEach((h, i) => {
    const _id = randomUUID();
    habitMeta.push({ id: _id, h });
    docs.habits.push({
      _id,
      name: h.name,
      description: null,
      frequency: h.frequency,
      target_count: h.target_count ?? 1,
      scheduled_days: h.scheduled_days,
      weekly_target: h.weekly_target,
      unit: h.unit ?? null,
      color: h.color,
      icon: h.icon,
      userSub: sub,
      group_id: h.group != null ? groupIds[h.group] : null,
      order: i,
      archived_at: h.archived ? ts(20) : null,
      ...base(30),
    });
  });

  /* --- Habit entries (last 30 days, realistic streaks) --- */
  let habitCheckins = 0;
  for (const { id, h } of habitMeta) {
    if (h.archived || h.frequency === "weekly_target") {
      // Quota habits get a couple of check-ins per week, not daily. Days within
      // a week must be DISTINCT — the {userSub, habit_id, date} index is unique,
      // so two hits landing on the same day would fail the insert. `k*3` spaces
      // them out (k=0 → 0–1, k=1 → 3–4) so they never collide.
      for (let d = 0; d < 28; d += 7) {
        const hits = h.weekly_target ?? 1;
        for (let k = 0; k < hits && chance(0.7); k++) {
          const day = d + k * 3 + Math.floor(rng() * 2);
          docs.habit_entries.push({
            _id: randomUUID(),
            habit_id: id,
            date: ymd(day),
            value: 1,
            type: "completion",
            userSub: sub,
            target_count_snapshot: h.target_count ?? 1,
            scheduled_days_snapshot: h.scheduled_days ?? null,
            ...base(day),
          });
          habitCheckins++;
        }
      }
      continue;
    }
    for (let d = 0; d < 30; d++) {
      const scheduled =
        h.frequency !== "specific_days" ||
        (h.scheduled_days ?? []).includes(
          new Date(now.getTime() - d * DAY_MS).getDay(),
        );
      if (!scheduled) continue;
      const roll = rng();
      if (roll < 0.72) {
        // completed (near-target value)
        docs.habit_entries.push({
          _id: randomUUID(),
          habit_id: id,
          date: ymd(d),
          value: h.target_count ?? 1,
          type: "completion",
          userSub: sub,
          target_count_snapshot: h.target_count ?? 1,
          scheduled_days_snapshot: h.scheduled_days ?? null,
          ...base(d),
        });
        habitCheckins++;
      } else if (roll < 0.8) {
        // explicit skip
        docs.habit_entries.push({
          _id: randomUUID(),
          habit_id: id,
          date: ymd(d),
          value: 0,
          type: "skip",
          skip_reason: "Rest day",
          userSub: sub,
          target_count_snapshot: h.target_count ?? 1,
          scheduled_days_snapshot: h.scheduled_days ?? null,
          ...base(d),
        });
      } // else: missed (no entry)
    }
  }

  /* --- Journals (last 45 days, plaintext TipTap) --- */
  const JOURNAL_SEEDS: Array<{
    title: string;
    paras: string[];
    mood: number;
    tags: string[];
  }> = [
    {
      title: "A good start",
      paras: [
        "Woke up early and actually stuck to the morning routine.",
        "Small wins compound. Feeling optimistic about the week.",
      ],
      mood: 5,
      tags: ["personal"],
    },
    {
      title: "Slow afternoon",
      paras: [
        "Focus was hard to find today. Took a walk to reset.",
        "Shipped the fix eventually — persistence over motivation.",
      ],
      mood: 3,
      tags: ["work"],
    },
    {
      title: "Grateful",
      paras: [
        "Long call with an old friend. Laughed a lot.",
        "Reminded me to keep those connections warm.",
      ],
      mood: 5,
      tags: ["personal", "health"],
    },
    {
      title: "Reset day",
      paras: [
        "Cleared the backlog and inbox to zero.",
        "A tidy desk really does quiet the mind.",
      ],
      mood: 4,
      tags: ["work"],
    },
    {
      title: "Tired but proud",
      paras: [
        "Hard workout, then a productive deep-work block.",
        "Earned the rest tonight.",
      ],
      mood: 4,
      tags: ["health"],
    },
    {
      title: "Rough one",
      paras: ["Everything felt uphill. Kept the streak alive anyway."],
      mood: 2,
      tags: ["personal"],
    },
    {
      title: "Ideas flowing",
      paras: [
        "Sketched three concepts for the landing page.",
        "Sometimes the best work happens away from the keyboard.",
      ],
      mood: 5,
      tags: ["ideas", "work"],
    },
    {
      title: "Quiet evening",
      paras: [
        "Read two chapters and went to bed early.",
        "Protecting sleep is protecting tomorrow.",
      ],
      mood: 4,
      tags: ["health"],
    },
  ];
  let journalCount = 0;
  for (let d = 0; d < 45; d++) {
    if (!chance(d < 14 ? 0.75 : 0.45)) continue; // denser recently
    const j = JOURNAL_SEEDS[journalCount % JOURNAL_SEEDS.length]!;
    docs.journals.push({
      _id: randomUUID(),
      title: j.title,
      content: tiptap(j.paras),
      mood: j.mood,
      tags: j.tags,
      userSub: sub,
      date: ymd(d),
      word_count: wordCount(j.paras),
      encrypted: false,
      ...base(d),
    });
    journalCount++;
  }

  /* --- Light events + user_lights aggregate --- */
  // Derive a believable stream of light from the activity above, newest→oldest.
  const doneTodos = docs.todos.filter((t: any) => t.status === "done");
  let total = 0;
  const addEvent = (
    action: string,
    base_light: number,
    date: string,
    daysAgo: number,
  ) => {
    const multiplier = 1 + Math.round(rng() * 5) / 10; // 1.0–1.5
    const total_light = Math.round(base_light * multiplier);
    total += total_light;
    docs.light_events.push({
      _id: randomUUID(),
      userSub: sub,
      action,
      base_light,
      multiplier,
      total_light,
      date,
      metadata: null,
      ...base(daysAgo),
    });
  };
  for (const t of doneTodos) {
    const daysAgo = Math.floor(rng() * 30);
    addEvent("todo_complete", 3 + Math.floor(rng() * 3), ymd(daysAgo), daysAgo);
  }
  for (const e of docs.habit_entries as any[]) {
    if (e.type !== "completion") continue;
    if (chance(0.5)) continue; // sample, keep the feed reasonable
    const daysAgo = Math.max(
      0,
      Math.round(
        (now.getTime() - new Date(e.date + "T12:00:00").getTime()) / DAY_MS,
      ),
    );
    addEvent("habit_checkin", 4, e.date, daysAgo);
  }
  for (const j of docs.journals as any[]) {
    const daysAgo = Math.max(
      0,
      Math.round(
        (now.getTime() - new Date(j.date + "T12:00:00").getTime()) / DAY_MS,
      ),
    );
    addEvent("journal_entry", 6, j.date, daysAgo);
  }
  // A handful of perfect-day bonuses on recent days to seed streaks.
  const perfectStreak = 5;
  for (let d = 0; d < perfectStreak; d++)
    addEvent("perfect_day", 10, ymd(d), d);

  const tier = getTierForLight(total);
  docs.user_lights.push({
    _id: randomUUID(),
    userSub: sub,
    total_light: total,
    current_tier: tier.tier,
    current_title: tier.title,
    perfect_day_streak: perfectStreak,
    todo_ring_streak: 6,
    habit_ring_streak: 9,
    journal_ring_streak: 4,
    last_active_date: ymd(0),
    last_finalized_date: ymd(1),
    finalized_streaks: null,
    longest_perfect_streak: 12,
    perfect_days_total: 18,
    todo_target_daily: 3,
    journal_target_daily_words: 75,
    ...base(0),
  });

  /* --- Insert everything --- */
  for (const c of SEED_COLLECTIONS) {
    if (docs[c]!.length) await db.collection(c).insertMany(docs[c]! as any[]);
  }

  // Ensure the user row exists + skip the onboarding wizard. $setOnInsert gives
  // a new row the String _id the schema expects (a raw upsert would otherwise
  // let Mongo assign an ObjectId, which the API's string-_id reads reject).
  await db.collection("users").updateOne(
    { sub },
    {
      $set: { has_completed_onboarding: true, updated_at: new Date() },
      $setOnInsert: { _id: randomUUID(), created_at: new Date() },
    },
    { upsert: true },
  );

  return {
    tags: docs.tags.length,
    lists: docs.todo_lists.length,
    todos: docs.todos.length,
    habitGroups: docs.habit_groups.length,
    habits: docs.habits.length,
    habitEntries: docs.habit_entries.length,
    journals: journalCount,
    lightEvents: docs.light_events.length,
    totalLight: total,
    tier: `${tier.tier} · ${tier.title}`,
    habitCheckins,
  };
}

/* ------------------------------- main --------------------------------- */

async function main() {
  loadEnv();
  if (!process.env.MONGODB_URI) {
    console.error("✗ MONGODB_URI is not set (looked in apps/api/.env).");
    process.exit(1);
  }

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(); // db name comes from the URI

  try {
    const sub = await resolveSub(client);
    const existed = await db
      .collection("users")
      .countDocuments({ sub }, { limit: 1 });
    console.log(`\n▶ Seeding ${existed ? "existing" : "new"} user  sub=${sub}`);

    if (!flags.has("--keep")) {
      let cleared = 0;
      for (const c of SEED_COLLECTIONS) {
        const r = await db.collection(c).deleteMany({ userSub: sub });
        cleared += r.deletedCount ?? 0;
      }
      console.log(`  cleared ${cleared} existing docs`);
    }

    const s = await seed(db, sub);
    console.log(
      `  ✓ ${s.lists} lists · ${s.todos} todos · ${s.tags} tags\n` +
        `  ✓ ${s.habitGroups} habit groups · ${s.habits} habits · ${s.habitEntries} entries (${s.habitCheckins} check-ins)\n` +
        `  ✓ ${s.journals} journals\n` +
        `  ✓ ${s.lightEvents} light events · ${s.totalLight} Light → tier ${s.tier}\n` +
        `  ✓ onboarding marked complete\n\n` +
        `Done. Log in as this user to see the data.`,
    );
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("\n✗ Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
