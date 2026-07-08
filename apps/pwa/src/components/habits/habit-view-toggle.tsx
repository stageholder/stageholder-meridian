import { LayoutGrid, List as ListIcon } from "lucide-react";
import { View, XStack } from "@stageholder/ui";
import type { HabitViewMode } from "./habit-group-section";

interface HabitViewToggleProps {
  value: HabitViewMode;
  onChange: (mode: HabitViewMode) => void;
}

// Single source of truth for the habits card/list view switcher — previously
// duplicated as a hand-rolled control on /habits AND the kit `SegmentedControl`
// (bright primary-blue selected fill) on the group route, so the two pages read
// differently. This is the on-brand version: a bordered track, the active cell
// carrying a soft `$muted` fill with its icon in the habit accent (orange),
// inactive icons muted-grey — Linear/Notion-style and consistent everywhere.
const MODES = [
  { mode: "card", Icon: LayoutGrid, label: "Card view" },
  { mode: "list", Icon: ListIcon, label: "List view" },
] as const;

export function HabitViewToggle({ value, onChange }: HabitViewToggleProps) {
  return (
    <XStack
      items="center"
      gap={2}
      p={2}
      rounded="$3"
      borderWidth={1}
      borderColor="$borderColor"
    >
      {MODES.map(({ mode, Icon, label }) => {
        const active = value === mode;
        return (
          <View
            key={mode}
            onPress={() => onChange(mode)}
            cursor="pointer"
            items="center"
            justify="center"
            width={32}
            height={26}
            rounded="$2"
            transition="quick"
            bg={(active ? "$muted" : "transparent") as never}
            hoverStyle={active ? {} : ({ bg: "$muted" } as never)}
            role="button"
            aria-label={label}
          >
            <Icon
              size={15}
              color={active ? "var(--ring-habit)" : "var(--muted-foreground)"}
              style={{ display: "block" }}
            />
          </View>
        );
      })}
    </XStack>
  );
}
