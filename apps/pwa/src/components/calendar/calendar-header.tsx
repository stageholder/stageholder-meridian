import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Button, IconButton } from "@stageholder/ui";

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
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <IconButton
          variant="outline"
          size="sm"
          onPress={onPrevMonth}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </IconButton>
        <h2 className="text-lg font-semibold text-foreground min-w-[160px] text-center">
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <IconButton
          variant="outline"
          size="sm"
          onPress={onNextMonth}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </IconButton>
      </div>
      <Button intent="outline" size="sm" onPress={onToday}>
        Today
      </Button>
    </div>
  );
}
