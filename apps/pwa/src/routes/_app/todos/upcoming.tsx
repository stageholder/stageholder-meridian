import { createFileRoute } from "@tanstack/react-router";
import { View } from "@stageholder/ui";
import { UpcomingContent } from "@/components/todos/upcoming-content";

export const Route = createFileRoute("/_app/todos/upcoming")({
  component: UpcomingPage,
});

function UpcomingPage() {
  return (
    <View flex={1} overflowY={"auto" as never} p="$4">
      <UpcomingContent />
    </View>
  );
}
