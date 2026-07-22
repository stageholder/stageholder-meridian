// apps/mobile/components/habit-day-controls.tsx
//
// The habits-screen header controls — native mirrors of the PWA's
// HabitViewToggle + HabitDateNav (apps/pwa/src/components/habits/). Kept in one
// file since both are small and only used together on the habits screen.
//
//   HabitViewToggle — card ⇄ list segmented control (grid / rows).
//   HabitDateNav    — ‹ prev · smart day label · next › for reviewing / checking
//                     in on a past day. The next arrow stops at today (no future
//                     check-ins); arbitrary jumps are done from the Calendar
//                     screen (mobile has no inline calendar popover).

import { IconButton, Text, View, XStack } from "@stageholder/ui";
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
} from "@tamagui/lucide-icons-2";
import { addDays, format } from "date-fns";

export type HabitViewMode = "card" | "list";

export function HabitViewToggle({
  value,
  onChange,
}: {
  value: HabitViewMode;
  onChange: (value: HabitViewMode) => void;
}) {
  return (
    <XStack
      rounded="$4"
      borderWidth={1}
      borderColor="$borderColor"
      bg="$muted"
      p="$0.5"
      gap="$0.5"
    >
      {(["card", "list"] as const).map((mode) => {
        const selected = value === mode;
        const Icon = mode === "card" ? LayoutGrid : List;
        return (
          <View
            key={mode}
            onPress={() => onChange(mode)}
            rounded="$3"
            px="$2.5"
            py="$1.5"
            bg={selected ? "$background" : "transparent"}
            pressStyle={{ opacity: 0.7 }}
            aria-label={mode === "card" ? "Card view" : "List view"}
          >
            <Icon
              size={16}
              color={selected ? "$color" : ("$mutedForeground" as never)}
            />
          </View>
        );
      })}
    </XStack>
  );
}

/** Parse a yyyy-mm-dd key as a LOCAL date (no UTC shift). */
function parseLocal(key: string): Date {
  return new Date(key + "T00:00:00");
}

/** "Today" / "Yesterday" / "Wed, Mar 12" for the nav pill. */
function smartLabel(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return "Today";
  const yesterday = format(addDays(parseLocal(todayKey), -1), "yyyy-MM-dd");
  if (dateKey === yesterday) return "Yesterday";
  return format(parseLocal(dateKey), "EEE, MMM d");
}

export function HabitDateNav({
  value,
  today,
  onChange,
}: {
  /** Current day (yyyy-mm-dd). */
  value: string;
  /** Real today (yyyy-mm-dd) — the future bound. */
  today: string;
  onChange: (next: string) => void;
}) {
  const atToday = value >= today;
  const shift = (days: number) =>
    onChange(format(addDays(parseLocal(value), days), "yyyy-MM-dd"));

  return (
    <XStack items="center" gap="$1">
      <IconButton
        variant="ghost"
        size="sm"
        aria-label="Previous day"
        onPress={() => shift(-1)}
      >
        <ChevronLeft size={18} />
      </IconButton>
      <Text
        fontSize="$2"
        fontWeight="600"
        color="$color"
        minW={92}
        text="center"
      >
        {smartLabel(value, today)}
      </Text>
      <IconButton
        variant="ghost"
        size="sm"
        aria-label="Next day"
        disabled={atToday}
        onPress={() => shift(1)}
      >
        <ChevronRight size={18} />
      </IconButton>
    </XStack>
  );
}
