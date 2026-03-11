# Calendar Feature Design

## Overview

A unified calendar page showing all dated items (todos by due date, journal entries, habit completions) in a month-grid view with colored dot indicators and an expandable day detail panel.

## Decisions

- **Approach**: Custom calendar component built with Tailwind CSS grid (no external calendar library)
- **View**: Month view only
- **Day interaction**: Expandable panel below calendar showing day details
- **Quick actions**: Create todo (pre-filled due date) and new journal entry from day panel
- **Visual indicators**: Colored dots per entity type (blue=todos, green=journals, orange=habits)

## Data Layer

### API Endpoint

```
GET /workspaces/:workspaceId/calendar?month=2026-03
```

Returns items grouped by ISO date string for the requested month (including overflow days from adjacent months visible in the grid):

```typescript
interface CalendarResponse {
  [date: string]: {
    todos: Array<{
      id: string;
      title: string;
      status: string;
      priority: string;
      dueDate: string;
      listId: string;
    }>;
    journals: Array<{ id: string; title: string; date: string }>;
    habitEntries: Array<{
      id: string;
      habitId: string;
      habitName: string;
      completed: boolean;
      date: string;
    }>;
  };
}
```

### Backend Module

New `calendar` module in NestJS that queries across existing todo, journal, and habit-entry repositories. No new database collections or schema changes.

- `CalendarService.getMonthData(workspaceId, startDate, endDate)` — aggregates from existing repos
- `CalendarController` — single GET endpoint with `month` query param
- Date range includes a few days before/after the month for the grid overflow

### Offline Support

When offline, query Dexie directly:

- `db.todos.where('dueDate').between(startDate, endDate)`
- `db.journals.where('date').between(startDate, endDate)`
- `db.habitEntries.where('date').between(startDate, endDate)`

Uses existing `useOfflineQuery` hook pattern. No visual difference when offline.

## UI Design

### Page Route

`/[shortId]/calendar` — new page in workspace navigation.

### Layout

```
┌──────────────────────────────────────────────┐
│  ◀  March 2026  ▶          [Today]           │
├──────────────────────────────────────────────┤
│  Sun   Mon   Tue   Wed   Thu   Fri   Sat     │
├──────────────────────────────────────────────┤
│  1     2     3     4     5     6     7        │
│  ●○         ●                ○               │
├──────────────────────────────────────────────┤
│  8     9     10    11    12    13    14       │
│        ●●          ○                         │
├──────────────────────────────────────────────┤
│  ...                                         │
├──────────────────────────────────────────────┤
│ ▼ Selected Day: March 9, 2026                │
│ ┌────────────────────────────────────────┐   │
│ │ ● Todos (2)                            │   │
│ │   ☐ Fix login bug [high] — Inbox       │   │
│ │   ☐ Write tests [medium] — Sprint 1    │   │
│ │                                        │   │
│ │ ○ Journal                              │   │
│ │   (none)                               │   │
│ │                                        │   │
│ │ ◆ Habits                               │   │
│ │   ✓ Read 30min  ✗ Exercise             │   │
│ │                                        │   │
│ │ [+ Add Todo]  [+ New Journal]          │   │
│ └────────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

### Behaviors

- **Month navigation**: Prev/Next arrows + "Today" button to jump to current month
- **Dot indicators**: Blue dot = todo, green dot = journal, orange dot = habit entry. One dot per type max.
- **Today highlight**: Current date cell gets a distinct background/ring
- **Selected day**: Click highlights the cell and expands the day panel below
- **Day panel items**: Todos show status checkbox, title, priority badge, list name. Journals show title. Habits show name + completion status.
- **Quick actions**: "+ Add Todo" opens CreateTodoDialog with dueDate pre-filled. "+ New Journal" navigates to `/journal/new?date=YYYY-MM-DD`.
- **Faded days**: Days from adjacent months shown in lighter/muted text
- **Mobile**: Calendar cells shrink; day panel becomes full-width below the grid

## Component Architecture

### Frontend

```
apps/pwa/
├── app/[shortId]/calendar/
│   └── page.tsx              # Calendar page
├── components/calendar/
│   ├── calendar-view.tsx     # Main container (state, data fetching)
│   ├── calendar-grid.tsx     # Month grid (7-col CSS grid)
│   ├── calendar-cell.tsx     # Day cell (number + dots)
│   ├── calendar-header.tsx   # Month/year + nav arrows + Today button
│   └── day-panel.tsx         # Expandable detail panel for selected day
```

### Backend

```
apps/api/src/modules/calendar/
├── calendar.module.ts        # NestJS module
├── calendar.controller.ts    # GET endpoint
└── calendar.service.ts       # Aggregation across repos
```

### Navigation

Add "Calendar" to sidebar between "Dashboard" and "Todos" using `CalendarDays` icon from lucide-react.

### Data Flow

1. `calendar-view.tsx` uses `useOfflineQuery` to fetch data for current month
2. Passes day data to `calendar-grid` → `calendar-cell` components
3. Selected day state via `useState` in `calendar-view`
4. Day click renders `day-panel` with items for that date
5. Quick-add actions reuse existing `CreateTodoDialog` and journal navigation

### API Hook

```typescript
// lib/api/calendar.ts
function useCalendarData(workspaceId: string, month: string) {
  return useOfflineQuery({
    queryKey: ["calendar", workspaceId, month],
    queryFn: () =>
      api.get(`/workspaces/${workspaceId}/calendar?month=${month}`),
    offlineFn: () => getCalendarDataFromDexie(workspaceId, month),
  });
}
```
