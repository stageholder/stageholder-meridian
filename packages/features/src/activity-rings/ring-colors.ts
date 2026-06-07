// src/activity-rings/ring-colors.ts — WEB resolution of the category colors.
//
// Platform-split module: Metro resolves the `ring-colors.native.ts` sibling
// on React Native (resolved hex/rgba — react-native-svg can't parse CSS
// `var(...)`); Vite resolves this file on web, where the CSS custom
// properties from `apps/pwa/src/globals.css` give us theme-aware (light/
// dark) colors for free.
//
// Keep the two files' SHAPE identical — same keys, same `RingColorMap`
// contract — so every consumer is platform-agnostic.

/**
 * Per-category ring colors (stroke `color` + `track` background). Plain
 * `string` values (not CSS-var literal types) so resolved hex/rgba — the
 * native default, or an explicit caller palette — satisfies the same type.
 */
export interface RingColorMap {
  todo: { color: string; track: string };
  habit: { color: string; track: string };
  journal: { color: string; track: string };
}

/**
 * Meridian's standard category colors — theme-aware CSS vars on web,
 * shared by the calendar rings, the day panel, and the daily-target
 * header rings. Passed straight to the kit `<ActivityRings>` as raw SVG
 * stroke colors.
 *   todo = red · habit = orange · journal = yellow
 */
export const RING_CATEGORY: RingColorMap = {
  todo: { color: "var(--ring-todo)", track: "var(--ring-todo-track)" },
  habit: { color: "var(--ring-habit)", track: "var(--ring-habit-track)" },
  journal: { color: "var(--ring-journal)", track: "var(--ring-journal-track)" },
};
