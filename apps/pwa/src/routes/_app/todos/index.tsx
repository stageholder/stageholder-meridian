import { createFileRoute } from "@tanstack/react-router";
import { TodayContent } from "@/components/todos/today-content";

export const Route = createFileRoute("/_app/todos/")({
  component: TodosPage,
});

function TodosPage() {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <TodayContent />
    </div>
  );
}
