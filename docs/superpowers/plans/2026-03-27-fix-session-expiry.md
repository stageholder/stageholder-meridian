# Fix Session Expiry & Workspace Error Redirect

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the app from silently wiping user data and redirecting to login when returning after idle — handle session expiry gracefully.

**Architecture:** Five surgical fixes across frontend and backend. The API client's `silentRefresh` gets proper error propagation and returns a promise. Sync hooks await that promise before firing. The workspace layout distinguishes auth errors from real workspace errors. The backend adds a grace period for refresh token rotation. Session expiry preserves offline data.

**Tech Stack:** TypeScript, Axios interceptors, React hooks, NestJS/MongoDB, Sonner toast

---

## File Map

| File                                        | Action | Responsibility                                                                     |
| ------------------------------------------- | ------ | ---------------------------------------------------------------------------------- |
| `packages/core/src/api/client.ts`           | Modify | Fix silentRefresh error handling, return Promise, export `waitForRefresh()`        |
| `apps/pwa/hooks/use-session-keep-alive.ts`  | Modify | Await silentRefresh promise                                                        |
| `packages/offline/src/hooks/index.ts`       | Modify | `useSyncOnFocus` and `useAutoSync` accept + await a `waitForRefresh` function      |
| `apps/pwa/app/[shortId]/layout.tsx`         | Modify | Pass `waitForRefresh` to sync hooks, distinguish 401/403/network in fetchWorkspace |
| `apps/pwa/lib/logout.ts`                    | Modify | Add `sessionExpired()` that preserves IndexedDB                                    |
| `apps/pwa/lib/api-client.ts`                | Modify | Use `sessionExpired()` in onLogout callback                                        |
| `apps/api/src/modules/auth/auth.service.ts` | Modify | Grace period for previous refresh token hash                                       |
| `apps/api/src/modules/user/user.schema.ts`  | Modify | Add `prev_refresh_token_hash` and `prev_refresh_token_expires_at` fields           |

---

### Task 1: Fix `silentRefresh` error handling and return a Promise

**Files:**

- Modify: `packages/core/src/api/client.ts`

The core bug: `silentRefresh` swallows errors then calls `processQueue(null)` in `finally`, which resolves queued 401 requests without valid tokens. Fix: on failure, reject the queue. Also make `silentRefresh` return a Promise so callers can await it.

- [ ] **Step 1: Fix the `ApiClient` interface and module-level refresh tracking**

Change the interface and add a module-level promise for external consumers:

```ts
export interface ApiClient extends AxiosInstance {
  silentRefresh: () => Promise<void>;
}

let refreshPromise: Promise<void> | null = null;

export function waitForRefresh(): Promise<void> {
  return refreshPromise ?? Promise.resolve();
}
```

- [ ] **Step 2: Rewrite `silentRefresh` to propagate errors and expose the promise**

Replace the entire `silentRefresh` function (lines 129-158) with:

```ts
function silentRefresh(): Promise<void> {
  if (isRefreshing) return refreshPromise ?? Promise.resolve();
  isRefreshing = true;

  refreshPromise = (async () => {
    if (config.authStrategy === "bearer") {
      const refreshToken = await config.storage.getItem("refresh_token");
      if (!refreshToken) return;
      const res = await client.post("/auth/refresh", { refreshToken });
      await config.storage.setItem("access_token", res.data.accessToken);
      if (res.data.refreshToken) {
        await config.storage.setItem("refresh_token", res.data.refreshToken);
      }
    } else {
      await client.post("/auth/refresh");
    }
    processQueue(null);
    config.onRefreshSuccess?.();
  })()
    .catch((err) => {
      processQueue(err);
      throw err;
    })
    .finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });

  return refreshPromise;
}
```

Key changes from the old code:

- Returns a `Promise<void>` instead of `void`
- On failure: `processQueue(err)` rejects queued requests (was `processQueue(null)` which resolved them)
- Removes the duplicate `processQueue(null)` from `finally` — it's now only called on success path or error path, never both
- Stores the promise in `refreshPromise` so `waitForRefresh()` can expose it

- [ ] **Step 3: Verify the file compiles**

Run: `cd /Users/garda_dafi/Project/stageholder-meridian && npx turbo run check --filter=@repo/core`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/api/client.ts
git commit -m "fix: silentRefresh rejects queue on failure and returns a promise"
```

---

### Task 2: Sync hooks await token refresh before syncing

**Files:**

- Modify: `packages/offline/src/hooks/index.ts`
- Modify: `apps/pwa/hooks/use-session-keep-alive.ts`
- Modify: `apps/pwa/app/[shortId]/layout.tsx`

Add a `waitForRefresh` parameter to sync hooks so they wait for any in-flight token refresh before making API calls.

- [ ] **Step 1: Update `useSyncOnFocus` to accept and await `waitForRefresh`**

In `packages/offline/src/hooks/index.ts`, change the `useSyncOnFocus` function (lines 280-288):

```ts
export function useSyncOnFocus(
  syncFn: () => Promise<void>,
  options?: { waitForRefresh?: () => Promise<void> },
) {
  const { waitForRefresh } = options ?? {};

  useEffect(() => {
    const handleFocus = async () => {
      if (waitForRefresh) {
        try {
          await waitForRefresh();
        } catch {
          return;
        }
      }
      syncFn();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [syncFn, waitForRefresh]);
}
```

- [ ] **Step 2: Update `useAutoSync` to accept and await `waitForRefresh`**

In `packages/offline/src/hooks/index.ts`, update the `useAutoSync` options type and the `online` handler (lines 243-278):

```ts
export function useAutoSync(
  syncFn: () => Promise<void>,
  options: {
    intervalMs?: number;
    isOnline?: boolean;
    waitForRefresh?: () => Promise<void>;
  } = {},
) {
  const {
    intervalMs = 60000,
    isOnline: isOnlineOverride,
    waitForRefresh,
  } = options;
  const browserOnline = useNetworkStatus();
  const isOnline = isOnlineOverride ?? browserOnline;

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      syncFn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isOnline) return;

    syncFn();

    const handleOnline = async () => {
      if (waitForRefresh) {
        try {
          await waitForRefresh();
        } catch {
          return;
        }
      }
      syncFn();
    };
    window.addEventListener("online", handleOnline);

    const id = setInterval(() => {
      if (isOnline) syncFn();
    }, intervalMs);

    return () => {
      window.removeEventListener("online", handleOnline);
      clearInterval(id);
    };
  }, [isOnline, syncFn, intervalMs, waitForRefresh]);
}
```

- [ ] **Step 3: Wire `waitForRefresh` into the workspace layout**

In `apps/pwa/app/[shortId]/layout.tsx`, add the import and pass `waitForRefresh` to the sync hooks.

Add to imports (around line 47):

```ts
import apiClient, { getWorkspaceId } from "@/lib/api-client"; // already exists
```

Add a new import at the top of the file:

```ts
import { waitForRefresh } from "@repo/core/api/client";
```

Then update the hook calls (around lines 221-225):

```ts
useAutoSync(stableSyncAll, {
  intervalMs: syncIntervalMs,
  isOnline: heartbeatOnline,
  waitForRefresh,
});
useSyncOnFocus(stableSyncAll, { waitForRefresh });
```

- [ ] **Step 4: Verify compilation**

Run: `cd /Users/garda_dafi/Project/stageholder-meridian && npx turbo run check --filter=@repo/core --filter=@repo/offline --filter=pwa`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add packages/offline/src/hooks/index.ts apps/pwa/hooks/use-session-keep-alive.ts apps/pwa/app/[shortId]/layout.tsx
git commit -m "fix: sync hooks await token refresh before making API calls"
```

---

### Task 3: `fetchWorkspace` distinguishes error types

**Files:**

- Modify: `apps/pwa/app/[shortId]/layout.tsx`

Currently the `catch` block treats all errors as "redirect to /workspaces". Fix: 401 = do nothing (onLogout handles it), 403/404 = redirect, network = show retry.

- [ ] **Step 1: Add `fetchError` state**

In the `WorkspaceLayout` component, add a new state variable after the existing state declarations (around line 232):

```ts
const [fetchError, setFetchError] = useState<"not-found" | "network" | null>(
  null,
);
```

- [ ] **Step 2: Update the `fetchWorkspace` catch block**

Replace the `catch` block in the `fetchWorkspace` useEffect (lines 268-269) with:

```ts
      } catch (err: any) {
        if (cancelled) return;
        const status = err?.response?.status;
        if (status === 401) {
          // onLogout interceptor handles redirect — do nothing here
          return;
        }
        if (status === 403 || status === 404) {
          router.replace("/workspaces");
          return;
        }
        // Network error or unexpected — show retry
        setFetchError("network");
      } finally {
```

- [ ] **Step 3: Add a network error UI before the main render**

After the loading check (`if (loading) { ... }`) and before `if (!workspace) return null;` (around line 293-303), add:

```tsx
if (fetchError === "network") {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
      <p className="text-sm text-muted-foreground">
        Could not connect to the server.
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setFetchError(null);
          setLoading(true);
        }}
      >
        Try again
      </Button>
    </div>
  );
}
```

Note: The "Try again" works because setting `loading` back to `true` with `fetchError` cleared, combined with `shortId` being in the useEffect dependency array, will re-trigger the fetch. Actually we need to trigger the re-fetch explicitly. Add a `retryCount` state:

Add state (next to `fetchError`):

```ts
const [retryKey, setRetryKey] = useState(0);
```

Update the useEffect dependency array to include `retryKey`:

```ts
  }, [shortId, router, setActiveWorkspace, retryKey]);
```

Update the retry button:

```tsx
          onClick={() => {
            setFetchError(null);
            setLoading(true);
            setRetryKey((k) => k + 1);
          }}
```

- [ ] **Step 4: Verify compilation**

Run: `cd /Users/garda_dafi/Project/stageholder-meridian && npx turbo run check --filter=pwa`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add apps/pwa/app/[shortId]/layout.tsx
git commit -m "fix: fetchWorkspace distinguishes 401/403/network errors"
```

---

### Task 4: Add `sessionExpired()` that preserves offline data

**Files:**

- Modify: `apps/pwa/lib/logout.ts`
- Modify: `apps/pwa/lib/api-client.ts`

On session expiry, don't nuke IndexedDB — the user's unsynced data lives there. Only clear auth state. Show a toast.

- [ ] **Step 1: Add `sessionExpired` export to `logout.ts`**

Add at the end of `apps/pwa/lib/logout.ts`:

```ts
/**
 * Lightweight cleanup for automatic session expiry.
 * Preserves IndexedDB (unsynced data) — only clears auth state.
 */
export async function sessionExpired(): Promise<void> {
  // 1. Clear React Query cache — stale auth-dependent data
  try {
    const queryClient = getQueryClient();
    if (queryClient) {
      queryClient.clear();
    }
  } catch {
    // ignore
  }

  // 2. Clear auth localStorage
  localStorage.removeItem("auth-storage");
  localStorage.removeItem("workspace-storage");
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");

  // 3. Clear encryption key from memory
  useEncryptionStore.getState().lock();

  // 4. Clear cookies
  clearLoggedInFlag();
}
```

- [ ] **Step 2: Update `onLogout` in `api-client.ts` to use `sessionExpired` + toast**

Replace the `onLogout` callback in `apps/pwa/lib/api-client.ts` (lines 12-19):

```ts
  onLogout: async () => {
    if (typeof window !== "undefined") {
      const { sessionExpired } = await import("@/lib/logout");
      await sessionExpired();
      // Dynamic import to avoid circular dependency
      const { toast } = await import("sonner");
      toast.error("Session expired", {
        description: "Please sign in again.",
      });
      window.location.href = "/login";
    }
  },
```

- [ ] **Step 3: Verify compilation**

Run: `cd /Users/garda_dafi/Project/stageholder-meridian && npx turbo run check --filter=pwa`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add apps/pwa/lib/logout.ts apps/pwa/lib/api-client.ts
git commit -m "fix: session expiry preserves IndexedDB and shows toast"
```

---

### Task 5: Backend refresh token grace period

**Files:**

- Modify: `apps/api/src/modules/user/user.schema.ts`
- Modify: `apps/api/src/modules/auth/auth.service.ts`

When a refresh token is rotated, keep the previous hash valid for 30 seconds. This handles the race where two concurrent requests both try to refresh with the same token.

- [ ] **Step 1: Add previous token fields to the User schema**

In `apps/api/src/modules/user/user.schema.ts`, add two new fields after line 45 (`refresh_token_expires_at`):

```ts
  @Prop({ type: String }) prev_refresh_token_hash: string;
  @Prop({ type: Date }) prev_refresh_token_expires_at: Date;
```

Also add `prev_refresh_token_hash` to the `toJSON.transform` delete list (around line 14):

```ts
delete ret.prev_refresh_token_hash;
```

- [ ] **Step 2: Update `storeRefreshToken` to keep the previous hash**

In `apps/api/src/modules/auth/auth.service.ts`, replace the `storeRefreshToken` method (lines 319-331):

```ts
  private static readonly GRACE_PERIOD_SECONDS = 30;

  private async storeRefreshToken(userId: string, hash: string): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshExpiresIn);

    // Fetch current hash so we can keep it as a grace-period fallback
    const current = await this.userModel
      .findById(userId)
      .select("refresh_token_hash")
      .lean();

    const graceExpiry = new Date(
      Date.now() + AuthService.GRACE_PERIOD_SECONDS * 1000,
    );

    await this.userModel.updateOne(
      { _id: userId },
      {
        $set: {
          refresh_token_hash: hash,
          refresh_token_expires_at: expiresAt,
          ...(current?.refresh_token_hash
            ? {
                prev_refresh_token_hash: current.refresh_token_hash,
                prev_refresh_token_expires_at: graceExpiry,
              }
            : {}),
        },
      },
    );
  }
```

- [ ] **Step 3: Update `refreshToken` to check the previous hash too**

Replace the `refreshToken` method (lines 243-267):

```ts
  async refreshToken(
    refreshToken: string,
  ): Promise<{ user: User; tokens: TokenPair }> {
    const tokenHash = this.hashRefreshToken(refreshToken);

    // Check current hash first, then grace-period previous hash
    let doc = await this.userModel
      .findOne({ refresh_token_hash: tokenHash })
      .lean();

    if (!doc) {
      doc = await this.userModel
        .findOne({
          prev_refresh_token_hash: tokenHash,
          prev_refresh_token_expires_at: { $gt: new Date() },
        })
        .lean();
    }

    if (!doc)
      throw new UnauthorizedException("Invalid or expired refresh token");

    // Enforce server-side expiry
    if (
      doc.refresh_token_expires_at &&
      new Date(doc.refresh_token_expires_at) < new Date()
    ) {
      await this.userModel.updateOne(
        { _id: doc._id },
        {
          $unset: {
            refresh_token_hash: 1,
            refresh_token_expires_at: 1,
            prev_refresh_token_hash: 1,
            prev_refresh_token_expires_at: 1,
          },
        },
      );
      throw new UnauthorizedException("Refresh token has expired");
    }

    const user = await this.userService.findById(doc._id as string);
    if (!user) throw new UnauthorizedException("User not found");
    const tokens = await this.generateTokenPair(user);
    return { user, tokens };
  }
```

- [ ] **Step 4: Update `logout` to also clear previous hash fields**

Replace the `logout` method (lines 269-274):

```ts
  async logout(userId: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      {
        $unset: {
          refresh_token_hash: 1,
          refresh_token_expires_at: 1,
          prev_refresh_token_hash: 1,
          prev_refresh_token_expires_at: 1,
        },
      },
    );
  }
```

- [ ] **Step 5: Verify compilation**

Run: `cd /Users/garda_dafi/Project/stageholder-meridian && npx turbo run check --filter=api`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/user/user.schema.ts apps/api/src/modules/auth/auth.service.ts
git commit -m "fix: refresh token rotation keeps previous hash valid for 30s grace period"
```

---

## Summary

| Task | What it fixes                                                   |
| ---- | --------------------------------------------------------------- |
| 1    | `silentRefresh` no longer resolves queued requests on failure   |
| 2    | Sync hooks wait for token refresh before making API calls       |
| 3    | Workspace layout correctly handles 401 vs 403 vs network errors |
| 4    | Session expiry preserves IndexedDB data and shows a toast       |
| 5    | Concurrent refresh requests don't invalidate each other         |
