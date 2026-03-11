import { db } from "../db/index";

interface CalendarDayData {
  todos: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate?: string;
    doDate?: string;
    listId: string;
  }>;
  journals: Array<{
    id: string;
    title: string;
    date: string;
    wordCount: number;
  }>;
  habitEntries: Array<{
    id: string;
    habitId: string;
    habitName: string;
    value: number;
    type?: string;
    date: string;
  }>;
}

type CalendarData = Record<string, CalendarDayData>;

function getMonthRange(month: string): { start: string; end: string } {
  const [year, m] = month.split("-").map(Number);
  const start = `${year}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(year!, m!, 0).getDate();
  const end = `${year}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

function emptyDay(): CalendarDayData {
  return { todos: [], journals: [], habitEntries: [] };
}

export async function assembleCalendarDataLocally(
  month: string,
): Promise<CalendarData> {
  const { start, end } = getMonthRange(month);
  const result: CalendarData = {};

  const [todos, journals, habitEntries, habits] = await Promise.all([
    db.todos.toArray(),
    db.journals.where("date").between(start, end, true, true).toArray(),
    db.habitEntries.where("date").between(start, end, true, true).toArray(),
    db.habits.toArray(),
  ]);

  const habitMap = new Map(habits.map((h) => [h.id, h]));

  // Add todos with dueDate or doDate in range
  for (const todo of todos) {
    const dates: string[] = [];
    if (todo.dueDate && todo.dueDate >= start && todo.dueDate <= end) {
      dates.push(todo.dueDate);
    }
    if (todo.doDate && todo.doDate >= start && todo.doDate <= end) {
      dates.push(todo.doDate);
    }
    for (const date of dates) {
      if (!result[date]) result[date] = emptyDay();
      result[date].todos.push({
        id: todo.id,
        title: todo.title,
        status: todo.status,
        priority: todo.priority,
        dueDate: todo.dueDate,
        doDate: todo.doDate,
        listId: todo.listId,
      });
    }
  }

  // Add journals
  for (const journal of journals) {
    const date = journal.date;
    if (!result[date]) result[date] = emptyDay();
    result[date].journals.push({
      id: journal.id,
      title: journal.title,
      date: journal.date,
      wordCount: journal.wordCount ?? 0,
    });
  }

  // Add habit entries
  for (const entry of habitEntries) {
    const date = entry.date;
    if (!result[date]) result[date] = emptyDay();
    const habit = habitMap.get(entry.habitId);
    result[date].habitEntries.push({
      id: entry.id,
      habitId: entry.habitId,
      habitName: habit?.name ?? "Unknown",
      value: entry.value,
      type: entry.type,
      date: entry.date,
    });
  }

  return result;
}
