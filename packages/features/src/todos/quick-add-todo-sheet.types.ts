// Shared prop types for the native-only QuickAddTodoSheet (`.native.tsx` real
// impl + `.tsx` web stub). Kept in its own module so both variants — and the
// barrel's `export type` — reference one definition (mirrors
// smart-todo-input.types.ts).
import type { TodoFormValues, TodoListChoice } from "./todo-form";

export interface QuickAddTodoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lists?: TodoListChoice[];
  /**
   * Seed the DEADLINE (due date) — `yyyy-MM-dd`. Used by the calendar's "Add
   * Todo" so a todo created from a tapped day is DUE that day (PWA parity).
   * The do-date defaults to today via `makeTodoFormDefaults`.
   */
  defaultDueDate?: string;
  /** Category accent (todo color) — resolved hex on native. */
  accentColor: string;
  isSubmitting?: boolean;
  onSubmit: (values: TodoFormValues) => void | Promise<void>;
}
