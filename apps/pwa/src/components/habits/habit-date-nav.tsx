import { useState } from "react";
import {
  format,
  addDays,
  subDays,
  isToday,
  isYesterday,
  startOfDay,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Calendar, IconButton, Popover, Text, XStack } from "@stageholder/ui";

const DAY_MS = 86_400_000;

/** Past-oriented smart label: Today / Yesterday / weekday (this week) / "Mar 12". */
function smartDateLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  const diffDays = Math.round(
    (startOfDay(new Date()).getTime() - startOfDay(date).getTime()) / DAY_MS,
  );
  if (diffDays > 1 && diffDays < 7) return format(date, "EEEE"); // "Monday"
  return format(date, "MMM d"); // "Mar 12"
}

interface HabitDateNavProps {
  value: Date;
  onChange: (date: Date) => void;
}

/**
 * Compact habit date navigator: ‹ prev-day · pill · next-day ›. The pill shows
 * a smart label (Today / Yesterday / Mon / Mar 12) and opens a **past-only**
 * calendar — you can't check in ahead, so future dates are disabled and the
 * next-day arrow stops at today. When a past date is selected the pill picks up
 * a faint primary tint to read as an active filter.
 *
 * Single-date by design: habit cards render one day's status, so a range has
 * nothing to map onto. Pure composition of the kit Calendar + Popover +
 * IconButton — no kit changes.
 */
export function HabitDateNav({ value, onChange }: HabitDateNavProps) {
  const [open, setOpen] = useState(false);
  const today = startOfDay(new Date());
  // `value` is normalized to a real day; >= today means "viewing today"
  // (future is blocked everywhere, so it never exceeds today).
  const atToday = startOfDay(value).getTime() >= today.getTime();

  return (
    <XStack items="center" gap="$1.5">
      <IconButton
        variant="ghost"
        size="sm"
        aria-label="Previous day"
        onPress={() => onChange(subDays(value, 1))}
      >
        <ChevronLeft size={16} />
      </IconButton>

      <Popover open={open} onOpenChange={setOpen} placement="bottom-start">
        <Popover.Trigger asChild>
          <XStack
            items="center"
            gap="$2"
            px="$3"
            py="$2"
            rounded={999}
            borderWidth={1}
            borderColor={atToday ? "$borderColor" : "$primary"}
            bg={atToday ? "$background" : "$primaryMuted"}
            cursor="pointer"
            transition="quick"
            hoverStyle={{ bg: atToday ? "$secondary" : "$primaryMuted" }}
            {...({ "aria-label": "Choose date" } as object)}
          >
            <Text
              color={atToday ? "$mutedForeground" : "$primary"}
              lineHeight={0}
            >
              <CalendarDays size={16} />
            </Text>
            <Text fontSize="$3" fontWeight="500" color="$color">
              {smartDateLabel(value)}
            </Text>
          </XStack>
        </Popover.Trigger>
        <Popover.Content width="auto" p="$2">
          <Calendar
            value={value}
            onChange={(d) => {
              onChange(d);
              setOpen(false);
            }}
            isDateDisabled={(d) => startOfDay(d).getTime() > today.getTime()}
            weekStartsOn={1}
            initialMonth={value}
          />
        </Popover.Content>
      </Popover>

      <IconButton
        variant="ghost"
        size="sm"
        aria-label="Next day"
        disabled={atToday}
        onPress={() => onChange(addDays(value, 1))}
      >
        <ChevronRight size={16} />
      </IconButton>
    </XStack>
  );
}
