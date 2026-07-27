// Web stub for the native-only QuickAddHabitSheet. The compact quick-add is a
// native mobile interaction; the PWA uses its own create-habit dialog with the
// full `HabitForm`, so this variant is never rendered on web. It exists only so
// the shared `habits` barrel resolves on the web bundler.
import type { QuickAddHabitSheetProps } from "./quick-add-habit-sheet.types";

export function QuickAddHabitSheet(_props: QuickAddHabitSheetProps): null {
  return null;
}
