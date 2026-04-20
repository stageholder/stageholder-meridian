# Onboarding Gate Design

**Date:** 2026-04-20
**Status:** Approved, ready for implementation plan
**Scope:** Meridian only (no Hub changes)

## Context

The `/onboarding` page exists in `apps/pwa/app/onboarding/` but is orphaned — nothing routes a new user into it. The `/auth/callback` handler always lands the user at `/app` regardless of whether they have just been created or have been using the product for months. The workspace-removal refactor (`6aebc65`) tore out the bootstrap logic that previously chose between onboarding and the app, and the UI was kept "so the flow still reads naturally" without its entry point.

This spec restores the onboarding gate following the industry-standard pattern for multi-product SSO: **per-product JIT-provisioned user records with server-side gating in the auth callback**.

## Goals

- New users land on `/onboarding` after their first sign-in; returning users land on `/app`.
- Onboarding completion persists the user's timezone to Meridian's database (needed for daily rollovers, streaks, journal bucketing).
- State is Meridian-specific — the Hub does not know about "onboarded" or timezone.
- No UI flash on web (server-side gate in the callback).
- Desktop (Tauri) is also gated (client-side, since there is no BFF there).

## Non-Goals

- Persisting selected goals. Goals are decorative in the current UI with no downstream consumer.
- A generic `PATCH /me` endpoint for profile changes. Timezone edits outside onboarding can be added later.
- Backfill. The branch is `dev/0.1.0`, pre-production — treat every user as new.
- Automated tests of any kind (unit, integration, E2E). Verification is manual per the project's testing norms.

## Architecture

### High-level flow

```
Sign-in (web)                                        Sign-in (desktop)
─────────────                                        ─────────────────
Hub OIDC → /auth/callback                            Hub OIDC → DesktopAuthBoot
  ├─ exchange code                                     ├─ store tokens
  ├─ decode id_token                                   └─ redirect to /app
  ├─ fetchUserinfo (Hub)                                    │
  ├─ fetchMeridianMe (API) ← upserts User doc              ↓
  ├─ save session (incl. flag, timezone)             app/app/layout.tsx
  └─ redirect: flag ? /app : /onboarding                useUser() → fetch /me
                                                         └─ flag ? render : /onboarding
```

### Gate approach

**Primary gate: server-side in `/auth/callback/route.ts`** (web). After `fetchUserinfo`, call Meridian API `GET /me`, which upserts a `User` document keyed by Hub `sub` and returns `hasCompletedOnboarding`. The callback writes both into the iron-session cookie and branches the final redirect. No UI flash.

**Safety-net gate: client-side in `app/app/layout.tsx`.** Catches desktop (no BFF callback), direct-URL hits on protected routes, and cache drift. Identical branch logic; same destination.

**Proxy gate was rejected** — `proxy.ts` cannot read iron-session fields without the server-side decrypt secret, and surfacing the flag in a plain sibling cookie is worse than either alternative.

## Data Model

New `User` aggregate in `apps/api/src/modules/user/`, following the DDD pattern used by `todo`, `habit`, `journal`, etc.

**Fields:**

- `_id: ObjectId` (Mongo default)
- `sub: string` — Hub subject, unique index, the identity key
- `hasCompletedOnboarding: boolean` — default `false`
- `timezone: string | null` — IANA zone, default `null` (distinguishes "not set" from explicit UTC)
- `createdAt: Date`, `updatedAt: Date` — per `entity.base.ts`

**Key choice: `sub`, not email.** Email can change on the Hub; `sub` is immutable. The rest of the API modules already use `sub` as the user identifier (from the access-token validator), so this slots in with zero friction.

**Timezone null vs UTC default:** Downstream consumers (streak rollovers, daily habit buckets) fall back to UTC when `timezone` is null — one defined fallback rather than two truths.

## API Surface

All under the existing Nest access-token guard.

### `GET /api/v1/me`

Idempotent upsert keyed by `sub`. Existing endpoint, extended.

- If no `User` for `sub`, create one: `{ sub, hasCompletedOnboarding: false, timezone: null }`.
- Response body:
  ```json
  {
    "sub": "...",
    "email": "...",
    "name": "...",
    "hasCompletedOnboarding": false,
    "timezone": null
  }
  ```
- `email` and `name` come from the validated access-token claims — not persisted; the Hub owns profile.

### `POST /api/v1/me/onboarding/complete`

Body: `{ timezone: string }` (IANA name).

- Validates timezone is a real IANA zone (DTO + `Intl.supportedValuesOf("timeZone")` or a try-catch around `Intl.DateTimeFormat`).
- Sets `hasCompletedOnboarding: true`, `timezone: <value>`, bumps `updatedAt`.
- Returns the full `User` shape.
- Idempotent — calling twice is a no-op.

## BFF Session Shape

Extend `SessionData` in `apps/pwa/lib/session.ts`:

```ts
hasCompletedOnboarding?: boolean;
timezone?: string | null;
```

Two small scalars; well under the 4 KB cookie budget.

Both are hydrated at callback time. The `/api/me` BFF route reads them from the session directly — no per-request backend hop.

## Callback Flow (Web)

Modified `apps/pwa/app/auth/callback/route.ts`:

1. Exchange code → tokens _(unchanged)_
2. Decode id_token for sub/email/name _(unchanged)_
3. `fetchUserinfo(access_token)` — Hub organizations _(unchanged)_
4. **New:** `fetchMeridianMe(access_token)` — server-to-server GET to Meridian API `/me`
5. Save session with `hasCompletedOnboarding`, `timezone` included
6. **New branch:**
   ```ts
   const landing = !session.hasCompletedOnboarding
     ? "/onboarding"
     : (safeReturnTo ?? DEFAULT_LANDING);
   ```

**Step 4 failure is non-fatal.** Fall back to `hasCompletedOnboarding: false, timezone: null` and still complete sign-in. User lands on `/onboarding`, where the completion POST surfaces any real outage. This mirrors the existing non-fatal treatment of the Hub userinfo call (lines 61–63).

**Note:** on a new user, `returnTo` is deliberately ignored. They complete onboarding and go to `/app`. Routing back to `returnTo` post-onboarding is possible via a persisted cookie but is polish, not in scope.

## Desktop Gate

`DesktopAuthBoot` completes PKCE locally and drops the user into `/app` — there is no BFF callback. The gate therefore lives in the client.

**`apps/pwa/hooks/use-user.ts` — `fetchMeDesktop`:**
Currently derives the user purely from the id_token. Add one API call to Meridian `/me` using the access token, merge the result with the id_token claims:

```ts
const res = await fetch(`${API_URL}/me`, {
  headers: { Authorization: `Bearer ${session.accessToken}` },
});
const apiMe = await res.json();
return { ...idTokenClaims, ...apiMe };
```

React Query's existing 60 s `staleTime` caches it.

**`apps/pwa/app/app/layout.tsx` — existing auth effect extended:**

```ts
useEffect(() => {
  if (userLoading) return;
  if (!user) {
    router.replace(isDesktop() ? "/" : "/auth/login");
    return;
  }
  if (user.hasCompletedOnboarding === false) {
    router.replace("/onboarding");
  }
}, [user, userLoading, router]);
```

This same guard also defends against direct URL hits on the web (e.g., a bookmark to `/app/habits` for a user who has not onboarded).

## Onboarding Completion

### `CompleteStep` (`apps/pwa/components/onboarding/complete-step.tsx`)

Currently: calls `onFinish()`. Change to:

```ts
async function handleFinish() {
  await fetch("/api/me/onboarding/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ timezone }),
  });
  queryClient.invalidateQueries({ queryKey: ["me"] });
  onFinish();
}
```

The `timezone` value is passed down from the page component (see below).

### Skip handler (`onboarding/page.tsx`)

`handleSkip` does the same POST with browser-detected timezone, then navigates. **Skip must flip the flag** — skipping otherwise means "bounce back to onboarding on every sign-in," which is user-hostile.

### Timezone lifting

Today, `ProfileStep` has a `TimezoneSelect` that is not wired anywhere. Lift `timezone` state up to `OnboardingPage`, initialize from `Intl.DateTimeFormat().resolvedOptions().timeZone`, pass it (and a setter) down to `ProfileStep`, and pass the final value to `CompleteStep`. Honoring a user's explicit selection is table stakes.

### New BFF route

`apps/pwa/app/api/me/onboarding/complete/route.ts`:

- Reads session, forwards POST to Meridian API `/me/onboarding/complete` with the server-held access token.
- On 2xx: `session.hasCompletedOnboarding = true; session.timezone = body.timezone; await session.save();` so the cookie is fresh without waiting for the next sign-in.
- Returns 2xx JSON to the client, which invalidates `["me"]`.

### Onboarding page re-entry guard

`apps/pwa/app/onboarding/page.tsx` already has `if (!user) router.replace("/auth/login")`. Add the symmetric guard: `if (user?.hasCompletedOnboarding) router.replace("/app")`. A user who has onboarded cannot re-enter the flow by typing the URL.

## Error Handling & Edge Cases

| Scenario                                                | Behavior                                                                                                              |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Meridian API down during callback                       | Session saved with `flag: false, tz: null`; user lands on `/onboarding`. Real outage surfaces on the completion POST. |
| Completion POST fails                                   | Inline error, no navigation, flag stays false. User retries.                                                          |
| Invalid timezone body                                   | Nest validation → 400 → inline error. Only fires on tampered requests; browser-detected IANA is well-formed.          |
| Concurrent tabs, new user                               | Both on `/onboarding`. First one flips the DB flag; second tab's POST is a no-op; both navigate to `/app`. No race.   |
| Onboarded on desktop, then signs in on web              | Web callback's `/me` reads `flag: true` from DB; lands at `/app` directly. DB is source of truth.                     |
| Flow interrupted mid-way (browser closed, network drop) | Flag stays false; next sign-in lands on `/onboarding` again. No partial state.                                        |
| Already-onboarded user types `/onboarding` in URL       | Page guard redirects to `/app`.                                                                                       |

## Manual Verification

No automated tests — the user verifies in the running app. Checklist for end-of-implementation sign-off:

**First-sign-in flow (web):**

1. Clear cookies, open a fresh browser. Sign in via Hub with a Hub account that has never opened Meridian.
2. Expect: lands on `/onboarding`, not `/app`.
3. Walk the 5 steps; change timezone in `ProfileStep` to something other than the browser default.
4. Click "Finish" on `CompleteStep`. Expect: lands on `/app`.
5. In Mongo, expect one `users` document with `sub` matching the Hub id, `hasCompletedOnboarding: true`, `timezone` matching the selected value.

**Returning-user flow (web):** 6. Sign out, sign back in with the same account. Expect: lands on `/app` directly, no onboarding bounce.

**Skip path:** 7. Clear cookies again, sign in with a second fresh account. On `/onboarding`, click "Skip setup". 8. Expect: lands on `/app`; Mongo document shows `hasCompletedOnboarding: true`, `timezone` = browser-detected. 9. Sign out, sign back in. Expect: no re-entry to onboarding.

**Direct URL guards:** 10. As an already-onboarded user, navigate to `/onboarding`. Expect: redirect to `/app`. 11. As a never-onboarded user (clear DB for that sub, sign back in), navigate directly to `/app/habits`. Expect: redirect to `/onboarding`.

**Desktop (Tauri):** 12. Sign in with a fresh account on desktop. Expect: lands on `/onboarding` after brief load; completing walks back to `/app`.

**Failure modes:** 13. Stop the Meridian API. Try to complete onboarding. Expect: inline error on `CompleteStep`, no navigation, flag stays false. Restart API, retry — succeeds.

## File Touch-Points

### New

**Backend:**

- `apps/api/src/modules/user/user.entity.ts`
- `apps/api/src/modules/user/user.schema.ts`
- `apps/api/src/modules/user/user.repository.ts`
- `apps/api/src/modules/user/user.service.ts`
- `apps/api/src/modules/user/user.controller.ts`
- `apps/api/src/modules/user/user.module.ts`
- `apps/api/src/modules/user/dto/complete-onboarding.dto.ts`

**Frontend:**

- `apps/pwa/app/api/me/onboarding/complete/route.ts`

### Modified

**Backend:**

- `apps/api/src/app.module.ts` — register `UserModule`
- `apps/api/src/modules/me/me.controller.ts` — delegate `GET /me` to `user.service`, include flag + timezone

**Frontend:**

- `apps/pwa/lib/session.ts` — add `hasCompletedOnboarding`, `timezone` to `SessionData`
- `apps/pwa/app/auth/callback/route.ts` — call Meridian `/me`; branch landing on flag
- `apps/pwa/app/api/me/route.ts` — extend `MeResponse` with flag + timezone
- `apps/pwa/hooks/use-user.ts` — desktop path fetches Meridian `/me`; merge with id_token claims
- `apps/pwa/app/app/layout.tsx` — extend auth effect with flag-based redirect
- `apps/pwa/app/onboarding/page.tsx` — add "already onboarded → /app" guard; lift timezone to page state; wire `handleSkip` to the POST
- `apps/pwa/components/onboarding/complete-step.tsx` — POST `/api/me/onboarding/complete` with timezone, invalidate `["me"]`, finish

### Untouched

- `apps/pwa/proxy.ts`
- `apps/pwa/app/auth/login/route.ts`
- `stageholder-identity` (Hub) — zero changes
