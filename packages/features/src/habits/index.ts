// Barrel for the `habits` domain — presentational habit views. The host
// (PWA today, mobile later) hooks the data layer (entries + mutations) and
// supplies the action callbacks; the view owns its own animation timing
// and the embedded delete-confirm dialog.

export { HabitCard, type HabitCardProps } from "./habit-card";
export { RadianceBurst } from "./radiance-burst";
export {
  HabitCheckInRow,
  type HabitCheckInRowProps,
} from "./habit-check-in-row";
export {
  HabitForm,
  HABIT_FORM_DEFAULTS,
  type HabitFormProps,
  type HabitFormValues,
} from "./habit-form";
export * from "./habit-group-form";
export { encodeMediaIcon, parseMediaIcon } from "./icon-value";

// Compact Todoist-style quick-add create sheet — native-only behavior; the web
// build resolves the null stub (`.tsx`), RN resolves `.native.tsx`.
export { QuickAddHabitSheet } from "./quick-add-habit-sheet";
export type { QuickAddHabitSheetProps } from "./quick-add-habit-sheet.types";
