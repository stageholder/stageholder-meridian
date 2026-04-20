# Meridian ↔ Stageholder Hub Integration

**Status:** Design approved, pending implementation plan
**Date:** 2026-04-19
**Scope:** Full replacement of Meridian's local auth with the Stageholder Hub (OIDC). Introduce paid subscription tier. Fix existing journal encryption + recovery. Greenfield data wipe (pre-production).
**Related:** `~/Project/stageholder-identity/docs/integration/migration-from-local-auth.md` (playbook authored by the Hub team)

---

## 1. Scope, goals, non-goals

### What we're building

Meridian becomes an OIDC Relying Party of the Stageholder Hub. All local auth code is removed. The app becomes a two-tier product: **Free** (limited) and **Unlimited** (paid, monthly/yearly, USD/IDR). Journals keep full client-side E2EE with a newly-robust recovery flow. Meridian is strictly single-user — no sharing, no workspaces, no orgs exposed to the user.

### Goals (priority order)

1. **Clean break from local auth.** Delete every line of bcrypt/JWT/session code. Every `req.user.sub` comes from a Hub-issued token; no shadow user table in Meridian.
2. **Robust E2EE for journals.** Fix the currently broken recovery, remove the leaky plaintext-migration endpoint, keep the well-chosen primitives (PBKDF2-600k + AES-KW + AES-GCM).
3. **Simple paid subscription using what the Hub already has.** One product, two plans, three numeric limits driven by Hub's `productFeatures`/`planFeatures` tables. Meridian reads limits via `@stageholder/auth` SDK — no custom entitlement endpoint.
4. **Offline-first preserved.** Dexie mutation queue keeps working. Refresh-token rotation survives a token expiring mid-sync.
5. **Meridian owns only app/product concerns.** Identity, billing, profile, MFA, sessions, account deletion all delegate to the Hub via redirects.

### Non-goals (explicit)

- No sharing of any kind (journals, habits, todos, tags).
- No workspace concept. No member roles. No org switcher in Meridian UI.
- No freemium feature gating — only numeric volume limits.
- No 14-day trial. Free tier is the trial; upgrade when a limit is hit.
- No Meridian-side password reset, MFA, email verification, or Google OAuth code.
- No custom Hub endpoints built for Meridian except one small polling endpoint for account-deletion cleanup (see §8).

### Stack changes

- **Add (API):** `@stageholder/auth`, `@node-rs/argon2`
- **Add (PWA):** `@stageholder/auth`, `iron-session`
- **Remove:** `bcryptjs`, `@nestjs/jwt`, `@nestjs/passport`, `passport-*`, `jsonwebtoken`, `google-auth-library`

---

## 2. Identity & auth architecture

### Actors

| Actor                      | Role                                  | Port (local)                                  |
| -------------------------- | ------------------------------------- | --------------------------------------------- |
| Hub API                    | OIDC provider                         | 3000 (dev)                                    |
| Hub Web                    | Hub's own account/admin/pricing UI    | 3001 (dev)                                    |
| Meridian Web (Next.js PWA) | OIDC client, BFF                      | 4001 (dev) — already in Hub's CORS allow-list |
| Meridian API (NestJS)      | Bearer-token verifier, no session     | 4000 (dev)                                    |
| Meridian Desktop (Tauri)   | PKCE native client, loopback redirect | n/a                                           |
| Meridian Mobile (future)   | PKCE native client, custom scheme     | n/a                                           |

### OIDC clients registered in Hub admin

| Client ID          | Type   | Auth method           | Redirect URIs                                                                           |
| ------------------ | ------ | --------------------- | --------------------------------------------------------------------------------------- |
| `meridian-web`     | Web    | `client_secret_basic` | `https://meridian.stageholder.com/auth/callback`, `http://localhost:4001/auth/callback` |
| `meridian-desktop` | Native | `none`                | `http://127.0.0.1:*/callback`                                                           |
| `meridian-mobile`  | Native | `none`                | `com.stageholder.meridian://callback`                                                   |

All three configured with:

- Post-logout redirect: `/goodbye` (web) / app-close (native)
- Front-channel logout URI: `/auth/logout-notify` (web only)
- Grant types: `authorization_code`, `refresh_token`

### Scopes requested

```
openid offline_access profile email organizations subscriptions
```

- `organizations` needed to find the personal org ID (the billing unit).
- `subscriptions` needed for `getFeatureLimit()` to resolve plan limits.
- `product_access` deliberately omitted — Meridian has no per-product roles.

### Token lifecycle

| Token                                      | TTL                           | Storage                                                                         |
| ------------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------- |
| Access token                               | 15 min                        | In-memory on the Meridian API side, sent as Bearer                              |
| Refresh token                              | 30 days, rotates on every use | Server-side: `iron-session` sealed cookie (web), Stronghold (desktop)           |
| ID token                                   | 1 hour                        | Held by BFF for logout (`id_token_hint`)                                        |
| Meridian session cookie `meridian_session` | 30-day sliding                | iron-session sealed, `httpOnly`, `secure` (prod), `sameSite=lax`, domain-scoped |

### Four auth routes on the PWA BFF

| Route                     | Purpose                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `GET /auth/login`         | Generate PKCE + state, set `oauth_state` cookie (10 min), redirect to `/oidc/auth`                              |
| `GET /auth/callback`      | Verify state, exchange code + verifier, set `meridian_session`, redirect to `/app` (or validated `returnTo`)    |
| `POST /auth/logout`       | Revoke refresh at `/oidc/token/revocation`, clear session, redirect to `/oidc/session/end` with `id_token_hint` |
| `GET /auth/logout-notify` | Front-channel logout endpoint; validate `iss`, clear session, return 200                                        |

### API-side auth

- `StageholderAuthModule.forRoot({ issuerUrl, clientId, clientSecret })` wired in `app.module.ts`.
- `StageholderAuthGuard` applied globally; `@Public()` escape hatch for `/health` only.
- Every protected route receives `req.user: StageholderUser` containing `sub`, `email`, `organizations[]`, `subscriptions[]`.
- **Token verification split**:
  - **Writes** (`POST`/`PUT`/`PATCH`/`DELETE`) → `verifyAccessToken` (introspection, real-time revocation check).
  - **Reads** (`GET`) → `verifyIdToken` (offline JWT, up to 15 min stale — acceptable for reads).
- Decorator `@FreshAuth()` forces introspection on any handler if needed for future cases.

### Code deleted from Meridian

- `apps/api/src/modules/auth/**` (entire module)
- `apps/api/src/modules/user/**` (entire module — identity lives in Hub)
- `apps/pwa/app/auth/login/**`, `/register/**`, `/forgot-password/**`, `/google/callback/**`
- `apps/pwa/app/workspaces/**`, `/workspace-select/**`
- All password/refresh/session middleware

### `@stageholder/auth` installation

Published to **GitHub Packages** (`npm.pkg.github.com`) as `@stageholder/auth`. Meridian (and all product repos) use:

```
# .npmrc
@stageholder:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
```

Read-only PAT with `read:packages` in local dev and Cloud Run deploys. Hub repo publishes on tag via GitHub Actions.

---

## 3. Subscription & entitlement model

### Two tiers

| Capability                  | Free                           | Unlimited |
| --------------------------- | ------------------------------ | --------- |
| Journals (E2EE)             | Unlimited                      | Unlimited |
| Habits                      | 5 active                       | Unlimited |
| Todo lists                  | 3 lists, 10 active todos total | Unlimited |
| Encryption + recovery       | ✅ Full                        | ✅ Full   |
| Offline + multi-device sync | ✅                             | ✅        |
| Export all data             | ✅                             | ✅        |

**No trial.** Free tier is the trial; users upgrade when they hit a limit.

**Principle:** reads are always free, writes gated by entitlement. Users can always see existing data and export it, even if they're at the free-tier cap — data is never held hostage.

### Plans in Hub

Two rows in `productPlans` under product slug `meridian`:

| Plan slug            | `isFreeTier` | Polar product IDs                |
| -------------------- | ------------ | -------------------------------- |
| `meridian-free`      | `true`       | —                                |
| `meridian-unlimited` | `false`      | 4 IDs (monthly/yearly × USD/IDR) |

Users auto-assigned to `meridian-free` on first Meridian sign-in. Upgrade flow redirects to Hub's `/pricing/meridian` → Polar checkout. On `subscription.active` webhook, Hub's existing machinery flips the user's plan to `meridian-unlimited`.

### Feature catalog in Hub

Three `productFeatures` rows for product `meridian`:

| slug               | `valueType` | Free value | Unlimited value |
| ------------------ | ----------- | ---------- | --------------- |
| `max_habits`       | number      | 5          | -1 (unlimited)  |
| `max_todo_lists`   | number      | 3          | -1              |
| `max_active_todos` | number      | 10         | -1              |

Limits live in Hub DB. Changing "5 → 7 habits" is a Hub DB update, no Meridian redeploy. Meridian only codes feature slugs.

### How Meridian reads entitlement

Directly from the OIDC `subscriptions` claim via `@stageholder/auth` helpers:

```ts
// In a NestJS service
const orgId = req.user.organizations[0].id; // personal org
const maxHabits = getFeatureLimit(req.user, orgId, "meridian", "max_habits");
// Free: 5, Unlimited: -1 (meaning no cap)

if (maxHabits !== -1 && currentCount >= maxHabits) {
  throw new PaymentRequiredException({
    code: "limit_reached",
    feature: "max_habits",
  });
}
```

**No custom entitlement endpoint built in the Hub.** The `subscriptions` claim is already there.

**Write requests** use `verifyAccessToken` (introspection) → fresh claims → immediate reflection of subscription changes. If a user cancels, their next write gets 402 within seconds.

### Enforcement in the API

A single `EntitlementInterceptor` applied globally:

- On `POST`/`PUT`/`PATCH`/`DELETE` to entity routes, check the relevant count vs limit.
- On 402: response body `{ code: "limit_reached" | "not_entitled", feature?: string, message: string }`.
- Client shows paywall modal with upgrade CTA.

### Paywall UX

| Trigger                                      | Experience                                                                                                                                               |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trying to create habit #6 on free            | Inline modal: "You've reached 5 habits. Upgrade for unlimited." with upgrade button                                                                      |
| Trying to create list #4 or todo #11 on free | Same pattern                                                                                                                                             |
| User on Unlimited cancels                    | At `currentPeriodEnd` the Hub flips plan to free; next write triggers a limit if over-cap — existing items grandfathered (enforcement is at create only) |
| Payment fails (`past_due`)                   | 7-day grace before flip to free; banner "Please update payment method"                                                                                   |

---

## 4. Data model

### Collections after the change

All single-user. Every collection has `userSub: string` indexed. `workspaceId`, `creatorId`, `assigneeId`, and all member/role fields are removed.

| Collection         | Key indexes                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| `journals`         | `{ userSub: 1, date: -1 }`, `{ userSub: 1, updatedAt: -1 }`                                       |
| `habits`           | `{ userSub: 1, createdAt: -1 }`                                                                   |
| `habit_entries`    | `{ userSub: 1, habitId: 1, date: 1 }` (unique), `{ userSub: 1, date: -1 }`                        |
| `todo_lists`       | `{ userSub: 1, createdAt: -1 }`                                                                   |
| `todos`            | `{ userSub: 1, listId: 1, status: 1 }`, `{ userSub: 1, dueDate: 1 }`, `{ userSub: 1, doDate: 1 }` |
| `tags`             | `{ userSub: 1, name: 1 }` (unique)                                                                |
| `notifications`    | `{ userSub: 1, read: 1, createdAt: -1 }`                                                          |
| `journal_security` | `_id: userSub`                                                                                    |

### Collections deleted

- `users` (identity lives in Hub)
- `workspaces`
- `workspace_members`
- `invitations`

### Greenfield wipe, no migration code

Meridian is pre-production. Drop the database, re-seed. No `stageholder_sub` backfill, no dual-read period, no compatibility shim. This saves meaningful migration work that would never run in production again.

### Authorization rule

One rule everywhere:

```
req.user.sub === entity.userSub → allow
otherwise → 404 (not 403 — don't leak existence)
```

No admin override. Meridian admins operate via the Hub admin portal, which does not touch Meridian data.

### Dexie (client) schema

Mirrors the server:

- Drop stores: `workspaces`, `members`, `invitations`.
- Rewrite compound indexes: `[workspaceId+*]` → `[userSub+*]`.
- `pendingMutations` gains a `userSub` column.
- `syncMeta` primary key: `[entityType+userSub]`.

---

## 5. Journal encryption + recovery

### Primitives (unchanged)

- **KDF**: PBKDF2-SHA256, 600k iterations, 16-byte salt → 256-bit AES-KW master key
- **DEK**: random AES-256-GCM, wrapped by master key via AES-KW
- **Field cipher**: AES-256-GCM, 12-byte random IV prepended to ciphertext, base64
- **What's encrypted**: journal `title`, `content`, `tags` only. Todos, habits, tags table stay server-side at-rest only.

### Key independence from Hub identity

The encryption passphrase is **NOT** the Hub login password. They are separate secrets:

- Hub password: sent to Hub over HTTPS, stored as Argon2 hash there. Unlocks identity.
- Encryption passphrase: never leaves the client. Unlocks journal DEK. Meridian server only ever sees the wrapped DEK.

UI copy must make this distinction explicit. On first journal access after Hub sign-in, Meridian prompts for a (separate) encryption passphrase.

### `journal_security` collection

Replaces the deleted fields on the removed `users` collection.

```
journal_security (MongoDB)
  _id: string                    // = userSub (OIDC sub UUID)
  encryptionEnabled: boolean
  passphraseWrappedDek: string   // DEK wrapped by PBKDF2(passphrase, salt)
  passphraseSalt: string         // PBKDF2 salt, base64 (16 bytes)
  recoveryWrappedDek: string     // SAME DEK, wrapped by key derived from recovery codes
  recoveryCodeHashes: string[]   // Argon2id hashes, one per code, positional (length 8)
  recoveryCodesRemaining: number // starts at 8; decrements per recovery use
  createdAt, updatedAt
```

### Setup flow (client-side)

1. User enters new passphrase.
2. Generate 16-byte salt → PBKDF2 → master key.
3. Generate random DEK.
4. `passphraseWrappedDek = AES-KW(DEK, masterKey)`.
5. Generate 8 recovery codes (8 chars each, alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`).
6. Derive recovery-master-key: `PBKDF2(sortedCodes.join(""), salt=userSub, 600k, SHA-256)`.
7. `recoveryWrappedDek = AES-KW(DEK, recoveryMasterKey)`.
8. POST to API: `{ passphraseWrappedDek, passphraseSalt, recoveryWrappedDek, recoveryCodes }` — server hashes each code with Argon2id and stores the hashes + both wrapped DEK blobs.
9. Client shows the 8 codes exactly once with a strong warning and download option. Codes are never persisted client-side.

### Unlock flow

1. Client GET `/api/v1/journal-security/keys` → `{ passphraseWrappedDek, passphraseSalt, encryptionEnabled }`. `recoveryWrappedDek` and `recoveryCodeHashes` **never** returned here.
2. Client prompts for passphrase.
3. Derive master key → unwrap DEK → hold in Zustand store (memory-only).

### Change passphrase (knows current passphrase)

Client unwraps with old → new salt → new master → new `passphraseWrappedDek`. POST to API. Recovery side untouched.

### Recovery (forgot passphrase, has codes)

1. User enters all 8 codes.
2. Client POSTs cleartext codes to `/api/v1/journal-security/recover` over HTTPS.
3. Server verifies each code against its positional Argon2id hash. All 8 must match.
4. On match: server returns `{ recoveryWrappedDek }`, decrements `recoveryCodesRemaining`.
5. Client derives recovery-master-key (same PBKDF2 recipe), unwraps DEK.
6. Client prompts for new passphrase → new salt → new `passphraseWrappedDek`.
7. Server also generates a fresh set of 8 codes + new `recoveryWrappedDek`, returns them for display.

**Rate limit** `/recover`: 5 attempts per hour per `userSub`, 100 per day per IP, lock account for 24h after 10 failed attempts.

### Deletions from current code

- **Delete** `POST /workspaces/:id/journals/migrate-encryption` — returns server-held plaintext; dangerous; migration done.
- **Delete** old `verifyRecovery` endpoint — returned wrapped DEK without verification.
- **Rename** `apps/api/src/modules/encryption-keys/` → `modules/journal-security/`.

### Tauri + multi-device

- Same flow on every device.
- Each device fetches `passphraseWrappedDek` + salt on first journal access.
- DEK held in memory only. Never persisted to Stronghold or Dexie.
- Re-prompt on app restart or 30-min idle timeout (configurable).
- Refresh token → Stronghold. DEK → memory.

### Offline unlock

On first online unlock, client caches `passphraseWrappedDek` + `passphraseSalt` in a Dexie `journal_security_cache` store. Already wrapped — caching doesn't weaken the scheme. Offline user can unlock using the cached blob + their passphrase. Cache invalidated on passphrase change.

---

## 6. What Meridian delegates to the Hub

The contract: if it's on the left, Meridian links/redirects to the Hub. Meridian never reimplements.

| Surface                                                                         | Meridian behavior                                                                      |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Sign-up, sign-in, forgot password, email verify                                 | Redirect to `https://id.stageholder.com/auth/*`                                        |
| Google OAuth                                                                    | Hub-owned. Meridian has no Google code.                                                |
| MFA enrollment & verification                                                   | Hub `/account/security`. Meridian never sees MFA.                                      |
| Password change                                                                 | Hub `/account/security/password`.                                                      |
| Profile edit (name, avatar, timezone, language, phone, bio)                     | Hub `/account/profile`. Meridian reads profile from OIDC claims; does not persist.     |
| Session management / sign out other devices                                     | Hub `/account/security/sessions`.                                                      |
| Connected accounts (Google, future providers)                                   | Hub `/account/security/connected-accounts`.                                            |
| Account deletion                                                                | Hub `DELETE /api/account`. Meridian cleanup via polling (see §8).                      |
| Subscription checkout, plan selection, payment method, invoices, cancel, resume | Hub `/account/[personalOrgSlug]/billing` + `/pricing/meridian`. Polar-hosted checkout. |
| Audit logging of auth events                                                    | Hub. Meridian audit-logs only domain events (`journal_created`, `habit_completed`).    |
| Rate limiting on auth                                                           | Hub. Meridian throttles only its own app endpoints.                                    |

### What Meridian owns (total surface)

1. App UI + navigation (PWA + Tauri).
2. Product data model + CRUD (journals, habits, habit entries, todo lists, todos, tags, notifications).
3. Client-side E2EE for journals.
4. Offline sync (Dexie + mutation queue).
5. Limit enforcement on create via `@stageholder/auth`.

### Outbound links from Meridian UI

| Meridian UI            | Target                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------- |
| "Sign up" on landing   | `https://id.stageholder.com/auth/register?…` (Hub register tab via OIDC authorize URL) |
| "Account Settings"     | `https://id.stageholder.com/account/profile` (new tab)                                 |
| "Upgrade to Unlimited" | `https://id.stageholder.com/pricing/meridian?org={slug}` (new tab)                     |
| "Manage subscription"  | `https://id.stageholder.com/account/{slug}/billing` (new tab)                          |
| "Sign out"             | `POST /auth/logout` on Meridian BFF → revoke → Hub's `/oidc/session/end`               |

---

## 7. Offline + sync

### Token lifecycle while offline

- **Access token expires mid-sync**: API 401 → BFF refreshes via refresh token → retries. Transparent to client code.
- **Refresh token expires (30+ days offline)**: `invalid_grant` → BFF clears session → redirect to Hub login. Unsynced mutations stay in Dexie, replayed on re-login _only if same `sub`_.
- **User signs in as different `sub`**: mutation queue cleared for non-matching subs. Prevents cross-account leak.

### Entitlement while offline

- On each successful sync, cache `{ plan, limits, entitled }` in Dexie (`entitlement_cache` store keyed by `userSub`), TTL 7 days.
- After 7 days offline, client falls back to Free-tier limits until reconnect.
- Client enforces limits in UI using the cache (preempts 402).
- Server remains authoritative: offline mutations exceeding limits fail at sync with 402 and surface as sync conflicts.

### Encryption while offline

- Wrapped DEK + salt cached in Dexie after first online unlock.
- Offline unlock works against cached blob + user-entered passphrase.
- Cache invalidated on passphrase change.
- DEK never persists.

### Mutation queue scoping

- `pendingMutations` gains `userSub` column.
- `syncMeta` primary key: `[entityType+userSub]`.
- On session change, the sync manager clears mutations whose `userSub` differs from the current session.

### Tauri specifics

- Refresh token → `tauri-plugin-stronghold`.
- Access token, ID token → memory only.
- Wrapped DEK cache → Dexie (Tauri wraps a browser shell; Dexie available).
- On app start: silent refresh attempt. If offline: open in read-mode from cache until reconnect.

---

## 8. Migration, cleanup, edge cases

### One-time cleanup on Meridian side

Delete:

- `apps/api/src/modules/auth/**`
- `apps/api/src/modules/user/**`
- `apps/api/src/modules/workspace/**`, `workspace-member/**`, `invitation/**`
- `apps/pwa/app/auth/login/**`, `/register/**`, `/forgot-password/**`, `/google/**`
- `apps/pwa/app/workspaces/**`, `/workspace-select/**`
- Deps: `bcryptjs`, `@nestjs/jwt`, `@nestjs/passport`, `passport-*`, `jsonwebtoken`, `google-auth-library`

Rename:

- `apps/api/src/modules/encryption-keys/` → `modules/journal-security/`

Add:

- `apps/api/src/lib/auth.module.ts` (thin wrapper around `@stageholder/auth`)
- `apps/pwa/app/auth/callback/route.ts` (OIDC callback BFF)
- `apps/pwa/app/auth/logout/route.ts` (RP-initiated logout)
- `apps/pwa/app/auth/logout-notify/route.ts` (front-channel receiver)
- `apps/pwa/lib/session.ts` (iron-session helpers)
- `apps/pwa/lib/oidc.ts` (PKCE helpers, refresh helper)

Env vars:

- **Remove**: `JWT_SECRET`, `REFRESH_TOKEN_EXPIRES_IN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- **Add**: `IDENTITY_ISSUER_URL`, `IDENTITY_CLIENT_ID`, `IDENTITY_CLIENT_SECRET`, `IDENTITY_REDIRECT_URI`, `SESSION_SECRET`, `GITHUB_PACKAGES_TOKEN` (for install)

Database:

- Drop the entire Meridian MongoDB database. Re-create from new schema.

### One-time setup on Hub side (admin work, no code in Hub repo)

1. Register 3 OIDC clients via Hub admin: `meridian-web`, `meridian-desktop`, `meridian-mobile`.
2. Seed `products` row: `meridian` with display name, logo, URLs, linked to `meridian-web` as the primary client.
3. Seed 2 `productPlans` rows: `meridian-free` (`isFreeTier=true`) and `meridian-unlimited`.
4. Seed 3 `productFeatures` rows: `max_habits`, `max_todo_lists`, `max_active_todos`.
5. Seed 6 `planFeatures` rows (2 plans × 3 features): free values 5/3/10, unlimited values -1/-1/-1.
6. Create 4 Polar products in Polar dashboard (monthly/yearly × USD/IDR). Paste IDs into `meridian-unlimited` plan row.
7. Publish `@stageholder/auth` to GitHub Packages.

### Hub-side dependency (small new work)

Hub currently emits **no outbound webhooks to products**. When a user deletes their Hub account, Meridian wouldn't know → orphaned journals/habits/todos.

**Resolution:** Add a simple polling endpoint in the Hub:

```
GET /api/events?product=meridian&since=<cursor>&limit=100
Authorization: Bearer <client_credentials_token>
→ { events: [{ id, type: "user.deleted" | "subscription.updated", userSub, occurredAt, payload }], nextCursor }
```

Meridian runs a cron (every 5 min) that polls since last cursor, persists cursor in a `hub_events_cursor` collection, and handles:

- `user.deleted` → purge all Meridian docs where `userSub = event.userSub` (hard delete, including `journal_security`).
- `subscription.updated` → no-op (entitlement is already read live from introspection).

Estimated Hub work: ~1 day. Easy to upgrade to proper outbound webhooks later without changing Meridian's handler.

### Edge cases

| Case                                                           | Handling                                                                                                                                                                          |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User cancels subscription mid-session                          | Next write introspection returns fresh claim → 402. Client shows paywall, flips to read-mode.                                                                                     |
| Refresh token rotation collision (two tabs refresh same token) | First succeeds; second gets `invalid_grant` → that tab forces re-login. Acceptable.                                                                                               |
| Stale offline entitlement (user upgraded but cache says free)  | Refreshed on next online sync. Worst case: client UI shows paywall until next sync (writes would still succeed — server never blocks an upgraded user since it introspects live). |
| Wrong passphrase                                               | AES-KW unwrap throws → "Incorrect passphrase." No lockout (client-side, offline).                                                                                                 |
| Wrong recovery codes                                           | Server 401. Rate limit 5/hour per user.                                                                                                                                           |
| Hub unreachable                                                | `verifyAccessToken` fails → 503 on writes. Reads via `verifyIdToken` still work. App degrades to read-only.                                                                       |
| User deletes Hub account                                       | Polling cron picks up `user.deleted`, cascade-deletes all Meridian docs including `journal_security`. Encrypted journals become unrecoverable, which is the correct outcome.      |
| User changes email in Hub                                      | `sub` is stable, so no-op for Meridian. Cached profile claims update on next token refresh.                                                                                       |

### Manual verification checkpoints

The user verifies each of these by hand before considering the integration done:

1. Sign-up via Hub → land in Meridian → initial journal prompt works → can encrypt + view.
2. Create 5 habits on free tier → create 6th → paywall modal appears.
3. Upgrade to Unlimited via Hub → return to Meridian → 6th habit creates successfully.
4. Cancel subscription via Hub → return to Meridian → next write shows paywall.
5. Sign out in one browser tab → logout-notify clears session in other tabs.
6. Forget passphrase → enter 8 recovery codes → set new passphrase → journals still decrypt.
7. Go offline → create journals → come back online → journals sync + stay encrypted.
8. Delete account in Hub → within 5 min Meridian data purged.
9. Fresh install Tauri app → PKCE loopback login → journals sync.
10. Wrong passphrase attempt → error shown, no lockout, no data loss.

---

## Open decisions explicitly deferred

- Exact monthly/yearly prices in USD and IDR (product decision, can be set in Polar dashboard without code change).
- Mobile app (iOS/Android) — OIDC client registered but mobile client code not in this spec.
- Whether to upgrade the Hub's polling `/api/events` endpoint to true outbound webhooks — deferred until product count justifies the work.

---

## Appendix: Feature flag slugs (for Hub DB seed)

```
products: { slug: "meridian", displayName: "Meridian", … }

productFeatures:
  { slug: "max_habits",       valueType: "number", displayName: "Active habits" }
  { slug: "max_todo_lists",   valueType: "number", displayName: "Todo lists" }
  { slug: "max_active_todos", valueType: "number", displayName: "Active todos" }

productPlans:
  { slug: "meridian-free",      isFreeTier: true,  memberLimit: null }
  { slug: "meridian-unlimited", isFreeTier: false, memberLimit: null,
    polarProductIdMonthly: "<monthly-usd>",  // + yearly-usd, monthly-idr, yearly-idr slots
  }

planFeatures (matrix):
  free × max_habits       → numberValue: 5
  free × max_todo_lists   → numberValue: 3
  free × max_active_todos → numberValue: 10
  unlimited × *           → numberValue: -1
```
