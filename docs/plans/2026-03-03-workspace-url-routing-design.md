# Workspace URL-based Routing Design

## Problem

Current implementation stores active workspace ID in Zustand store and uses flat routes (`/`, `/todos`, etc.). This breaks multi-tab support, produces non-shareable URLs, and requires a fragile `useEffect` redirect guard.

Additionally, several files are dead code: `workspace-context.tsx` (never integrated), `WorkspaceMemberGuard` (never used), and `packages/core/src/api/workspaces.ts` (never imported by PWA).

## Solution

Move to industry-standard URL-based workspace routing: `/{slug}/dashboard`, `/{slug}/todos`, etc. The slug in the URL is the source of truth for which workspace is active.

## Route Structure

```
app/
  (auth)/
    login/page.tsx
    register/page.tsx
  workspaces/page.tsx
  [slug]/
    layout.tsx              # fetches workspace by slug, provides context, renders sidebar/header
    dashboard/page.tsx
    todos/page.tsx
    todos/[listId]/page.tsx
    journal/page.tsx
    journal/new/page.tsx
    journal/[id]/page.tsx
    habits/page.tsx
    settings/page.tsx
```

## Middleware

Update `proxy.ts` to distinguish static routes from workspace slugs:

- Static routes: `login`, `register`, `workspaces`, `_next`, `api`, `favicon.ico`, etc.
- Everything else: treated as a workspace slug, auth check applies
- Logged-in users hitting `/` redirect to `/workspaces`

## Workspace Context

`[slug]/layout.tsx` fetches workspace by slug via `GET /workspaces/by-slug/:slug`, provides it through React context. Children access workspace data via `useWorkspace()` hook exported from the layout file.

No separate `workspace-context.tsx` file — the layout is the provider.

## API Hooks Changes

All hooks (`useTodoLists`, `useJournals`, `useHabits`, etc.) change from:

- `useWorkspaceStore().activeWorkspaceId` + `workspacePath(path)`

To:

- `useWorkspace().workspace.id` + direct path construction

The `getWorkspaceId()` and `workspacePath()` helpers in `api-client.ts` are removed.

## Workspace Picker

`/workspaces` page `selectWorkspace()` changes from:

- `setActiveWorkspace(ws.id); router.push("/")`

To:

- `router.push("/${ws.slug}/dashboard")`

## Dead Code Removal

- `apps/pwa/lib/workspace-context.tsx` — replaced by layout context
- `apps/pwa/app/(dashboard)/` — entire directory replaced by `[slug]/`
- `packages/core/src/api/workspaces.ts` — never used
- `apps/api/src/common/guards/workspace-member.guard.ts` — never used
- `getWorkspaceId()` and `workspacePath()` from `api-client.ts`
- `activeWorkspaceId` from workspace store (keep sidebar state only)

## Unchanged

- Backend API — no modifications needed
- Page component JSX — same UI, different data source
- Sidebar/header UI — moved into `[slug]/layout.tsx`
