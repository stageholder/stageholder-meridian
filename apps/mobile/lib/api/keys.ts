// apps/mobile/lib/api/keys.ts
//
// Central query-key factory. Every hook in this folder imports keys from
// here instead of writing inline tuples — that way invalidations and
// optimistic-update lookups stay correct as the cache shape evolves.
//
// Convention follows the @tanstack/query maintainers' "query key factory"
// pattern. Each resource exposes:
//   - `.all`        broad invalidator (e.g. invalidate all todos)
//   - `.lists()`    list views
//   - `.list(args)` list view with filters/params
//   - `.details()`  detail views
//   - `.detail(id)` one specific detail
//
// Mirrors the PWA's nested-key shape (`["todos", listId]`) so the same
// mental model carries over.

export const todoKeys = {
  all: ["todos"] as const,
  lists: () => [...todoKeys.all, "list"] as const,
  list: (filters?: { listId?: string }) =>
    [...todoKeys.lists(), filters ?? {}] as const,
  details: () => [...todoKeys.all, "detail"] as const,
  detail: (id: string) => [...todoKeys.details(), id] as const,
};

export const todoListKeys = {
  all: ["todoLists"] as const,
  lists: () => [...todoListKeys.all, "list"] as const,
  detail: (id: string) => [...todoListKeys.all, "detail", id] as const,
};

export const habitKeys = {
  all: ["habits"] as const,
  lists: () => [...habitKeys.all, "list"] as const,
  list: () => [...habitKeys.lists(), {}] as const,
  details: () => [...habitKeys.all, "detail"] as const,
  detail: (id: string) => [...habitKeys.details(), id] as const,
  entries: (id: string) => [...habitKeys.detail(id), "entries"] as const,
  // Archived habits live in their own cache so the default list stays lean —
  // the server filters them out of /habits and surfaces them via ?archivedOnly.
  archived: () => [...habitKeys.all, "archived"] as const,
};

export const habitGroupKeys = {
  all: ["habitGroups"] as const,
};

export const journalKeys = {
  all: ["journals"] as const,
  lists: () => [...journalKeys.all, "list"] as const,
  list: (filters?: { startDate?: string; endDate?: string }) =>
    [...journalKeys.lists(), filters ?? {}] as const,
  details: () => [...journalKeys.all, "detail"] as const,
  detail: (id: string) => [...journalKeys.details(), id] as const,
  stats: () => [...journalKeys.all, "stats"] as const,
};
