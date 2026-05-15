import { createFileRoute } from "@tanstack/react-router";
import { CalendarView } from "@/components/calendar/calendar-view";

export const Route = createFileRoute("/_app/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  return (
    <div className="p-2 sm:p-4">
      <CalendarView />
    </div>
  );
}
