// apps/mobile/components/status-filter-tabs.tsx
//
// Shared "All / To do / Done" status filter for the habits + todos screens.
// Rendered as the kit SegmentedControl, whose native build is the PLATFORM
// segmented control (UISegmentedControl / Material segmented buttons via
// @expo/ui) — the system idiom for filtering one list. It replaced web-style
// underline tabs with icons, which read like page navigation on a phone.
//
// Items must stay plain string children: that's what lets the kit hand them
// to the native control (an icon/count falls back to the Tamagui build).

import { SegmentedControl } from "@stageholder/ui";

/** "all" shows everything; "todo"/"done" filter by completion state. */
export type StatusFilter = "all" | "todo" | "done";

interface StatusFilterTabsProps {
  value: StatusFilter;
  onValueChange: (value: StatusFilter) => void;
}

export function StatusFilterTabs({
  value,
  onValueChange,
}: StatusFilterTabsProps) {
  return (
    <SegmentedControl
      value={value}
      onValueChange={(v) => onValueChange(v as StatusFilter)}
    >
      <SegmentedControl.Item value="all">All</SegmentedControl.Item>
      <SegmentedControl.Item value="todo">To do</SegmentedControl.Item>
      <SegmentedControl.Item value="done">Done</SegmentedControl.Item>
    </SegmentedControl>
  );
}
