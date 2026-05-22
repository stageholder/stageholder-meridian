import { createFileRoute } from "@tanstack/react-router";
import { View } from "@stageholder/ui";
import { CalendarView } from "@/components/calendar/calendar-view";

export const Route = createFileRoute("/_app/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  return (
    <View p="$2" $sm={{ p: "$4" }}>
      <CalendarView />
    </View>
  );
}
