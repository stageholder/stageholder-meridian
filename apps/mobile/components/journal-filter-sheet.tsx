// apps/mobile/components/journal-filter-sheet.tsx
//
// Journal list filters — native counterpart of the PWA journal-sidebar's
// Filter popover (apps/pwa/src/components/journal/journal-sidebar.tsx): a
// date range + a mood filter, applied live. The PWA hosts these in a Popover
// with a DateRangePicker + Select; popovers and web-style selects don't
// survive inside native sheets (they render behind the sheet portal), so the
// native form is a kit FormSheet with:
//
//   - two QuickDatePicker chips (From / To) — the same trigger-pill +
//     driven-sheet picker the TodoForm already uses inside a FormSheet, so
//     the sheet-in-sheet path is a proven pattern;
//   - the kit MoodPicker (clearable) — tap a mood to filter, tap it again to
//     clear (= "All moods"), the same 1–5 emoji scale entries are tagged with.
//
// The parent screen owns the filter state (this sheet is fully controlled);
// filters apply as they change, and "Done" simply closes the sheet.

import {
  Button,
  FormSheet,
  MoodPicker,
  QuickDatePicker,
  Text,
  XStack,
  YStack,
} from "@stageholder/ui";
import { format } from "date-fns";

export interface JournalFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `yyyy-MM-dd` or "" (unset). */
  startDate: string;
  endDate: string;
  /** 1–5, or 0 = all moods. */
  mood: number;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onMoodChange: (mood: number) => void;
}

/** Parse `yyyy-MM-dd` as a LOCAL day (same rationale as the TodoForm's
 *  parser — `new Date("yyyy-MM-dd")` would parse UTC and shift a day). */
function parseLocalDay(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function JournalFilterSheet({
  open,
  onOpenChange,
  startDate,
  endDate,
  mood,
  onStartDateChange,
  onEndDateChange,
  onMoodChange,
}: JournalFilterSheetProps) {
  const activeCount = (startDate || endDate ? 1 : 0) + (mood !== 0 ? 1 : 0);

  function clearAll() {
    onStartDateChange("");
    onEndDateChange("");
    onMoodChange(0);
  }

  return (
    <FormSheet
      hideFooter
      open={open}
      onOpenChange={onOpenChange}
      title="Filters"
      description="Narrow the list by date range or mood."
    >
      <YStack gap="$4" pb="$2">
        <YStack gap="$2">
          <Text fontSize="$1" fontWeight="500" color="$mutedForeground">
            Date range
          </Text>
          <XStack gap="$2" items="center">
            <QuickDatePicker
              size="sm"
              placeholder="From"
              value={parseLocalDay(startDate)}
              onChange={(d) =>
                onStartDateChange(d ? format(d, "yyyy-MM-dd") : "")
              }
            />
            <Text fontSize="$2" color="$mutedForeground">
              –
            </Text>
            <QuickDatePicker
              size="sm"
              placeholder="To"
              value={parseLocalDay(endDate)}
              onChange={(d) =>
                onEndDateChange(d ? format(d, "yyyy-MM-dd") : "")
              }
            />
          </XStack>
        </YStack>

        <YStack gap="$2">
          <Text fontSize="$1" fontWeight="500" color="$mutedForeground">
            Mood
          </Text>
          {/* clearable: tapping the selected mood again clears the filter —
              that's the "All moods" state, so no extra option row needed. */}
          <MoodPicker
            clearable
            showLabels
            value={mood === 0 ? null : mood}
            onChange={(v) => onMoodChange(typeof v === "number" ? v : 0)}
          />
        </YStack>

        <XStack gap="$2" justify="flex-end" mt="$2">
          {activeCount > 0 ? (
            <Button intent="ghost" size="sm" onPress={clearAll}>
              Clear all
            </Button>
          ) : null}
          <Button
            intent="primary"
            size="sm"
            onPress={() => onOpenChange(false)}
          >
            Done
          </Button>
        </XStack>
      </YStack>
    </FormSheet>
  );
}
