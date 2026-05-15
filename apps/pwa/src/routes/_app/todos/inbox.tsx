import { createFileRoute } from "@tanstack/react-router";
import { InboxContent } from "@/components/todos/inbox-content";

export const Route = createFileRoute("/_app/todos/inbox")({
  component: InboxPage,
});

function InboxPage() {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <InboxContent />
    </div>
  );
}
