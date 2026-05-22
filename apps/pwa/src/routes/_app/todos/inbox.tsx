import { createFileRoute } from "@tanstack/react-router";
import { View } from "@stageholder/ui";
import { InboxContent } from "@/components/todos/inbox-content";

export const Route = createFileRoute("/_app/todos/inbox")({
  component: InboxPage,
});

function InboxPage() {
  return (
    <View flex={1} overflowY={"auto" as never} p="$4">
      <InboxContent />
    </View>
  );
}
