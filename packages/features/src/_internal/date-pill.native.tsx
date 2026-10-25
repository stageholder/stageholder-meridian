// packages/features/src/_internal/date-pill.native.tsx  (NATIVE)
//
// Date pill + its nested picker sheet for the quick-add and detail sheets —
// app-owned, replacing the kit `QuickDatePicker` on native.
//
// Why: the kit picker's sheet unmounts its body on every close and gates it
// on the open spring settling, so each open slid up EMPTY and then popped the
// presets + calendar in ("blank, then blink", device feedback 2026-10-25); and
// the kit Calendar's header controls are dead inside a nested sheet on native
// (month could not be changed) — hence the app-owned MonthGrid.
// This sheet keeps its root mounted while closed (`mountChildren="open"`,
// see below) and nests inside the composer like the priority/list pickers
// (`PillPickerSheet`), so it stacks above it by the kit's parent-sheet
// contract.

import type { ReactNode } from "react";
import {
  addDays,
  differenceInCalendarDays,
  format,
  isSameDay,
  startOfDay,
} from "date-fns";
import { CalendarDays } from "@tamagui/lucide-icons-2/icons/CalendarDays";
import { Sheet, Text, View, XStack, YStack } from "@stageholder/ui";

import { MonthGrid } from "./month-grid.native";

import { QuickAddPill } from "./quick-add-sheet.native";
import { useAndroidBackClose } from "./use-android-back-close";
import { KeyboardSpacer } from "./composer-sheet.native";

/** Short, human label for a picked day — the kit picker's wording. */
export function dateLabel(value: Date | null, placeholder: string): string {
  if (!value) return placeholder;
  const today = startOfDay(new Date());
  const day = startOfDay(value);
  const diff = differenceInCalendarDays(day, today);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return format(day, "EEE");
  return format(day, "MMM d");
}

export interface DatePillProps {
  placeholder: string;
  value: Date | null;
  /** Opens the paired `DatePickerSheet` (which rises above an open keyboard). */
  onPress: () => void;
}

export function DatePill({ placeholder, value, onPress }: DatePillProps) {
  return (
    <QuickAddPill
      icon={<CalendarDays size={13} color={value ? "$primary" : undefined} />}
      label={dateLabel(value, placeholder)}
      onPress={onPress}
    />
  );
}

interface Preset {
  id: string;
  label: string;
  date: Date | null;
}

function buildPresets(): Preset[] {
  const today = startOfDay(new Date());
  return [
    { id: "today", label: "Today", date: today },
    { id: "tomorrow", label: "Tomorrow", date: addDays(today, 1) },
    { id: "next-week", label: "Next week", date: addDays(today, 7) },
    { id: "none", label: "No date", date: null },
  ];
}

export interface DatePickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  value: Date | null;
  /** `null` clears the date. Closes the sheet on every pick. */
  onChange: (date: Date | null) => void;
  /** Optional footer slot below the calendar. */
  footer?: ReactNode;
}

export function DatePickerSheet({
  open,
  onOpenChange,
  title,
  value,
  onChange,
  footer,
}: DatePickerSheetProps) {
  useAndroidBackClose(open, () => onOpenChange(false));
  const presets = buildPresets();
  const pick = (d: Date | null) => {
    onChange(d);
    onOpenChange(false);
  };
  const isActive = (p: Preset) =>
    p.date === null ? value === null : !!value && isSameDay(value, p.date);

  return (
    <Sheet
      modal
      open={open}
      onOpenChange={onOpenChange}
      // `fit`: content sits directly in the frame (no ScrollView), so the
      // sheet sizes to presets + one month and re-fits when the month/year
      // dropdown swaps the grid — a constant height either clipped the grid
      // on small phones or left dead space on large ones.
      snapPointsMode="fit"
      dismissOnSnapToBottom
      transition="medium"
      // Root mounted while closed (`open` policy; was `idle`): the idle warm
      // covers ONE sheet app-wide, so the second date sheet stayed on the
      // lazy root and sometimes opened as an overlay with no frame
      // (2026-10-25). The month grid is light enough to mount at open.
      mountChildren="open"
    >
      <Sheet.Overlay />
      <Sheet.Frame pt={0} pb="$6" px="$4" gap="$2">
        <Text fontSize="$5" fontWeight="600" color="$color" pb="$1">
          {title}
        </Text>
        <YStack gap={1}>
          {presets.map((p) => {
            const active = isActive(p);
            return (
              <XStack
                key={p.id}
                role="button"
                aria-label={p.label}
                onPress={() => pick(p.date)}
                items="center"
                gap="$3"
                py="$2"
                px="$2"
                rounded="$3"
                bg={active ? "$secondary" : "transparent"}
                pressStyle={{ bg: "$secondary" }}
              >
                <View width={22} items="center">
                  <CalendarDays
                    size={14}
                    color={active ? "$primary" : "$mutedForeground"}
                  />
                </View>
                <Text fontSize="$4" color="$color" flex={1} numberOfLines={1}>
                  {p.label}
                </Text>
                {p.date ? (
                  <Text fontSize="$2" color="$mutedForeground">
                    {format(p.date, "EEE, MMM d")}
                  </Text>
                ) : null}
              </XStack>
            );
          })}
        </YStack>
        <View pt="$2">
          {/* App-owned grid (see month-grid.native.tsx): the kit Calendar's
              header controls are RN Pressables and get no touches inside a
              nested sheet on native, so the month could never be changed. */}
          <MonthGrid
            value={value}
            initialMonth={value ?? new Date()}
            onChange={(d) => pick(d)}
          />
        </View>
        {footer}
        {/* Rises above a keyboard the host leaves up (see KeyboardSpacer). */}
        <KeyboardSpacer />
      </Sheet.Frame>
    </Sheet>
  );
}
