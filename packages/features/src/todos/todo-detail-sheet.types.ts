import type { MoreAction } from "../_internal/more-actions.types";
import type { ReactNode } from "react";
import type { Todo } from "@repo/core/types";
import type { TodoListChoice } from "./todo-form";

/**
 * A per-field patch the detail sheet emits the moment a field is committed
 * (title/notes on blur or return, pills on pick). `null` CLEARS a date or the
 * notes — the host forwards it as-is so the API persists the clear.
 */
export interface TodoDetailPatch {
  title?: string;
  description?: string | null;
  priority?: Todo["priority"];
  /** `yyyy-MM-dd` or null to clear. */
  doDate?: string | null;
  /** `yyyy-MM-dd` or null to clear. */
  dueDate?: string | null;
  listId?: string;
}

export interface TodoDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The todo on screen. Hosts keep the last one through the close slide. */
  todo: Todo | null;
  /** Lists for the List pill; hidden when ≤ 1 (single-list users). */
  lists?: TodoListChoice[];
  /** Todo category accent — resolved hex on native. */
  accentColor: string;
  /** One field changed — commit it (optimistic PATCH in the host). */
  onPatch: (patch: TodoDetailPatch) => void;
  /** The status circle was tapped (done ↔ todo). */
  onToggleStatus: () => void;
  /** The "⋯" button — the host opens its native action sheet (Delete…). */
  /** Rows of the "⋯" menu (an in-app sheet nested in the detail sheet). */
  moreActions: MoreAction[];
  /** Instant-commit subtasks block (host-owned data wiring). */
  subtasks?: ReactNode;
}
