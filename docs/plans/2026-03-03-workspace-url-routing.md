# Workspace URL-based Routing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace store-based workspace routing with URL-based `/{slug}/...` routing for multi-tab support and shareable URLs.

**Architecture:** Dynamic `[slug]` route at root level fetches workspace by slug and provides it via React context. Middleware distinguishes static routes from workspace slugs. All API hooks read workspace ID from context instead of Zustand store.

**Tech Stack:** Next.js App Router, React Context, Zustand (sidebar state only), TanStack React Query

---

### Task 1: Create workspace context hook

**Files:**
- Create: `apps/pwa/lib/workspace-context.tsx`

**Step 1: Write the workspace context**

Replace the existing unused file with a minimal context provider + hook:

```tsx
"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Workspace } from "@repo/core/types";

interface WorkspaceCtx {
  workspace: Workspace;
}

const WorkspaceContext = createContext<WorkspaceCtx | null>(null);

export function useWorkspace(): WorkspaceCtx {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

export function WorkspaceProvider({ workspace, children }: { workspace: Workspace; children: ReactNode }) {
  return (
    <WorkspaceContext.Provider value={{ workspace }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
```

Note: This is intentionally simple — no fetching logic. The layout does the fetch and passes the workspace object down.

**Step 2: Commit**

```bash
git add apps/pwa/lib/workspace-context.tsx
git commit -m "feat: rewrite workspace context as simple provider"
```

---

### Task 2: Create `[slug]/layout.tsx` and move dashboard pages

**Files:**
- Create: `apps/pwa/app/[slug]/layout.tsx`
- Move: `apps/pwa/app/(dashboard)/page.tsx` → `apps/pwa/app/[slug]/dashboard/page.tsx`
- Move: `apps/pwa/app/(dashboard)/todos/page.tsx` → `apps/pwa/app/[slug]/todos/page.tsx`
- Move: `apps/pwa/app/(dashboard)/todos/[listId]/page.tsx` → `apps/pwa/app/[slug]/todos/[listId]/page.tsx`
- Move: `apps/pwa/app/(dashboard)/journal/page.tsx` → `apps/pwa/app/[slug]/journal/page.tsx`
- Move: `apps/pwa/app/(dashboard)/journal/new/page.tsx` → `apps/pwa/app/[slug]/journal/new/page.tsx`
- Move: `apps/pwa/app/(dashboard)/journal/[id]/page.tsx` → `apps/pwa/app/[slug]/journal/[id]/page.tsx`
- Move: `apps/pwa/app/(dashboard)/habits/page.tsx` → `apps/pwa/app/[slug]/habits/page.tsx`
- Move: `apps/pwa/app/(dashboard)/settings/page.tsx` → `apps/pwa/app/[slug]/settings/page.tsx`
- Delete: `apps/pwa/app/(dashboard)/layout.tsx`
- Delete: `apps/pwa/app/(dashboard)/` (entire directory after moves)

**Step 1: Create `[slug]/layout.tsx`**

Based on the existing `(dashboard)/layout.tsx`, but:
- Fetches workspace by slug from URL params
- Wraps children in `WorkspaceProvider`
- Removes Zustand `activeWorkspaceId` guard
- Navigation links use `/${slug}/...` prefix

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useAutoSync } from "@repo/offline/hooks";
import { cn } from "@/lib/utils";
import { syncAll } from "@/lib/offline";
import { OfflineIndicator } from "@/components/shared/offline-indicator";
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { WorkspaceProvider } from "@/lib/workspace-context";
import type { Workspace } from "@repo/core/types";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "Home" },
  { href: "/todos", label: "Todos", icon: "CheckSquare" },
  { href: "/journal", label: "Journal", icon: "BookOpen" },
  { href: "/habits", label: "Habits", icon: "Target" },
  { href: "/settings", label: "Settings", icon: "Settings" },
];

// NavIcon component — same as existing, copy from (dashboard)/layout.tsx

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ slug: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const clearUser = useAuthStore((s) => s.clearUser);
  const user = useAuthStore((s) => s.user);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  const stableSyncAll = useCallback(() => syncAll(), []);
  useAutoSync(stableSyncAll, 60_000);

  useEffect(() => {
    if (!params.slug) return;
    let cancelled = false;

    apiClient
      .get<Workspace>(`/workspaces/by-slug/${params.slug}`)
      .then((res) => {
        if (cancelled) return;
        setWorkspace(res.data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        router.replace("/workspaces");
      });

    return () => { cancelled = true; };
  }, [params.slug, router]);

  async function handleLogout() {
    try { await apiClient.post("/auth/logout"); } catch { /* ignore */ }
    clearUser();
    localStorage.removeItem("auth-storage");
    localStorage.removeItem("workspace-storage");
    document.cookie = "logged_in=; path=/; max-age=0";
    router.push("/login");
  }

  if (loading || !workspace) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading workspace...</p>
      </div>
    );
  }

  const slug = params.slug;

  return (
    <WorkspaceProvider workspace={workspace}>
      <div className="flex min-h-screen bg-background">
        {/* Sidebar — same UI as before, but links prefixed with /${slug} */}
        <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:block">
          <div className="flex h-14 items-center border-b border-sidebar-border px-6">
            <Link href={`/${slug}/dashboard`} className="text-lg font-bold text-sidebar-foreground">
              Meridian
            </Link>
          </div>
          <nav className="space-y-1 p-3">
            {navItems.map((item) => {
              const fullHref = `/${slug}${item.href}`;
              return (
                <Link
                  key={item.href}
                  href={fullHref}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    pathname === fullHref || pathname.startsWith(fullHref + "/")
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <NavIcon name={item.icon} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main content — same as before */}
        <div className="flex flex-1 flex-col">
          <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-muted-foreground md:hidden">Meridian</span>
            </div>
            <div className="flex items-center gap-3">
              <OfflineIndicator />
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </div>
              <button
                onClick={handleLogout}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Sign out
              </button>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
```

**Step 2: Move page files**

```bash
mkdir -p apps/pwa/app/\[slug\]/dashboard
mkdir -p apps/pwa/app/\[slug\]/todos/\[listId\]
mkdir -p apps/pwa/app/\[slug\]/journal/new
mkdir -p apps/pwa/app/\[slug\]/journal/\[id\]
mkdir -p apps/pwa/app/\[slug\]/habits
mkdir -p apps/pwa/app/\[slug\]/settings

cp apps/pwa/app/\(dashboard\)/page.tsx apps/pwa/app/\[slug\]/dashboard/page.tsx
cp apps/pwa/app/\(dashboard\)/todos/page.tsx apps/pwa/app/\[slug\]/todos/page.tsx
cp apps/pwa/app/\(dashboard\)/todos/\[listId\]/page.tsx apps/pwa/app/\[slug\]/todos/\[listId\]/page.tsx
cp apps/pwa/app/\(dashboard\)/journal/page.tsx apps/pwa/app/\[slug\]/journal/page.tsx
cp apps/pwa/app/\(dashboard\)/journal/new/page.tsx apps/pwa/app/\[slug\]/journal/new/page.tsx
cp apps/pwa/app/\(dashboard\)/journal/\[id\]/page.tsx apps/pwa/app/\[slug\]/journal/\[id\]/page.tsx
cp apps/pwa/app/\(dashboard\)/habits/page.tsx apps/pwa/app/\[slug\]/habits/page.tsx
cp apps/pwa/app/\(dashboard\)/settings/page.tsx apps/pwa/app/\[slug\]/settings/page.tsx
```

**Step 3: Delete old `(dashboard)` directory**

```bash
rm -rf apps/pwa/app/\(dashboard\)
```

**Step 4: Commit**

```bash
git add apps/pwa/app/\[slug\] && git add -u
git commit -m "feat: create [slug] layout and move dashboard pages"
```

---

### Task 3: Update API hooks to use workspace context

**Files:**
- Modify: `apps/pwa/lib/api/todos.ts`
- Modify: `apps/pwa/lib/api/journals.ts`
- Modify: `apps/pwa/lib/api/habits.ts`

For all three files, apply the same pattern change:

**Before (each hook):**
```tsx
import { useWorkspaceStore } from "@/stores/workspace-store";

export function useTodoLists() {
  const { activeWorkspaceId } = useWorkspaceStore();
  // ...queryKey: ["todoLists", activeWorkspaceId],
  // ...workspacePath("/todo-lists")
  // ...enabled: !!activeWorkspaceId,
}
```

**After (each hook):**
```tsx
import { useWorkspace } from "@/lib/workspace-context";

export function useTodoLists() {
  const { workspace } = useWorkspace();
  // ...queryKey: ["todoLists", workspace.id],
  // ...`/workspaces/${workspace.id}/todo-lists`
  // remove `enabled: !!activeWorkspaceId` — workspace is always present inside [slug] layout
}
```

Changes per file:
1. Replace `import { useWorkspaceStore } from "@/stores/workspace-store"` with `import { useWorkspace } from "@/lib/workspace-context"`
2. Replace `import apiClient, { workspacePath } from "@/lib/api-client"` with `import apiClient from "@/lib/api-client"`
3. Replace `const { activeWorkspaceId } = useWorkspaceStore()` with `const { workspace } = useWorkspace()`
4. Replace `workspacePath("/...")` with `` `/workspaces/${workspace.id}/...` ``
5. Replace `activeWorkspaceId` in queryKeys with `workspace.id`
6. Remove `enabled: !!activeWorkspaceId` (workspace is guaranteed by layout)

**Step 1: Update `todos.ts`**

Apply all replacements listed above.

**Step 2: Update `journals.ts`**

Apply all replacements listed above.

**Step 3: Update `habits.ts`**

Apply all replacements listed above.

**Step 4: Commit**

```bash
git add apps/pwa/lib/api/
git commit -m "refactor: API hooks use workspace context instead of store"
```

---

### Task 4: Update settings components

**Files:**
- Modify: `apps/pwa/components/settings/workspace-settings.tsx`
- Modify: `apps/pwa/components/settings/members-list.tsx`

Same pattern as Task 3:
1. Replace `useWorkspaceStore` with `useWorkspace`
2. Replace `activeWorkspaceId` with `workspace.id`
3. Remove `if (!activeWorkspaceId)` guards — workspace guaranteed by layout

**Step 1: Update `workspace-settings.tsx`**

- Replace `import { useWorkspaceStore } from "@/stores/workspace-store"` → `import { useWorkspace } from "@/lib/workspace-context"`
- Replace `const { activeWorkspaceId } = useWorkspaceStore()` → `const { workspace } = useWorkspace()`
- Replace all `activeWorkspaceId` → `workspace.id`
- Remove the `if (!activeWorkspaceId)` early return

**Step 2: Update `members-list.tsx`**

Same replacements as workspace-settings.tsx.

**Step 3: Commit**

```bash
git add apps/pwa/components/settings/
git commit -m "refactor: settings components use workspace context"
```

---

### Task 5: Update hardcoded links in dashboard components

**Files:**
- Modify: `apps/pwa/components/dashboard/today-todos.tsx`
- Modify: `apps/pwa/components/dashboard/habit-summary.tsx`
- Modify: `apps/pwa/components/dashboard/recent-journals.tsx`
- Modify: `apps/pwa/components/journal/journal-list.tsx`
- Modify: `apps/pwa/components/todos/todo-list-sidebar.tsx`

All these components have hardcoded links like `href="/todos"` or `href="/journal"`. They need the workspace slug prefix.

**Approach:** Add `useWorkspace` to each component and prefix links with `/${workspace.slug}`.

**Step 1: Update `today-todos.tsx`**

Add `import { useWorkspace } from "@/lib/workspace-context"` and `const { workspace } = useWorkspace()`.
Change `href="/todos"` → `` href={`/${workspace.slug}/todos`} ``

**Step 2: Update `habit-summary.tsx`**

Same pattern. Change `href="/habits"` → `` href={`/${workspace.slug}/habits`} ``

**Step 3: Update `recent-journals.tsx`**

Change `href="/journal"` → `` href={`/${workspace.slug}/journal`} ``
Change `` href={`/journal/${journal.id}`} `` → `` href={`/${workspace.slug}/journal/${journal.id}`} ``

**Step 4: Update `journal-list.tsx`**

Change `` href={`/journal/${journal.id}`} `` → `` href={`/${workspace.slug}/journal/${journal.id}`} ``

**Step 5: Update `todo-list-sidebar.tsx`**

Change `href="/todos"` → `` href={`/${workspace.slug}/todos`} ``

**Step 6: Update journal page files with `router.push` calls**

In `apps/pwa/app/[slug]/journal/new/page.tsx`:
- Add `import { useWorkspace } from "@/lib/workspace-context"` and `const { workspace } = useWorkspace()`
- Change `router.push("/journal")` → `` router.push(`/${workspace.slug}/journal`) ``

In `apps/pwa/app/[slug]/journal/[id]/page.tsx`:
- Same pattern: `router.push("/journal")` → `` router.push(`/${workspace.slug}/journal`) ``

**Step 7: Commit**

```bash
git add apps/pwa/components/ apps/pwa/app/\[slug\]/journal/
git commit -m "refactor: prefix all internal links with workspace slug"
```

---

### Task 6: Update workspace picker and middleware

**Files:**
- Modify: `apps/pwa/app/workspaces/page.tsx`
- Modify: `apps/pwa/proxy.ts`
- Modify: `apps/pwa/app/page.tsx`

**Step 1: Update workspace picker**

In `selectWorkspace()`: change `router.push("/")` → `` router.push(`/${ws.slug}/dashboard`) ``
In `handleCreate()`: change `router.push("/")` → `` router.push(`/${res.data.slug}/dashboard`) ``
Remove `import { useWorkspaceStore }` and `setActiveWorkspace` calls — no longer needed.

**Step 2: Update middleware**

Replace `proxy.ts`:

```tsx
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const STATIC_ROUTES = new Set(["login", "register", "workspaces", "_next", "api"]);
const STATIC_FILES = new Set(["favicon.ico", "manifest.json", "sw.js"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoggedIn = request.cookies.get("logged_in")?.value === "1";

  // Let static files through
  const fileName = pathname.split("/").pop() || "";
  if (STATIC_FILES.has(fileName) || pathname.startsWith("/_next/") || pathname.startsWith("/icons/")) {
    return NextResponse.next();
  }

  const firstSegment = pathname.split("/")[1] || "";

  // Root → redirect to /workspaces
  if (pathname === "/") {
    return isLoggedIn
      ? NextResponse.redirect(new URL("/workspaces", request.url))
      : NextResponse.redirect(new URL("/login", request.url));
  }

  // Auth pages: redirect logged-in users to /workspaces
  if (firstSegment === "login" || firstSegment === "register") {
    if (isLoggedIn) return NextResponse.redirect(new URL("/workspaces", request.url));
    return NextResponse.next();
  }

  // Static routes: pass through
  if (STATIC_ROUTES.has(firstSegment)) {
    if (!isLoggedIn && firstSegment === "workspaces") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  // Everything else is a workspace slug — require auth
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)"],
};
```

**Step 3: Update root page**

Change `apps/pwa/app/page.tsx` to redirect to `/workspaces`:

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/workspaces");
}
```

**Step 4: Commit**

```bash
git add apps/pwa/app/workspaces/page.tsx apps/pwa/proxy.ts apps/pwa/app/page.tsx
git commit -m "feat: update workspace picker and middleware for slug routing"
```

---

### Task 7: Update offline sync

**Files:**
- Modify: `apps/pwa/lib/offline.ts`
- Modify: `apps/pwa/lib/api-client.ts`

The offline `syncAll()` function currently uses `getWorkspaceId()` from localStorage. Since offline sync runs in background (not inside React component tree), it can't use `useWorkspace()`. Keep `getWorkspaceId()` in api-client but only for offline use.

**Step 1: Simplify `api-client.ts`**

Remove `workspacePath` export (no longer used by hooks). Keep `getWorkspaceId` for offline sync only.

```tsx
import { createApiClient } from "@repo/core/api/client";
import { LocalStorageAdapter } from "@repo/core/platform";

const storage = new LocalStorageAdapter();

const apiClient = createApiClient({
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1",
  authStrategy: "cookie",
  storage,
  onLogout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth-storage");
      localStorage.removeItem("workspace-storage");
      document.cookie = "logged_in=; path=/; max-age=0";
      window.location.href = "/login";
    }
  },
});

/** Read workspace ID from localStorage — used only by offline sync */
export function getWorkspaceId(): string {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("workspace-storage");
    if (stored) {
      const parsed = JSON.parse(stored) as { state?: { activeWorkspaceId?: string } };
      return parsed?.state?.activeWorkspaceId || "";
    }
  }
  return "";
}

export default apiClient;
```

**Step 2: Commit**

```bash
git add apps/pwa/lib/api-client.ts
git commit -m "refactor: remove workspacePath export, keep getWorkspaceId for offline"
```

---

### Task 8: Simplify workspace store

**Files:**
- Modify: `packages/core/src/stores/workspace-store.ts`
- Modify: `apps/pwa/stores/workspace-store.ts`

The store no longer needs to be the source of truth for active workspace. However, `getWorkspaceId()` in offline.ts still reads from it, so keep `activeWorkspaceId` persisted but remove the `onSwitch` callback parameter (unused).

Actually — re-evaluate: the store's `activeWorkspaceId` is still read by `getWorkspaceId()` for offline sync. And the `[slug]/layout.tsx` should set it when workspace loads so offline sync knows which workspace to sync. Keep the store minimal but functional.

**Step 1: Update `[slug]/layout.tsx` to sync store**

In the `useEffect` that fetches workspace, after `setWorkspace(res.data)`:

```tsx
import { useWorkspaceStore } from "@/stores/workspace-store";

// Inside component:
const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);

// In useEffect after successful fetch:
setActiveWorkspace(res.data.id);
```

This ensures offline sync still works.

**Step 2: Remove `clearWorkspace` and `onSwitch` from store**

Simplify `packages/core/src/stores/workspace-store.ts`:

```tsx
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StorageAdapter } from '@repo/core/platform';

export interface WorkspaceState {
  activeWorkspaceId: string | null;
  sidebarOpen: boolean;
  mobileSidebarOpen: boolean;
  setActiveWorkspace: (workspaceId: string) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setMobileSidebarOpen: (open: boolean) => void;
}

export function createWorkspaceStore(storage: StorageAdapter) {
  return create<WorkspaceState>()(
    persist(
      (set) => ({
        activeWorkspaceId: null,
        sidebarOpen: true,
        mobileSidebarOpen: false,
        setActiveWorkspace: (workspaceId: string) => set({ activeWorkspaceId: workspaceId }),
        toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
        setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
        setMobileSidebarOpen: (open: boolean) => set({ mobileSidebarOpen: open }),
      }),
      {
        name: 'workspace-storage',
        storage: createJSONStorage(() => ({
          getItem: (key: string) => storage.getItem(key),
          setItem: (key: string, value: string) => { void storage.setItem(key, value); },
          removeItem: (key: string) => { void storage.removeItem(key); },
        })),
        partialize: (state) => ({ activeWorkspaceId: state.activeWorkspaceId, sidebarOpen: state.sidebarOpen }),
      },
    ),
  );
}
```

**Step 3: Commit**

```bash
git add packages/core/src/stores/workspace-store.ts apps/pwa/app/\[slug\]/layout.tsx
git commit -m "refactor: simplify workspace store, sync from layout"
```

---

### Task 9: Delete dead code

**Files:**
- Delete: `packages/core/src/api/workspaces.ts`
- Delete: `apps/api/src/common/guards/workspace-member.guard.ts`

**Step 1: Check that `createWorkspacesApi` is only used in `offline.ts`**

It IS used in `offline.ts`. Don't delete `packages/core/src/api/workspaces.ts` — offline sync needs it.

Check `WorkspaceMemberGuard`: only defined in its own file, never imported elsewhere (confirmed by grep). Safe to delete.

**Step 2: Delete the guard**

```bash
rm apps/api/src/common/guards/workspace-member.guard.ts
```

**Step 3: Check for any imports of the deleted guard**

Already confirmed: no imports exist.

**Step 4: Commit**

```bash
git add -u
git commit -m "chore: delete unused WorkspaceMemberGuard"
```

---

### Task 10: Verify build

**Step 1: Run TypeScript check**

```bash
cd apps/pwa && bunx tsc --noEmit
```

Fix any type errors.

**Step 2: Run dev server**

```bash
bun dev --filter=pwa
```

Verify:
- `/` redirects to `/workspaces`
- `/workspaces` shows workspace list
- Selecting a workspace navigates to `/{slug}/dashboard`
- Sidebar links work: `/{slug}/todos`, `/{slug}/journal`, etc.
- Creating a workspace navigates to `/{new-slug}/dashboard`
- Opening two workspaces in separate tabs works independently

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: resolve build issues from workspace routing migration"
```
