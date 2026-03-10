import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { useWorkspace } from "@/lib/workspace-context";

export interface CalendarDayData {
  todos: Array<{ id: string; title: string; status: string; priority: string; dueDate?: string; doDate?: string; listId: string }>;
  journals: Array<{ id: string; title: string; date: string; wordCount: number }>;
  habitEntries: Array<{ id: string; habitId: string; habitName: string; value: number; type?: string; date: string }>;
}

export type CalendarData = Record<string, CalendarDayData>;

export function useCalendarData(month: string) {
  const { workspace } = useWorkspace();

  return useQuery<CalendarData>({
    queryKey: ["calendar", workspace.id, month],
    queryFn: async () => {
      const res = await apiClient.get(
        `/workspaces/${workspace.id}/calendar`,
        { params: { month } }
      );
      return res.data?.data ?? res.data;
    },
    enabled: !!month,
  });
}
