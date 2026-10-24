// packages/features/src/_internal/month-grid.native.tsx  (NATIVE)
//
// A single-month calendar grid for the app's date sheets — app-owned, built
// from Tamagui views only.
//
// Why not the kit `Calendar` here: its header controls (month arrows, Today,
// the month/year dropdown) are the kit's React Native `Pressable`, which gets
// no touches inside a nested Tamagui sheet on native (the same class of bug
// that made the composer's send button a Tamagui view). The day cells use the
// gesture-handler pressable and work, so the user could pick a day but never
// change the month. Every tappable here is a Tamagui `XStack`/`View` with
// `onPress`, the pattern `PillPickerSheet` proves inside these sheets.
//
// Layout: a header row (‹ Month Year ▾ ›  Today), a weekday row, six rows of
// seven cells. Tapping the title swaps the grid for a month/year chooser
// (‹ year › + a 3×4 month grid) so a far date is two taps, not twelve.

import { useState } from "react";
import {
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronDown } from "@tamagui/lucide-icons-2/icons/ChevronDown";
import { ChevronLeft } from "@tamagui/lucide-icons-2/icons/ChevronLeft";
import { ChevronRight } from "@tamagui/lucide-icons-2/icons/ChevronRight";
import { ChevronUp } from "@tamagui/lucide-icons-2/icons/ChevronUp";
import { Text, View, XStack, YStack } from "@stageholder/ui";

const ROW = 44;
const WEEKDAYS_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export interface MonthGridProps {
  value: Date | null;
  /** Month shown first; defaults to the value's month, else this month. */
  initialMonth?: Date;
  onChange: (date: Date) => void;
}

export function MonthGrid({ value, initialMonth, onChange }: MonthGridProps) {
  const today = startOfDay(new Date());
  const [viewMonth, setViewMonth] = useState(() =>
    startOfMonth(initialMonth ?? value ?? today),
  );
  const [chooser, setChooser] = useState(false);
  const [chooserYear, setChooserYear] = useState(viewMonth.getFullYear());

  const shift = (n: number) => setViewMonth((m) => addMonths(m, n));
  const openChooser = () => {
    setChooserYear(viewMonth.getFullYear());
    setChooser(true);
  };
  const pickMonth = (monthIdx: number) => {
    setViewMonth(new Date(chooserYear, monthIdx, 1));
    setChooser(false);
  };

  // Up to six rows; a trailing row with no day of this month is dropped.
  const gridStart = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 });
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push(
      new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + i,
      ),
    );
  }
  const rows = [0, 1, 2, 3, 4, 5].map((r) => cells.slice(r * 7, r * 7 + 7));
  // Trailing all-out-of-month row is dropped (keeps 5 rows most months).
  const lastRowNeeded = rows[5]!.some((d) => isSameMonth(d, viewMonth));
  const visibleRows = lastRowNeeded ? rows : rows.slice(0, 5);

  return (
    <YStack gap="$2">
      {/* Header: title (opens the chooser) · Today · ‹ › */}
      <XStack items="center" justify="space-between" gap="$2">
        {/* The title is a control: soft pill + a real chevron so it reads as
            tappable (a bare "▾" glyph was too small to register as one). */}
        <XStack
          role="button"
          aria-label="Choose month and year"
          items="center"
          gap="$1.5"
          pl="$2.5"
          pr="$2"
          py="$1.5"
          rounded="$3"
          bg="$secondary"
          pressStyle={{ opacity: 0.7 }}
          onPress={() => (chooser ? setChooser(false) : openChooser())}
        >
          <Text fontSize="$5" fontWeight="600" color="$color">
            {chooser ? "Pick a month" : format(viewMonth, "MMMM yyyy")}
          </Text>
          {chooser ? (
            <ChevronUp size={18} color="$primary" />
          ) : (
            <ChevronDown size={18} color="$primary" />
          )}
        </XStack>
        {!chooser ? (
          <XStack items="center" gap="$1">
            <HeaderButton
              label="Today"
              onPress={() => setViewMonth(startOfMonth(today))}
            />
            <NavButton dir="prev" onPress={() => shift(-1)} />
            <NavButton dir="next" onPress={() => shift(1)} />
          </XStack>
        ) : null}
      </XStack>

      {chooser ? (
        <YStack gap="$2" pt="$1">
          <XStack items="center" justify="center" gap="$4">
            <NavButton
              dir="prev"
              onPress={() => setChooserYear((y) => y - 1)}
            />
            <Text
              fontSize="$5"
              fontWeight="600"
              color="$color"
              minW={72}
              text="center"
            >
              {chooserYear}
            </Text>
            <NavButton
              dir="next"
              onPress={() => setChooserYear((y) => y + 1)}
            />
          </XStack>
          {[0, 1, 2, 3].map((r) => (
            <XStack key={r} gap="$2">
              {MONTHS.slice(r * 3, r * 3 + 3).map((label, i) => {
                const idx = r * 3 + i;
                const current =
                  idx === viewMonth.getMonth() &&
                  chooserYear === viewMonth.getFullYear();
                return (
                  <View
                    key={label}
                    role="button"
                    aria-label={`${label} ${chooserYear}`}
                    flex={1}
                    height={ROW}
                    items="center"
                    justify="center"
                    rounded="$3"
                    bg={current ? "$primary" : "transparent"}
                    borderWidth={1}
                    borderColor={current ? "$primary" : "$borderColor"}
                    pressStyle={{ bg: current ? "$primary" : "$secondary" }}
                    onPress={() => pickMonth(idx)}
                  >
                    <Text
                      fontSize="$3"
                      fontWeight={current ? "600" : "400"}
                      color={current ? "$primaryForeground" : "$color"}
                    >
                      {label}
                    </Text>
                  </View>
                );
              })}
            </XStack>
          ))}
        </YStack>
      ) : (
        <YStack>
          <XStack>
            {WEEKDAYS_MON.map((d) => (
              <View key={d} flex={1} items="center" py="$1">
                <Text
                  fontSize={11}
                  fontWeight="600"
                  color="$mutedForeground"
                  textTransform="uppercase"
                  letterSpacing={0.5}
                >
                  {d}
                </Text>
              </View>
            ))}
          </XStack>
          {visibleRows.map((row, r) => (
            <XStack key={r}>
              {row.map((d) => {
                const inMonth = isSameMonth(d, viewMonth);
                const selected = !!value && isSameDay(d, value);
                const isToday = isSameDay(d, today);
                return (
                  <View
                    key={d.toISOString()}
                    role="button"
                    aria-label={format(d, "EEEE, MMMM d, yyyy")}
                    flex={1}
                    height={ROW}
                    items="center"
                    justify="center"
                    onPress={() => onChange(startOfDay(d))}
                  >
                    <View
                      width={36}
                      height={36}
                      rounded={9999}
                      items="center"
                      justify="center"
                      bg={selected ? "$primary" : "transparent"}
                      borderWidth={isToday && !selected ? 1.5 : 0}
                      borderColor="$primary"
                      pressStyle={{ bg: selected ? "$primary" : "$secondary" }}
                    >
                      <Text
                        fontSize="$4"
                        fontWeight={selected || isToday ? "600" : "400"}
                        color={
                          selected
                            ? "$primaryForeground"
                            : inMonth
                              ? "$color"
                              : "$mutedForeground"
                        }
                        opacity={inMonth ? 1 : 0.5}
                      >
                        {d.getDate()}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </XStack>
          ))}
        </YStack>
      )}
    </YStack>
  );
}

function HeaderButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <View
      role="button"
      aria-label={label}
      px="$2.5"
      py="$1.5"
      rounded="$2"
      pressStyle={{ bg: "$secondary" }}
      onPress={onPress}
    >
      <Text fontSize="$3" fontWeight="500" color="$mutedForeground">
        {label}
      </Text>
    </View>
  );
}

/** Round 36px chevron button — a visible hit target, not a bare glyph. */
function NavButton({
  dir,
  onPress,
}: {
  dir: "prev" | "next";
  onPress: () => void;
}) {
  return (
    <View
      role="button"
      aria-label={dir === "prev" ? "Previous" : "Next"}
      width={36}
      height={36}
      rounded={9999}
      items="center"
      justify="center"
      bg="$secondary"
      pressStyle={{ opacity: 0.7 }}
      onPress={onPress}
    >
      {dir === "prev" ? (
        <ChevronLeft size={20} color="$color" />
      ) : (
        <ChevronRight size={20} color="$color" />
      )}
    </View>
  );
}
