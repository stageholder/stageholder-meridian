import { createFileRoute } from "@tanstack/react-router";
import { View } from "@stageholder/ui";
import { CompletedContent } from "@/components/todos/completed-content";

export const Route = createFileRoute("/_app/todos/completed")({
  component: CompletedPage,
});

function CompletedPage() {
  return (
    <View flex={1} overflowY={"auto" as never} p="$4">
      <CompletedContent />
    </View>
  );
}
