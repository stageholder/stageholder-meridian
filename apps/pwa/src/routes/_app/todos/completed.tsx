import { createFileRoute } from "@tanstack/react-router";
import { CompletedContent } from "@/components/todos/completed-content";

export const Route = createFileRoute("/_app/todos/completed")({
  component: CompletedPage,
});

function CompletedPage() {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <CompletedContent />
    </div>
  );
}
