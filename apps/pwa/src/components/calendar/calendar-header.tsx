import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Button, H2, IconButton, XStack } from "@stageholder/ui";

interface CalendarHeaderProps {
  currentMonth: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}

export function CalendarHeader({
  currentMonth,
  onPrevMonth,
  onNextMonth,
  onToday,
}: CalendarHeaderProps) {
  return (
    <XStack items="center" justify="space-between">
      <XStack items="center" gap="$2">
        <IconButton
          variant="outline"
          size="sm"
          onPress={onPrevMonth}
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </IconButton>
        <H2
          fontSize="$6"
          fontWeight="600"
          color="$color"
          minW={160}
          text="center"
        >
          {format(currentMonth, "MMMM yyyy")}
        </H2>
        <IconButton
          variant="outline"
          size="sm"
          onPress={onNextMonth}
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </IconButton>
      </XStack>
      <Button intent="outline" size="sm" onPress={onToday}>
        Today
      </Button>
    </XStack>
  );
}
