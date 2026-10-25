import type { MoreAction } from "../_internal/more-actions.types";
import type { Habit } from "@repo/core/types";
import type { HabitFormGroupOption } from "./habit-form";

/**
 * A per-field patch the habit detail sheet emits the moment a field is
 * committed (name/notes on blur, return or a debounce; pills on pick).
 * `scheduledDays: null` clears a weekday schedule; `groupId: null` ungroups.
 */
export interface HabitDetailPatch {
  name?: string;
  description?: string;
  icon?: string;
  frequency?: Habit["frequency"];
  scheduledDays?: number[] | null;
  weeklyTarget?: number;
  targetCount?: number;
  unit?: string;
  color?: string;
  groupId?: string | null;
}

export interface HabitDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The habit on screen. Hosts keep the last one through the close slide. */
  habit: Habit | null;
  /** Groups for the Group pill; hidden when empty. */
  groups?: HabitFormGroupOption[];
  /** One field changed — commit it (optimistic PATCH in the host). */
  onPatch: (patch: HabitDetailPatch) => void;
  /** The "⋯" button — the host opens its native action sheet. */
  /** Rows of the "⋯" menu (an in-app sheet nested in the detail sheet). */
  moreActions: MoreAction[];
}
