// Barrel for the `activity-rings` domain — the per-day ring visual plus
// its supporting config (data shapes, category colors, kit-rings mapping).
// Hooks that compute the per-day percentages live per-app (PWA:
// `apps/pwa/src/lib/hooks/use-activity-rings.ts`); the data types here
// constrain both apps to a consistent shape.

export {
  ActivityRings,
  ActivityRingsBreakdown,
  type ActivityRingsProps,
  type ActivityRingsBreakdownProps,
  type ActivityRingsColors,
  type ActivityRingsSize,
} from "./activity-rings";

export {
  RING_CATEGORY,
  activityRingsConfig,
  type ActivityRingsData,
  type ActivityRingsDetails,
} from "./config";
