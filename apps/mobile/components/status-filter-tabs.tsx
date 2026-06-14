// apps/mobile/components/status-filter-tabs.tsx
//
// Shared "All / To do / Done" status filter, rendered as horizontal underline
// tabs with a leading icon per tab — the same presentation Settings uses for
// its Profile/Targets/Account sections (kit Tabs variant="underline").
//
// Uses the kit Tabs API as designed: the icon goes through the `icon` PROP
// (the kit auto-tints it to the active/inactive state + sizes it to the tab
// density) and the LABEL is a plain string child (wrapped in the kit's
// state-colored TabLabel with numberOfLines=1). Passing a composed
// non-string child instead makes the kit wrap it with lineHeight=0 → the
// label collapses to invisible, and putting `flex`/`width` on Tabs.Tab lands
// on the inner frame, not the layout wrapper (kit's documented limitation) —
// both were the cause of the earlier text-less, oddly-spaced strip.
//
// Controlled: drives the habits + todos screens' status filter state.

import { Tabs } from "@stageholder/ui";
import { Circle, CircleCheck, LayoutList } from "@tamagui/lucide-icons-2";

/** "all" shows everything; "todo"/"done" filter by completion state. */
export type StatusFilter = "all" | "todo" | "done";

const TABS = [
  { id: "all", label: "All", icon: <LayoutList /> },
  { id: "todo", label: "To do", icon: <Circle /> },
  { id: "done", label: "Done", icon: <CircleCheck /> },
] as const;

interface StatusFilterTabsProps {
  value: StatusFilter;
  onValueChange: (value: StatusFilter) => void;
}

export function StatusFilterTabs({
  value,
  onValueChange,
}: StatusFilterTabsProps) {
  return (
    <Tabs
      value={value}
      onValueChange={(v) => onValueChange(v as StatusFilter)}
      orientation="horizontal"
      variant="underline"
    >
      <Tabs.List width="100%" gap="$2">
        {TABS.map((tab) => (
          <Tabs.Tab key={tab.id} value={tab.id} icon={tab.icon}>
            {tab.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Tabs>
  );
}
