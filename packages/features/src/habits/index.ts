// Barrel for the `habits` domain — presentational habit views. The host
// (PWA today, mobile later) hooks the data layer (entries + mutations) and
// supplies the action callbacks; the view owns its own animation timing
// and the embedded delete-confirm dialog.

export { HabitCard, type HabitCardProps } from "./habit-card";
export {
  HabitForm,
  HABIT_FORM_DEFAULTS,
  type HabitFormProps,
  type HabitFormValues,
} from "./habit-form";
