// src/activity-rings/ring-colors.native.ts — NATIVE resolution of the
// category colors.
//
// Platform-split sibling of `ring-colors.ts` (web). react-native-svg can't
// parse CSS `var(...)`, so native gets resolved hex/rgba. Values mirror the
// mobile IGNITION palette (`apps/mobile/lib/ignition-palette.ts`) — the
// canonical flame anatomy: yellow outer (journal) → orange body (habit) →
// red core (todo). Keep the two in sync when the palette changes.
//
// Keep the two files' SHAPE identical — same keys, same `RingColorMap`
// contract — so every consumer is platform-agnostic.

/**
 * Per-category ring colors (stroke `color` + `track` background). Plain
 * `string` values so caller palettes satisfy the same type.
 */
export interface RingColorMap {
  todo: { color: string; track: string };
  habit: { color: string; track: string };
  journal: { color: string; track: string };
}

/**
 * Meridian's standard category colors, resolved for react-native-svg.
 *   todo = red · habit = orange · journal = yellow
 */
export const RING_CATEGORY: RingColorMap = {
  todo: { color: "#ef4444", track: "rgba(239, 68, 68, 0.16)" },
  habit: { color: "#f97316", track: "rgba(249, 115, 22, 0.16)" },
  journal: { color: "#facc15", track: "rgba(250, 204, 21, 0.16)" },
};
