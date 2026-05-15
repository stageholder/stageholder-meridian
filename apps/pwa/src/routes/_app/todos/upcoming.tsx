import { createFileRoute } from "@tanstack/react-router";
import { UpcomingContent } from "@/components/todos/upcoming-content";

export const Route = createFileRoute("/_app/todos/upcoming")({
  component: UpcomingPage,
});

function UpcomingPage() {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <UpcomingContent />
    </div>
  );
}
