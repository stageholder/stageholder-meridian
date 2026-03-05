# List Selector + Inbox View Design

## Overview
Add a list selector to the create todo dialog and transform the default `/todos` page into a true inbox that aggregates todos from all lists.

## 1. Create Todo Dialog — List Selector
- Add a `Select` dropdown above the title field populated from `useTodoLists()`
- Shows list name + color dot per option
- `listId` prop becomes the default selection; user can change it
- Quick add inline input stays scoped to its list (no selector)

## 2. Inbox View — `/todos` page
- Default `/todos` page shows all non-done todos across all lists, grouped by list
- Each group has a header with list name + color dot
- New `useAllTodos()` hook uses existing paginated `GET /workspaces/:id/todos` endpoint
- Individual list pages (`/todos/[listId]`) remain unchanged
- Sidebar highlights "Inbox" on `/todos`, list name on `/todos/[listId]`

## 3. Dashboard Fix
- `TodayTodos` switches from `useTodos(firstListId)` to `useAllTodos()` to pull from all lists

## 4. No Backend Changes
- Existing paginated workspace-level endpoint already returns all todos
