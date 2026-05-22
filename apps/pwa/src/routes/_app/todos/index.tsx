import { createFileRoute } from "@tanstack/react-router";
import { View } from "@stageholder/ui";
import { TodayContent } from "@/components/todos/today-content";

export const Route = createFileRoute("/_app/todos/")({
  component: TodosPage,
});

function TodosPage() {
  return (
    <View flex={1} overflowY={"auto" as never} p="$4">
      <TodayContent />
    </View>
  );
}
