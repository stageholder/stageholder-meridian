import type { ReactNode } from "react";

/** One row of a detail sheet's "⋯" menu (see more-actions-sheet.native). */
export interface MoreAction {
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  onPress: () => void;
}
