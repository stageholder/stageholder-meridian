# Calendar Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a unified calendar page that displays todos, journal entries, and habit completions in a month grid with day detail panel.

**Architecture:** New NestJS calendar module aggregates existing repos (todo, journal, habit-entry) by date range. Frontend uses a custom month-grid component built with Tailwind CSS grid. Data fetched via TanStack Query with the same pattern as existing hooks. No new database collections.

**Tech Stack:** NestJS, Mongoose, Next.js 16, React 19, Tailwind CSS 4, TanStack React Query, date-fns, lucide-react

---

## Task 1: Backend — Calendar Service

**Files:**
- Create: `apps/api/src/modules/calendar/calendar.service.ts`

**Step 1: Create the calendar service**

This service queries across the existing TodoRepository, JournalRepository, and HabitEntryRepository to aggregate items by date. It needs new `findByDateRange` methods on TodoRepository and a workspace-level query on HabitEntryRepository.

```typescript
// apps/api/src/modules/calendar/calendar.service.ts
import { Injectable } from '@nestjs/common';
import { TodoRepository } from '../todo/todo.repository';
import { JournalRepository } from '../journal/journal.repository';
import { HabitEntryRepository } from '../habit-entry/habit-entry.repository';
import { HabitRepository } from '../habit/habit.repository';
import { WorkspaceMemberService } from '../workspace-member/workspace-member.service';

interface CalendarDayData {
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
```

**Step 2: Add `findByWorkspaceAndDateRange` to TodoRepository**

Open `apps/api/src/modules/todo/todo.repository.ts` and add this method after `findByWorkspace`:

```typescript
async findByWorkspaceAndDateRange(workspaceId: string, startDate: string, endDate: string): Promise<Todo[]> {
  const docs = await this.model.find({ workspace_id: workspaceId, deleted_at: null, due_date: { $gte: startDate, $lte: endDate } }).sort({ due_date: 1 }).lean();
  return docs.map((doc) => this.toDomain(doc));
}
```

**Step 3: Add `findByWorkspaceAndDateRange` to HabitEntryRepository**

Open `apps/api/src/modules/habit-entry/habit-entry.repository.ts` and add this method after `findByHabitAndDateRange`:

```typescript
async findByWorkspaceAndDateRange(workspaceId: string, startDate: string, endDate: string): Promise<HabitEntry[]> {
  const docs = await this.model.find({ workspace_id: workspaceId, deleted_at: null, date: { $gte: startDate, $lte: endDate } }).sort({ date: -1 }).lean();
  return docs.map((doc) => this.toDomain(doc));
}
```

**Step 4: Add `findByWorkspace` to HabitRepository**

Check if `HabitRepository` already has `findByWorkspace`. If not, add:

```typescript
async findByWorkspace(workspaceId: string): Promise<Habit[]> {
  const docs = await this.model.find({ workspace_id: workspaceId, deleted_at: null }).lean();
  return docs.map((doc) => this.toDomain(doc));
}
```

**Step 5: Commit**

```bash
git add apps/api/src/modules/calendar/calendar.service.ts apps/api/src/modules/todo/todo.repository.ts apps/api/src/modules/habit-entry/habit-entry.repository.ts apps/api/src/modules/habit/habit.repository.ts
git commit -m "feat(api): add CalendarService with date-range repository methods"
```

---

## Task 2: Backend — Calendar Controller & Module

**Files:**
- Create: `apps/api/src/modules/calendar/calendar.controller.ts`
- Create: `apps/api/src/modules/calendar/calendar.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Step 1: Create the controller**

The controller parses the `month` query param (format: `YYYY-MM`), computes the date range for the visible grid (the month plus overflow days from adjacent months), and delegates to the service.

```typescript
// apps/api/src/modules/calendar/calendar.controller.ts
import { Controller, Get, Param, Query, BadRequestException } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';

@Controller('workspaces/:workspaceId/calendar')
export class CalendarController {
  constructor(private readonly service: CalendarService) {}

  @Get()
  async getMonthData(
    @Param('workspaceId') workspaceId: string,
    @CurrentUserId() userId: string,
    @Query('month') month?: string,
  ) {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('month query param required in YYYY-MM format');
    }

    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const mo = parseInt(monthStr, 10);

    // First day of the month
    const firstDay = new Date(year, mo - 1, 1);
    // Last day of the month
    const lastDay = new Date(year, mo, 0);

    // Expand range to cover the visible grid:
    // Go back to the Sunday before (or on) the first day
    const startOffset = firstDay.getDay(); // 0=Sun
    const gridStart = new Date(firstDay);
    gridStart.setDate(gridStart.getDate() - startOffset);

    // Go forward to the Saturday after (or on) the last day
    const endOffset = 6 - lastDay.getDay(); // 6=Sat
    const gridEnd = new Date(lastDay);
    gridEnd.setDate(gridEnd.getDate() + endOffset);

    const startDate = gridStart.toISOString().split('T')[0];
    const endDate = gridEnd.toISOString().split('T')[0];

    return this.service.getMonthData(workspaceId, userId, startDate, endDate);
  }
}
```

**Step 2: Create the module**

```typescript
// apps/api/src/modules/calendar/calendar.module.ts
import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { TodoModule } from '../todo/todo.module';
import { JournalModule } from '../journal/journal.module';
import { HabitEntryModule } from '../habit-entry/habit-entry.module';
import { HabitModule } from '../habit/habit.module';
import { WorkspaceMemberModule } from '../workspace-member/workspace-member.module';

@Module({
  imports: [TodoModule, JournalModule, HabitEntryModule, HabitModule, WorkspaceMemberModule],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
```

**Important:** The CalendarService injects `TodoRepository`, `JournalRepository`, `HabitEntryRepository`, and `HabitRepository` directly. These are currently only exported as providers from their respective modules. You need to ensure each module **exports** the repository. Check each module file:

- `TodoModule` — must have `exports: [TodoService, TodoRepository]` (add `TodoRepository` if missing)
- `JournalModule` — must have `exports: [JournalService, JournalRepository]` (add `JournalRepository` if missing)
- `HabitEntryModule` — must have `exports: [HabitEntryService, HabitEntryRepository]`
- `HabitModule` — must have `exports: [HabitService, HabitRepository]`

If exporting repositories directly feels too coupled, an alternative is to inject the services instead and add `findByDateRange`-style methods to the services. But since this is a read-only aggregation module, injecting repositories directly is simpler.

**Step 3: Register in AppModule**

Open `apps/api/src/app.module.ts` and add the CalendarModule:

```typescript
import { CalendarModule } from './modules/calendar/calendar.module';

// In the imports array, add after HabitEntryModule:
CalendarModule,
```

**Step 4: Verify the API compiles**

```bash
cd apps/api && bun run build
```

Expected: Build succeeds with no errors.

**Step 5: Commit**

```bash
git add apps/api/src/modules/calendar/ apps/api/src/app.module.ts apps/api/src/modules/todo/todo.module.ts apps/api/src/modules/journal/journal.module.ts apps/api/src/modules/habit-entry/habit-entry.module.ts apps/api/src/modules/habit/habit.module.ts
git commit -m "feat(api): add calendar controller and module with month data endpoint"
```

---

## Task 3: Frontend — Calendar API Hook

**Files:**
- Create: `apps/pwa/lib/api/calendar.ts`

**Step 1: Create the calendar hook**

Follow the same pattern as `useJournals` and `useHabits`:

```typescript
// apps/pwa/lib/api/calendar.ts
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { useWorkspace } from "@/lib/workspace-context";
import type { Todo, Journal, HabitEntry } from "@repo/core/types";

export interface CalendarDayData {
  todos: Array<{ id: string; title: string; status: string; priority: string; dueDate: string; listId: string }>;
  journals: Array<{ id: string; title: string; date: string }>;
  habitEntries: Array<{ id: string; habitId: string; habitName: string; value: number; date: string }>;
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
```

**Step 2: Commit**

```bash
git add apps/pwa/lib/api/calendar.ts
git commit -m "feat(pwa): add useCalendarData hook"
```

---

## Task 4: Frontend — Calendar Header Component

**Files:**
- Create: `apps/pwa/components/calendar/calendar-header.tsx`

**Step 1: Create the header**

Month/year title with prev/next arrows and a "Today" button:

```tsx
// apps/pwa/components/calendar/calendar-header.tsx
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface CalendarHeaderProps {
  currentMonth: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}

export function CalendarHeader({ currentMonth, onPrevMonth, onNextMonth, onToday }: CalendarHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <button
          onClick={onPrevMonth}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="text-lg font-semibold text-foreground min-w-[160px] text-center">
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <button
          onClick={onNextMonth}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <button
        onClick={onToday}
        className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
      >
        Today
      </button>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/pwa/components/calendar/calendar-header.tsx
git commit -m "feat(pwa): add CalendarHeader component"
```

---

## Task 5: Frontend — Calendar Cell Component

**Files:**
- Create: `apps/pwa/components/calendar/calendar-cell.tsx`

**Step 1: Create the cell**

Shows the day number and colored dots for each entity type present on that day:

```tsx
// apps/pwa/components/calendar/calendar-cell.tsx
"use client";

import { cn } from "@/lib/utils";
import { isToday, isSameMonth } from "date-fns";
import type { CalendarDayData } from "@/lib/api/calendar";

interface CalendarCellProps {
  date: Date;
  currentMonth: Date;
  isSelected: boolean;
  dayData?: CalendarDayData;
  onClick: () => void;
}

export function CalendarCell({ date, currentMonth, isSelected, dayData, onClick }: CalendarCellProps) {
  const today = isToday(date);
  const inMonth = isSameMonth(date, currentMonth);

  const hasTodos = (dayData?.todos?.length ?? 0) > 0;
  const hasJournals = (dayData?.journals?.length ?? 0) > 0;
  const hasHabits = (dayData?.habitEntries?.length ?? 0) > 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg p-2 text-sm transition-colors min-h-[60px]",
        inMonth ? "text-foreground" : "text-muted-foreground/50",
        isSelected && "bg-accent ring-1 ring-primary",
        !isSelected && "hover:bg-accent/50",
        today && !isSelected && "bg-primary/10",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium",
          today && "bg-primary text-primary-foreground",
        )}
      >
        {date.getDate()}
      </span>
      <div className="flex items-center gap-1">
        {hasTodos && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
        {hasJournals && <span className="h-1.5 w-1.5 rounded-full bg-green-500" />}
        {hasHabits && <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />}
      </div>
    </button>
  );
}
```

**Step 2: Commit**

```bash
git add apps/pwa/components/calendar/calendar-cell.tsx
git commit -m "feat(pwa): add CalendarCell component with dot indicators"
```

---

## Task 6: Frontend — Calendar Grid Component

**Files:**
- Create: `apps/pwa/components/calendar/calendar-grid.tsx`

**Step 1: Create the grid**

7-column CSS grid showing weekday headers and all day cells for the visible range:

```tsx
// apps/pwa/components/calendar/calendar-grid.tsx
"use client";

import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
} from "date-fns";
import { CalendarCell } from "./calendar-cell";
import type { CalendarData } from "@/lib/api/calendar";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarGridProps {
  currentMonth: Date;
  selectedDate: Date | null;
  calendarData: CalendarData;
  onSelectDate: (date: Date) => void;
}

export function CalendarGrid({ currentMonth, selectedDate, calendarData, onSelectDate }: CalendarGridProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          return (
            <CalendarCell
              key={dateKey}
              date={day}
              currentMonth={currentMonth}
              isSelected={selectedDate ? isSameDay(day, selectedDate) : false}
              dayData={calendarData[dateKey]}
              onClick={() => onSelectDate(day)}
            />
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/pwa/components/calendar/calendar-grid.tsx
git commit -m "feat(pwa): add CalendarGrid component"
```

---

## Task 7: Frontend — Day Panel Component

**Files:**
- Create: `apps/pwa/components/calendar/day-panel.tsx`

**Step 1: Create the day panel**

Expandable panel showing all items for the selected day, grouped by type, with quick-add buttons:

```tsx
// apps/pwa/components/calendar/day-panel.tsx
"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Plus, BookOpen, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpdateTodo } from "@/lib/api/todos";
import { useWorkspace } from "@/lib/workspace-context";
import { CreateTodoDialog } from "@/components/todos/create-todo-dialog";
import { useTodoLists } from "@/lib/api/todos";
import type { CalendarDayData } from "@/lib/api/calendar";
import Link from "next/link";

const priorityConfig: Record<string, { label: string; className: string }> = {
  urgent: { label: "Urgent", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  high: { label: "High", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  medium: { label: "Medium", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  low: { label: "Low", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  none: { label: "", className: "" },
};

interface DayPanelProps {
  date: Date;
  dayData: CalendarDayData;
}

export function DayPanel({ date, dayData }: DayPanelProps) {
  const { workspace } = useWorkspace();
  const updateTodo = useUpdateTodo();
  const { data: lists } = useTodoLists();
  const defaultList = lists?.find((l) => l.isDefault) || lists?.[0];
  const [showCreateTodo, setShowCreateTodo] = useState(false);

  const dateStr = format(date, "yyyy-MM-dd");

  function handleToggleTodo(todoId: string, listId: string, currentStatus: string) {
    updateTodo.mutate({
      listId,
      todoId,
      data: { status: currentStatus === "done" ? "todo" : "done" },
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground">
        {format(date, "EEEE, MMMM d, yyyy")}
      </h3>

      {/* Todos Section */}
      <div className="mt-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          Todos ({dayData.todos.length})
        </div>
        {dayData.todos.length > 0 ? (
          <div className="mt-2 space-y-1.5">
            {dayData.todos.map((todo) => {
              const isDone = todo.status === "done";
              const priority = priorityConfig[todo.priority] ?? { label: "", className: "" };
              return (
                <div
                  key={todo.id}
                  onClick={() => handleToggleTodo(todo.id, todo.listId, todo.status)}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50"
                >
                  <div
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                      isDone ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                    )}
                  >
                    {isDone && <CheckCircle2 className="h-3 w-3" />}
                  </div>
                  <span className={cn("flex-1 text-sm", isDone && "line-through text-muted-foreground")}>
                    {todo.title}
                  </span>
                  {priority.label && (
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", priority.className)}>
                      {priority.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">No todos</p>
        )}
      </div>

      {/* Journals Section */}
      <div className="mt-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Journal ({dayData.journals.length})
        </div>
        {dayData.journals.length > 0 ? (
          <div className="mt-2 space-y-1.5">
            {dayData.journals.map((journal) => (
              <Link
                key={journal.id}
                href={`/${workspace.shortId}/journal/${journal.id}`}
                className="block rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent/50"
              >
                {journal.title}
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">No journal entries</p>
        )}
      </div>

      {/* Habits Section */}
      <div className="mt-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-orange-500" />
          Habits ({dayData.habitEntries.length})
        </div>
        {dayData.habitEntries.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {dayData.habitEntries.map((entry) => (
              <span
                key={entry.id}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                  entry.value > 0
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {entry.value > 0 ? "✓" : "✗"} {entry.habitName}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">No habit entries</p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-5 flex gap-2">
        <button
          onClick={() => setShowCreateTodo(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Todo
        </button>
        <Link
          href={`/${workspace.shortId}/journal/new?date=${dateStr}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
        >
          <BookOpen className="h-3.5 w-3.5" />
          New Journal
        </Link>
      </div>

      {defaultList && (
        <CreateTodoDialog
          open={showCreateTodo}
          onOpenChange={setShowCreateTodo}
          listId={defaultList.id}
        />
      )}
    </div>
  );
}
```

**Note:** The `CreateTodoDialog` currently doesn't accept a `defaultDueDate` prop. You'll need to add that prop to it so the calendar can pre-fill the date. Add an optional `defaultDueDate?: string` prop and initialize the `dueDate` state with it:

In `apps/pwa/components/todos/create-todo-dialog.tsx`:
- Add `defaultDueDate?: string` to the `CreateTodoDialogProps` interface
- Change `const [dueDate, setDueDate] = useState("");` to `const [dueDate, setDueDate] = useState(defaultDueDate || "");`
- Pass `defaultDueDate={dateStr}` from DayPanel

**Step 2: Commit**

```bash
git add apps/pwa/components/calendar/day-panel.tsx apps/pwa/components/todos/create-todo-dialog.tsx
git commit -m "feat(pwa): add DayPanel component with quick actions"
```

---

## Task 8: Frontend — Calendar View (Main Container)

**Files:**
- Create: `apps/pwa/components/calendar/calendar-view.tsx`

**Step 1: Create the main calendar view**

Orchestrates the header, grid, and day panel. Manages current month and selected date state.

```tsx
// apps/pwa/components/calendar/calendar-view.tsx
"use client";

import { useState, useMemo } from "react";
import { format, addMonths, subMonths, startOfMonth } from "date-fns";
import { CalendarHeader } from "./calendar-header";
import { CalendarGrid } from "./calendar-grid";
import { DayPanel } from "./day-panel";
import { useCalendarData } from "@/lib/api/calendar";
import type { CalendarDayData } from "@/lib/api/calendar";

export function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  const monthKey = format(currentMonth, "yyyy-MM");
  const { data: calendarData, isLoading } = useCalendarData(monthKey);

  const selectedDayData: CalendarDayData | undefined = useMemo(() => {
    if (!selectedDate || !calendarData) return undefined;
    const key = format(selectedDate, "yyyy-MM-dd");
    return calendarData[key];
  }, [selectedDate, calendarData]);

  return (
    <div className="space-y-4">
      <CalendarHeader
        currentMonth={currentMonth}
        onPrevMonth={() => setCurrentMonth((m) => subMonths(m, 1))}
        onNextMonth={() => setCurrentMonth((m) => addMonths(m, 1))}
        onToday={() => {
          setCurrentMonth(startOfMonth(new Date()));
          setSelectedDate(new Date());
        }}
      />

      {isLoading ? (
        <div className="flex h-[400px] items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading calendar...</p>
        </div>
      ) : (
        <CalendarGrid
          currentMonth={currentMonth}
          selectedDate={selectedDate}
          calendarData={calendarData || {}}
          onSelectDate={setSelectedDate}
        />
      )}

      {selectedDate && (
        <DayPanel
          date={selectedDate}
          dayData={selectedDayData || { todos: [], journals: [], habitEntries: [] }}
        />
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/pwa/components/calendar/calendar-view.tsx
git commit -m "feat(pwa): add CalendarView main container component"
```

---

## Task 9: Frontend — Calendar Page & Navigation

**Files:**
- Create: `apps/pwa/app/[shortId]/calendar/page.tsx`
- Modify: `apps/pwa/app/[shortId]/layout.tsx`

**Step 1: Create the calendar page**

```tsx
// apps/pwa/app/[shortId]/calendar/page.tsx
"use client";

import { CalendarView } from "@/components/calendar/calendar-view";

export default function CalendarPage() {
  return (
    <div className="p-4">
      <CalendarView />
    </div>
  );
}
```

**Step 2: Add Calendar to sidebar navigation**

Open `apps/pwa/app/[shortId]/layout.tsx`. Find the `navItems` array:

```typescript
const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/todos", label: "Todos", icon: CheckSquare },
  // ...
];
```

Add the Calendar item between Dashboard and Todos:

```typescript
import { CalendarDays } from "lucide-react";  // Add to imports

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/todos", label: "Todos", icon: CheckSquare },
  // ...rest stays the same
];
```

**Step 3: Verify the frontend compiles**

```bash
cd apps/pwa && bun run build
```

Expected: Build succeeds.

**Step 4: Commit**

```bash
git add apps/pwa/app/\[shortId\]/calendar/page.tsx apps/pwa/app/\[shortId\]/layout.tsx
git commit -m "feat(pwa): add calendar page and sidebar navigation"
```

---

## Task 10: Integration — Wire Up CreateTodoDialog defaultDueDate

**Files:**
- Modify: `apps/pwa/components/todos/create-todo-dialog.tsx`
- Modify: `apps/pwa/components/calendar/day-panel.tsx`

**Step 1: Add defaultDueDate prop to CreateTodoDialog**

In `apps/pwa/components/todos/create-todo-dialog.tsx`:

Add `defaultDueDate?: string` to the props interface:

```typescript
interface CreateTodoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listId: string;
  defaultDueDate?: string;
}
```

Change the dueDate state initialization:

```typescript
const [dueDate, setDueDate] = useState(defaultDueDate || "");
```

Add a `useEffect` to sync when `defaultDueDate` changes (e.g., user selects a different day):

```typescript
import { useState, useEffect } from "react";

// Inside the component:
useEffect(() => {
  if (open && defaultDueDate) {
    setDueDate(defaultDueDate);
  }
}, [open, defaultDueDate]);
```

**Step 2: Pass defaultDueDate from DayPanel**

In `apps/pwa/components/calendar/day-panel.tsx`, update the CreateTodoDialog usage:

```tsx
<CreateTodoDialog
  open={showCreateTodo}
  onOpenChange={setShowCreateTodo}
  listId={defaultList.id}
  defaultDueDate={dateStr}
/>
```

**Step 3: Commit**

```bash
git add apps/pwa/components/todos/create-todo-dialog.tsx apps/pwa/components/calendar/day-panel.tsx
git commit -m "feat(pwa): wire up defaultDueDate prop for calendar quick-add"
```

---

## Task 11: Integration — Handle journal new page date param

**Files:**
- Modify: `apps/pwa/app/[shortId]/journal/new/page.tsx`

**Step 1: Read the date query param**

Check the existing journal new page. If it doesn't already read a `date` query param, add support for it:

```typescript
// In the journal new page component, read the search param:
import { useSearchParams } from "next/navigation";

const searchParams = useSearchParams();
const dateParam = searchParams.get("date");

// Use dateParam as the initial date value when creating the journal
```

This ensures clicking "+ New Journal" from the calendar pre-fills the journal date.

**Step 2: Commit**

```bash
git add apps/pwa/app/\[shortId\]/journal/new/page.tsx
git commit -m "feat(pwa): support date query param in journal new page"
```

---

## Task 12: Smoke Test & Polish

**Step 1: Start the dev servers**

```bash
bun run dev
```

**Step 2: Manual verification checklist**

- [ ] Navigate to Calendar page from sidebar
- [ ] Month grid renders with correct days
- [ ] Prev/Next month navigation works
- [ ] "Today" button jumps to current month and selects today
- [ ] Days with todos show blue dot
- [ ] Days with journals show green dot
- [ ] Days with habit entries show orange dot
- [ ] Clicking a day shows the day panel
- [ ] Day panel shows todos with toggle, priority badges
- [ ] Day panel shows journal entries as links
- [ ] Day panel shows habit entries with completion status
- [ ] "+ Add Todo" opens dialog with due date pre-filled
- [ ] "+ New Journal" navigates to journal/new with date param
- [ ] Today's cell has distinct highlight
- [ ] Adjacent month days appear faded
- [ ] Mobile responsive (cells shrink, panel full-width)

**Step 3: Fix any issues found during testing**

**Step 4: Final commit**

```bash
git add -A
git commit -m "polish: calendar feature refinements"
```
