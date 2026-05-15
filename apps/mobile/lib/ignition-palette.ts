// apps/mobile/lib/ignition-palette.ts
//
// The ignition palette — Meridian's canonical color identity for the three
// daily surfaces, modeled on the physical anatomy of a flame:
//
//   yellow  (outer flame)  →  JOURNAL  →  outermost ring
//   orange  (flame body)   →  HABITS   →  middle ring
//   red     (hot core)     →  TODOS    →  innermost ring
//
// The ordering and color choice aren't arbitrary — they are the cross-
// section of a real flame, from cool outer to hot core. When the rings
// stack outer-to-inner [journal, habit, todo], the activity card reads as
// a literal flame.
//
// Import from here anywhere the three categories appear together
// (ActivityRings, WeeklyActivityChart, badges, chips, charts). Don't pick
// category colors inline.

export const IGNITION = {
  journal: {
    base: "#facc15", // yellow-400 — outer flame
    track: "rgba(250, 204, 21, 0.16)",
    glow: "rgba(250, 204, 21, 0.45)",
    label: "Journal",
  },
  habit: {
    base: "#f97316", // orange-500 — flame body
    track: "rgba(249, 115, 22, 0.16)",
    glow: "rgba(249, 115, 22, 0.45)",
    label: "Habits",
  },
  todo: {
    base: "#ef4444", // red-500 — hot core
    track: "rgba(239, 68, 68, 0.16)",
    glow: "rgba(239, 68, 68, 0.45)",
    label: "Todos",
  },
} as const;

export type IgnitionKey = keyof typeof IGNITION;

// Ordered outer-to-inner — index 0 is the outermost ring. This matches the
// array convention of @stageholder/ui's <ActivityRings>, where rings[0] is
// the largest diameter.
export const IGNITION_ORDER: readonly IgnitionKey[] = [
  "journal",
  "habit",
  "todo",
];
