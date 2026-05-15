import { useMemo } from "react";
import { format } from "date-fns";
import { useAllTodos } from "@/lib/api/todos";

export function useTodoStats() {
  const { data: todos, isLoading } = useAllTodos();

  const stats = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const relevant = (todos ?? []).filter((t) => {
      const dueDateStr = t.dueDate?.split("T")[0];
      const doDateStr = t.doDate?.split("T")[0];
      return (
        (dueDateStr !== undefined && dueDateStr <= today) ||
        (doDateStr !== undefined && doDateStr <= today)
      );
    });

    const total = relevant.length;
    const done = relevant.filter((t) => t.status === "done").length;
    const percentage = total === 0 ? 0 : Math.round((done / total) * 100);

    return { total, done, percentage };
  }, [todos]);

  return { ...stats, isLoading };
}
