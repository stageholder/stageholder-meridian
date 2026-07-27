// Shared prop types for the native-only QuickAddHabitSheet (`.native.tsx` real
// impl + `.tsx` web stub). One definition referenced by both variants + the
// barrel's `export type` (mirrors smart-todo-input.types.ts).
import type { HabitFormValues, HabitFormGroupOption } from "./habit-form";

export interface QuickAddHabitSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups?: HabitFormGroupOption[];
  defaultGroupId?: string | null;
  /** Category accent (habit color) — resolved hex on native. */
  accentColor: string;
  isSubmitting?: boolean;
  onSubmit: (values: HabitFormValues) => void | Promise<void>;
}
