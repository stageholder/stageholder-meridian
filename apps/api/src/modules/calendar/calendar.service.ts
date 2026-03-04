import { Injectable } from '@nestjs/common';
import { TodoRepository } from '../todo/todo.repository';
import { JournalRepository } from '../journal/journal.repository';
import { HabitEntryRepository } from '../habit-entry/habit-entry.repository';
import { HabitRepository } from '../habit/habit.repository';
import { WorkspaceMemberService } from '../workspace-member/workspace-member.service';

export interface CalendarDayData {
  todos: Array<{ id: string; title: string; status: string; priority: string; dueDate: string; listId: string }>;
  journals: Array<{ id: string; title: string; date: string }>;
  habitEntries: Array<{ id: string; habitId: string; habitName: string; value: number; date: string }>;
}

@Injectable()
export class CalendarService {
  constructor(
    private readonly todoRepository: TodoRepository,
    private readonly journalRepository: JournalRepository,
    private readonly habitEntryRepository: HabitEntryRepository,
    private readonly habitRepository: HabitRepository,
    private readonly memberService: WorkspaceMemberService,
  ) {}

  async getMonthData(workspaceId: string, userId: string, startDate: string, endDate: string): Promise<Record<string, CalendarDayData>> {
    await this.memberService.requireRole(workspaceId, userId, ['owner', 'admin', 'member']);

    const [todos, journals, habitEntries, habits] = await Promise.all([
      this.todoRepository.findByWorkspaceAndDateRange(workspaceId, startDate, endDate),
      this.journalRepository.findByDateRange(workspaceId, startDate, endDate),
      this.habitEntryRepository.findByWorkspaceAndDateRange(workspaceId, startDate, endDate),
      this.habitRepository.findByWorkspace(workspaceId),
    ]);

    const habitMap = new Map(habits.map((h) => [h.id, h.name]));
    const result: Record<string, CalendarDayData> = {};

    const getDay = (date: string) => {
      if (!result[date]) result[date] = { todos: [], journals: [], habitEntries: [] };
      return result[date];
    };

    for (const todo of todos) {
      const obj = todo.toObject();
      if (obj.dueDate) {
        const day = obj.dueDate.split('T')[0] || obj.dueDate;
        getDay(day).todos.push({ id: obj.id, title: obj.title, status: obj.status, priority: obj.priority, dueDate: obj.dueDate, listId: obj.listId });
      }
    }

    for (const journal of journals) {
      const obj = journal.toObject();
      const day = obj.date.split('T')[0] || obj.date;
      getDay(day).journals.push({ id: obj.id, title: obj.title, date: obj.date });
    }

    for (const entry of habitEntries) {
      const obj = entry.toObject();
      const day = obj.date.split('T')[0] || obj.date;
      getDay(day).habitEntries.push({ id: obj.id, habitId: obj.habitId, habitName: habitMap.get(obj.habitId) || 'Unknown', value: obj.value, date: obj.date });
    }

    return result;
  }
}
