// Web stub for the native-only QuickAddTodoSheet. The compact Todoist-style
// quick-add is a native mobile interaction; the PWA uses its own create-todo
// dialog with the full `TodoForm`, so this variant is never rendered on web.
// It exists only so the shared `todos` barrel resolves on the web bundler.
import type { QuickAddTodoSheetProps } from "./quick-add-todo-sheet.types";

export function QuickAddTodoSheet(_props: QuickAddTodoSheetProps): null {
  return null;
}
