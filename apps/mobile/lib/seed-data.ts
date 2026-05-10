// apps/mobile/lib/seed-data.ts
//
// One-time seed used on a fresh install so the user sees something real
// instead of empty states. Once Zustand persists the user's own data,
// these arrays are ignored — the persisted snapshot wins.

import { dateKey, type Habit, type JournalEntry, type Todo } from "@/lib/types";

const today = dateKey();
const yKey = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return dateKey(d);
};

const nowISO = new Date().toISOString();
const isoDaysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

export const SEED_TODOS: Todo[] = [
  {
    id: "seed_t1",
    title: "Reply to Aurora",
    priority: "high",
    dueDate: today,
    createdAt: isoDaysAgo(1),
  },
  {
    id: "seed_t2",
    title: "Pick up groceries",
    priority: "normal",
    dueDate: today,
    createdAt: isoDaysAgo(0),
  },
  {
    id: "seed_t3",
    title: "Plan Q2 retro agenda",
    priority: "normal",
    dueDate: yKey(2),
    createdAt: isoDaysAgo(2),
  },
  {
    id: "seed_t4",
    title: "Cancel old subscription",
    priority: "low",
    dueDate: yKey(5),
    createdAt: isoDaysAgo(3),
  },
  {
    id: "seed_t5",
    title: "Daily walk",
    priority: "normal",
    completedAt: nowISO,
    createdAt: isoDaysAgo(0),
  },
];

/**
 * Builds a deterministic recent check-in pattern for a habit so the streak
 * math has something to chew on out of the box. Default: ~70% of recent
 * days marked done.
 */
function seedCheckIns(daysBack = 30, density = 0.7): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (let i = 0; i < daysBack; i++) {
    // Deterministic-ish — same offset always produces the same value.
    if ((i * 13 + 7) % 100 < density * 100) {
      out[yKey(-i)] = true;
    }
  }
  return out;
}

export const SEED_HABITS: Habit[] = [
  {
    id: "seed_h1",
    title: "Morning meditation",
    color: "#a855f7",
    scheduledDays: [],
    checkIns: seedCheckIns(30, 0.85),
    createdAt: isoDaysAgo(45),
  },
  {
    id: "seed_h2",
    title: "Read 30 minutes",
    color: "#3b82f6",
    scheduledDays: [],
    checkIns: seedCheckIns(30, 0.6),
    createdAt: isoDaysAgo(20),
  },
  {
    id: "seed_h3",
    title: "Walk 8000 steps",
    color: "#22c55e",
    scheduledDays: [],
    checkIns: seedCheckIns(30, 0.75),
    createdAt: isoDaysAgo(60),
  },
];

export const SEED_JOURNAL: JournalEntry[] = [
  {
    id: "seed_j1",
    dateKey: yKey(-1),
    body:
      "Good cycle today — finished the writeup, ran in the morning, " +
      "kept off the phone after dinner. Felt the difference.",
    mood: 4,
    tags: ["focus", "movement"],
    createdAt: isoDaysAgo(1),
    updatedAt: isoDaysAgo(1),
  },
  {
    id: "seed_j2",
    dateKey: yKey(-3),
    body: "Slow start. Breath work helped settle the noise around 11am.",
    mood: 3,
    tags: ["calm"],
    createdAt: isoDaysAgo(3),
    updatedAt: isoDaysAgo(3),
  },
];
