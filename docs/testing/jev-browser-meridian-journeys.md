# Browser journeys for Meridian, driven by jev-browser (`jevb`)

Jev (TypeSafe's decision model) picks one page target per action; the calling
agent plans the journey and verifies every step against page state, never
against the model's own confidence. This file is the plan the agent follows.

Sibling plans, same tool and conventions:

- Identity Hub: `~/Project/stageholder-identity/docs/testing/jev-browser-hub-journeys.md`
  (Meridian delegates sign-in to the Hub, so Hub journey 5, the OIDC
  round-trip, is the upstream half of every Meridian login below).
- Atlas: `~/Project/stageholder-atlas/docs/testing/jev-browser-atlas-journeys.md`.

## Setup (once per machine)

```bash
bun add -g jev-browser-cli            # ships the `jevb` CLI; Apple Silicon prebuilt
jevb auth login --with-token          # paste the TypeSafe key on stdin, or export TYPESAFE_API_KEY
jevb auth status                      # must show "typesafe: file" or "typesafe: env"
jevb browser doctor --json            # first run downloads Chrome if none is found
```

The key is per machine, not per project. Never put it in any `.env` of this
repo; it is not a Meridian setting.

The CLI is bilingual: command listings print in Chinese, per-action `--help`
prints in English. The command surface is the same. The tool's own manual:
`jevb skill get jev-browser --full`.

Doctor note (macOS): the doctor's own launch test fails with "Socket path
would be N bytes (max 103)" because of its long generated session name. Real
sessions are fine as long as names stay short (`mer-<journey>`); otherwise set
`JEV_BROWSER_RUNTIME_DIR=/tmp/jvb`.

### Project config: `jev-browser.json`

`jevb` reads `jev-browser.json` from the **current directory**, so run every
`jevb` command from the repo root. The checked-in config launches a
**visible** Chrome window (`"headed": true`; without it jevb runs headless and
nothing appears on screen). Meridian has no camera/mic features, so unlike
Atlas it passes no fake-media launch args. Launch args apply when the
session's browser starts; close the session (or `jevb session clear`) after
editing the file.

## Target

Journeys run against the **local dev stack** started by the operator. The
agent never starts servers.

| Surface              | URL                         | Started by                              |
| -------------------- | --------------------------- | --------------------------------------- |
| Meridian PWA         | `http://localhost:4001`     | `bun run dev:pwa` (this repo, PWA+API)  |
| Meridian API         | `http://localhost:4000`     | same                                    |
| Hub API + OIDC       | `http://localhost:4828`     | `bun run dev` in `stageholder-identity` |
| Hub web (login page) | `http://localhost:4829`     | same                                    |
| MongoDB              | `mongodb://localhost:27017` | operator (`docker-compose.yml`)         |

Check before starting a journey:

```bash
lsof -nP -iTCP:4000 -iTCP:4001 -iTCP:4828 -iTCP:4829 -sTCP:LISTEN
```

If anything is missing, stop and ask the operator to start it. Do not run
write journeys against production; use it only for read-only checks (login
redirect, `/goodbye` renders).

Scope: `jevb` drives Chrome, so it covers the PWA and, by extension, the
Tauri desktop app (same bundle). The Expo native app (`apps/mobile`) is out of
reach; native changes are verified by the operator on a device or simulator.

Facts that shape the journeys (from source, 2026-10-11):

- The PWA has **no local login form**. `_app/route.tsx` `beforeLoad` sends an
  anonymous visitor to `/auth/login?returnTo=…`, which calls the SDK's
  `signIn()` on mount and bounces to the Hub login page. The Hub redirects
  back to `/auth/callback?code=…`, the SDK finishes the PKCE exchange and
  lands on `returnTo`. A journey therefore signs in on the Hub page.
- Gate after sign-in: `/me` `hasCompletedOnboarding === false` → `/onboarding`
  (the shared `OnboardingWizard`). `null` (still loading or failed) must
  **not** redirect; a flaky API that dumps an onboarded user into onboarding
  is a regression.
- App routes: `/` (Today dashboard), `/habits`, `/habits/$id`,
  `/habits/archived`, `/habits/group/$groupId`, `/todos` (+ `/inbox`,
  `/upcoming`, `/completed`, `/$listId`), `/journal`, `/journal/new`,
  `/journal/$id`, `/calendar`, `/journey`, `/settings` (tabs `profile`,
  `targets`, `account`), `/settings/billing`, `/settings/billing/upgrade`,
  `/settings/billing/success`.
- Public routes: `/auth/login`, `/auth/callback`, `/auth/error`, `/goodbye`
  (post-logout), `/billing/complete` (desktop billing return).
- Access tokens live in `localStorage` (SDK `LocalStorageAdapter`), so
  `jevb state save` captures a signed-in session.
- **Journal is end-to-end encrypted.** First use shows the passphrase setup
  dialog and recovery codes; later sessions show the passphrase prompt. The
  decrypted key (DEK) is held in memory only (`lib/crypto/encryption-store.ts`),
  so every reload, new session and `state load` locks the journal again.
  Plaintext must never appear in network request bodies.
- Habit entries are one per habit per day: a check-in creates or updates,
  never duplicates.
- The dev identity is the Hub's seeded admin (`ADMIN_EMAIL` / `ADMIN_PASSWORD`
  in the identity repo's `.env`), or a test user created by Hub journey 2.

## Conventions

- One `jevb` session per journey, named `mer-<journey>`; close it with
  `jevb session close mer-<journey>` when done.
- Test identities use `jevb+<label>-<timestamp>@e2e.stageholder.com`, the same
  shape the Hub and Atlas harnesses use.
- Test records carry the prefix `JEVB ` in their name or title (`JEVB habit
1791…`, `JEVB todo …`, `JEVB list …`) so they can be found and deleted.
- Passwords, journal passphrases and recovery codes go through
  `--value-stdin` on `page act --op fill`, never in the instruction string or
  an `element fill` argument. Keep a run's journal passphrase in a scratchpad
  file, not in the transcript.
- Always run `page act` with `--json --non-interactive`, read `data.status`
  and the exit code (0 executed/preview, 1 error, 2 needs confirmation, 3
  execution unknown), then confirm the business state with
  `page get <s> url --json`, `page read`, or `page get <s> text <selector>` on
  an independently chosen element. Never replay a write after exit 3.
- Prefer the deterministic path: `page snapshot <s> -i --json`, then
  `element fill <s> @eN "value"` / `element click <s> @eN`. Use Jev
  (`page act <s> "…"`) for obvious primary buttons and for picking among
  similar rows.
- The PWA has no `data-testid` attributes. Use `element find <s> role …
--name …`, `element find <s> label … fill …`, or snapshot refs.
- Kit tips carried over from the Hub/Atlas runs (same `@stageholder/ui`
  kit): chip inputs need `keyboard press <s> Enter` before submit; fill
  `input[type="date"]` by CSS selector instead of opening the calendar
  popover; Polar card fields live in cross-origin iframes `frame switch`
  cannot enter.
- After every navigation, run `console errors <s> --json` and treat any
  uncaught error, or a failed request to `:4000`, as a finding.
- **Reusing a login:** after journey 2 signs in, save the state once per run
  to the scratchpad, not the repo:
  `jevb state save mer-login <scratchpad>/meridian-admin.json`. Later sessions
  start with `jevb page open mer-<j>` (no URL), `jevb state load <file>`,
  then navigate. State files contain live tokens; never commit or paste them.
- Responsiveness and failure journeys (the "no UI hang" goal of the data
  layer): `jevb network requests --filter :4000 --json` lists the API calls a
  screen made (catches fan-out regressions), `network request <id>` shows a
  body, and `network route '<pattern>' --abort` (undo with `network unroute`)
  forces a failure so you can assert the optimistic update rolls back with a
  toast instead of hanging. `jevb` has no throttling.

## Journeys

Each step is one `jevb` call. Assertions are the state the agent must observe
before moving on.

### 1. Anonymous surfaces (safe on production too)

1. `page open mer-anon <pwa>/` → assert redirect via `/auth/login` to the Hub
   login page on `:4829`, with `returnTo` preserved; no error boundary.
2. `page open mer-anon <pwa>/journal` → same redirect, `returnTo` carries
   `/journal`.
3. `page open mer-anon <pwa>/goodbye` → renders without a session.

### 2. Sign-in round-trip → Today

1. `page open mer-login <pwa>/habits`; on the Hub page fill email and
   password (`--value-stdin`); submit.
2. Assert URL returns to `<pwa>/habits` (not `/`, not `/onboarding` for an
   onboarded user) and the app shell sidebar renders.
3. `console errors` clean; `state save` to the scratchpad.
4. Sign out from the shell; assert `/goodbye` and that `/` now bounces to
   login.

### 3. First-run onboarding (fresh test user)

1. Create a user via Hub journey 2, then sign in to Meridian.
2. Assert redirect to `/onboarding`; walk the wizard steps.
3. Finish → assert the app opens immediately (finish never blocks on the
   network) and a reload stays out of `/onboarding`.

### 4. Habits

1. `/habits` → create `JEVB habit <ts>` with an icon; assert it appears.
2. Check it in for today; assert the row shows done **and** a second tap
   toggles/updates the same entry (no duplicate, no 409 toast).
3. Open `/habits/$id`; assert streak and the calendar ring reflect today.
4. Create a group, move the habit into it, reorder; assert after reload.
5. Archive → assert it moves to `/habits/archived`; restore.

### 5. Todos

1. `/todos/inbox` → quick-add `JEVB todo tomorrow 9am`; assert the
   smart-parse pill sets the do-date and the title is stripped of the date.
2. Create list `JEVB list <ts>`; move the todo into it; assert in `/$listId`.
3. Complete → assert it lands in `/todos/completed`; reopen → back in list.
4. `/todos/upcoming` shows the dated todo under the right day.

### 6. Journal (end-to-end encryption)

1. `/journal` as a user without a passphrase → setup dialog; fill passphrase
   twice (`--value-stdin`); assert recovery codes panel; save codes to the
   scratchpad only.
2. `/journal/new` → write `JEVB entry <ts>`; assert autosave, then the entry
   in the list. Check with `network` that the request body is ciphertext,
   not the entry text.
3. `page reload` → assert the passphrase prompt (locked); unlock; assert the
   entry decrypts.
4. Wrong passphrase → inline error, still locked.
5. "Forgot passphrase?" → recovery-code path with one saved code.

### 7. Today, calendar and journey

1. `/` → assert Today widgets (habits, todos, journal) render with the data
   created above and no skeleton stays stuck.
2. `/calendar` → today's ring reflects the habit check-in.
3. `/journey` → light tier and thresholds render.

### 8. Settings

1. `/settings` profile tab: edit display name; assert after reload.
2. `targets` tab: change a target; assert Today reflects it.
3. `account` tab: renders; do not delete the account.
4. Journal security: change passphrase (old → new via `--value-stdin`);
   reload; unlock with the new one.

### 9. Billing and plan limits (Polar sandbox only)

1. `/settings/billing` → current plan renders.
2. On the free plan, exceed a limit (e.g. todo lists) → paywall/upgrade
   prompt, not a generic error.
3. `/settings/billing/upgrade` → checkout opens on Polar sandbox. Card fields
   are cross-origin iframes; stop there unless the operator completes
   payment, then assert `/settings/billing/success` and the refreshed plan.

## Cleanup

Delete `JEVB ` habits, groups, todos, lists and journal entries created by a
run through the UI or the API. Close sessions with `jevb session close
mer-<j>` (or `jevb session clear` at the end of a run) and delete saved state
and passphrase files from the scratchpad.

## Run log

### 2026-10-11 — setup only, no journeys run

- `jevb` 0.2.0 already installed globally, TypeSafe key saved
  (`jevb auth status` → `typesafe: file`); `jevb browser doctor` passes apart
  from its own long-session-name socket check (Chrome 155, ffmpeg present).
- Added `jev-browser.json` (headed), `.claude/skills/jev-browser/SKILL.md`,
  this plan, and the CLAUDE.md pointer.

### 2026-10-11 — Jev QA pass + reproducible Playwright suite

Jev (`jevb`, headed) on the local stack:

- Journey 1 passes: anonymous `/habits` → Hub login with `client_id=meridian`,
  PKCE S256, `offline_access organizations product_access subscriptions`
  scopes.
- Registered the dedicated account `jevb+meridian-owner@e2e.stageholder.com`
  on the local Hub (credentials only in the gitignored
  `apps/pwa/e2e/.env.e2e`). Journeys 2–3 pass: sign-in → `/onboarding`
  (5 steps: welcome, profile, goals, features, all set) → "Go to Dashboard"
  → `/`, and a reload stays out of onboarding. Every app route rendered with
  no console errors.
- Jev quirks: `page act --op fill "Password" --value-stdin` returned
  `NO_MATCH` on the Hub register/login forms (Jev declines to target password
  inputs; ~0.6 confidence on "none"). Use `element fill 'input[type=password]'`
  with the value from an env var instead. On the onboarding finish step
  `page act` returned `needs_confirmation` (exit 2): it treats "finish" as a
  write; click the named button with `element find … role button click`.
  `page navigate` did not move the page; use `page open <s> <url>` to navigate.

Findings:

- **FIXED — journal recovery codes were never shown (PWA).**
  `encryption-gate.tsx` rendered `PassphraseSetupDialog` only in its
  not-set-up branch; `setupPassphrase` flips the store to set-up + unlocked
  as soon as the key exists, so the dialog unmounted before its "Save Your
  Recovery Codes" step. A user who forgot the passphrase had no way back in.
  The dialog now stays mounted at the same tree position in both states.
  Mobile hosts the form in an always-mounted FormSheet and was not affected.
  Guarded by `first-run.e2e.ts` (verified: it fails on the old code).
- Minor UX: after typing a smart-parse token (`!p1`), the suggestion popover
  covers the "Add Todo" button; a mouse user must dismiss it first (Enter
  works: first picks the suggestion, second submits).
- Minor visual: adding a todo cross-fades the optimistic row (temp id) into
  the server row (real id), so the row briefly appears twice / fades out and
  back in. It settles to one fully opaque row within ~1.5 s.

Reproducible suite: `apps/pwa/e2e/` (Playwright 1.63, see its README),
29 tests across smoke, auth, first-run, habits, todos, journal, settings.
`bun run e2e` passed 29/29 twice back-to-back with `--retries 0` (~2.2 min
each), the second run on the first run's leftovers.

### 2026-10-11 — SDK alpha.65 → alpha.70

- Bumped `@stageholder/sdk` to `1.0.0-alpha.70` (root, pwa, mobile, api),
  purged nested alpha.65 copies. Billing: `instanceof BillingError` (never
  matched across the `/core` vs `/spa` bundles) → `isBillingError`;
  `BILLING_PORTAL_UNAVAILABLE` copy; "Manage payment" failures now toast.
- First suite run hit `does not provide an export named 'isBillingError'` on
  every page: the running Vite server still served its pre-bundled alpha.65.
  Restart `bun run dev:pwa` after any SDK/kit bump.
- After the restart `bun run e2e`: 29/29 passed with `--retries 0` (2.7 min).
  Native mobile and desktop auth still need a manual check on a dev build.

### 2026-10-11 — launch readiness: webhooks, payment end to end, pre-prod fixes

Webhooks:

- Meridian's ngrok tunnel pointed at `:4001` (the PWA's Vite server → 403
  "Blocked request. This host is not allowed"). The API is `:4000`.
- **FIXED** `main.ts`: a pre-registered `express.json()` swallowed
  `req.rawBody`, so every genuine delivery failed ("missing rawBody", surfaced
  as 500); the webhook exception filter was also registered in the wrong
  order (catch-all won → 500 instead of 401). Now: signed → 200, forged → 401.
- **FIXED** missing `STAGEHOLDER_WEBHOOK_SECRET` now fails boot in production
  (it silently rejected every webhook, including the GDPR `user.deleted`).

Payment (Polar sandbox, `payment.e2e.ts`, passing):

- **FIXED** success page said "You're on Free." after paying, and the plan
  stayed Free for up to ~1 h: `useRefreshSession()` only invalidates queries,
  it never re-mints the token. Now `useStageholder().refreshSession()` +
  retry until the plan moves (also in the desktop billing-return hook).
- **FIXED** `instanceof BillingError` never matched (`/core` vs `/spa` class
  copies) → tailored billing errors now show; "Update billing email" went to
  Meridian's own billing page (no such field, dead end) → now opens Hub
  `/account/<org>/settings`.
- **FIXED** billing page had no renewal / trial-end / cancellation info;
  cancelling in the portal left no trace. Now "Trial ends …", "Renews …",
  "Cancelled: Unlimited ends …, then you move to Free."
- **FIXED** paid users fell back to free caps for features the plan lacks
  (`max_habit_groups` → 5 for Unlimited). Free fallbacks now match the Hub
  (3 habits, 5 lists); paywall suggests the real slug `unlimited`.
- **FIXED** header trial pill collapsed to 22 px and "14 days left" spilled
  over the journey badge (Tamagui `group` = `container-type: inline-size`).
- Upgrade page now prices in the org's billing currency
  (`/api/billing/pricing/meridian/for/:orgId`, Atlas parity).
- Verified: checkout (IDR 0 today, 14-day trial) → Hub row `unlimited ·
trialing` → Meridian processed `subscription.activated/updated` → API limits
  all `-1` → 4 habits / 10 groups allowed → portal opens → cancel →
  `subscription.canceled` processed → Hub `cancel_at_period_end`.
- Open (Hub catalog, needs the operator — import was permission-blocked):
  Free highlights advertise "Up to 3 members / 1 GB storage"; Unlimited has
  no highlights and isn't featured; features include Team Members + Storage
  and lack Habit groups; product description is Atlas's tagline. Proposed
  catalog: `docs/billing/meridian-hub-catalog.json`.
- Open: plan page showed USD while Polar charged IDR locally (no geo headers
  on localhost; confirm on production). Shared sandbox billing email = one
  Polar customer, so its portal/invoices also show Atlas test subscriptions.

Pre-prod review (2026-07-27) items fixed: `GET /feedback` scoped to the
caller; PWA journal DEK + decrypted cache cleared on sign-out / account
switch; mobile sign-out failure re-binds RevenueCat; core `upcoming.ts`
UTC date key (mobile "Tomorrow"); mobile `entryDay` UTC fallback; unsafe
`returnTo`; mobile journal auto-locks after 5 min in background; server
"today" now uses the caller's `X-Timezone` (Light/streak days). Item 8
(mobile journal autosave flicker) was already fixed by the July data-layer
refactor; item 9 (ENCRYPTION_KEY) already enforced.

Suite: 33 tests — 31 passed, 2 skipped (opt-in payment; Free paywall while
the owner account sits on its cancelled trial until Oct 25). Payment journey
passed separately (1.6 min).

### 2026-10-11 — Hub catalog fixed via jevb (local Hub, admin)

Driven with `jevb` (session `hub-adm`) on `localhost:4829/admin/products/meridian`:

1. Overview → Description: "Your personal space for habits, todos and an
   end-to-end encrypted journal." (was Atlas's tagline) → Save; verified
   after reload.
2. Plans & Pricing → Import `docs/billing/meridian-hub-catalog.json` (hidden
   file input → `element upload`) → "0 added, 2 updated · 1 features added,
   5 updated · 4 prices written" (prices unchanged).
3. Features → selected Team Members + Storage → Delete ("Delete 2
   features?") → catalog is now Habits / Habit groups / Todo lists / Active
   todos (Free 3/5/5/10, Unlimited unlimited).
4. Preview & sync → "Apply 2 changes" (update Unlimited monthly + yearly
   Polar products, 0 create/archive) → In sync, no sync error.

Meridian plan page now shows Meridian's own highlights, Unlimited featured
("Most popular" badge moved off the tier bars), comparison table without
members/storage. Suite after: 31 passed, 2 skipped (expected).
Production Hub still needs the same four steps.

### 2026-10-12 — Hub webhooks that change Meridian data: `user.deleted`

Only `user.deleted` is effectful in Meridian (subscription/org/profile events
are logged no-ops; the plan comes from the token). Tested live:

- Throwaway account seeded in 11 collections, then deleted by the customer
  with `jevb` on Hub → Account → Security → Delete account. Meridian
  processed `org.deleted` + `user.deleted` within ~1 s.
- **FIXED** the cascade skipped `habit_groups` (5 rows left, incl. the
  user's own group names). `HabitGroupService.deleteAllForUser` existed but
  was never called. Now every one of the 14 user collections is empty.
- Regression: `account-deletion.e2e.ts` (opt-in `E2E_WEBHOOKS=1`) — verified
  it FAILS on the old handler (`habit_groups: 5`) and passes with the fix.
- **Hub bug, NOT fixed (editing the identity repo was permission-blocked):**
  admin console "Delete user" (`AdminUsersService.deleteUser`) deletes the
  row only and emits NO `org.deleted` / `user.deleted`, so a user deleted by
  an admin (e.g. handling an erasure request) keeps all their data in every
  product. The self-service path (`AccountController`) emits both in one
  transaction; the admin path should do the same.

Suite after: 31 passed, 3 skipped (2 opt-in journeys + Free paywall while
the owner account is on its cancelled trial).

### 2026-10-16 — desktop sign-in moved to the system browser (local Hub)

Installed desktop v0.2.5 opened on `{"message":"Cannot GET /?error=invalid_client…"}`:
its build uses client `meridian-desktop`, which production Hub doesn't have, and
Better Auth's `/oidc/error` redirected to the API root. Desktop now signs in in
the system browser (RFC 8252) and returns on `meridian://auth/callback`
(`apps/pwa/src/lib/desktop-auth.ts`, SDK `StageholderSpaConfig.navigate`).

- Local Hub: `meridian-desktop` switched to Native (app type is immutable in the
  admin UI, flipped `oidc_clients.application_type` in the local DB), then via
  jevb on Products → Meridian → Apps: redirect URIs `meridian://auth/callback`,
  `meridian-dev://auth/callback`, post-logout `http://localhost:4001/goodbye`.
- Debug bundle (`Meridian Dev.app`, scheme `meridian-dev`) against the local
  stack, Hub login driven with jevb, deep link handed to macOS with `open`:
  cold start signs in (token `azp: meridian-desktop`, refresh + id token,
  Meridian API 200); warm deep link reloads once, single process; Hub's two
  redirects for one login (two codes, same `state`) raced and left the app
  signed out until callbacks were deduped by `state`.
- Not driven: clicking the in-app buttons and sign-out (no macOS
  Accessibility/Screen Recording for the agent's terminal).
- Hub: `/oidc/error` now lands on Hub web `/auth/error`.
- Suite after: 31 passed, 3 skipped.

### 2026-10-17 — desktop payment round trip, reproducible (`payment-desktop.e2e.ts`)

The desktop billing flow (checkout / portal → system browser → public
`/billing/complete` → focus refresh in the app) had never been run end to end.
It now is, in Playwright rather than jevb, because the Tauri app is this same
PWA bundle behind `window.__TAURI_INTERNALS__`: `e2e/support/tauri-stub.ts`
answers the app's Tauri IPC in Chromium (opener → recorded, store → localStorage,
log/notification/updater → no-ops) and a second plain browser context plays the
system browser (no Tauri, no session). Opt-in with the web journey:
`E2E_PAYMENT=1 bun run e2e -- payment`.

- Passing (desktop 1.8 min, web 1.4 min): "Update billing email", checkout and
  the portal all go to the opener and the app window stays on its route; Polar
  returns the browser to `http://localhost:4001/billing/complete` (renders with
  no session, no login bounce, no app shell); after a synthetic focus the app
  POSTs `/oidc/oauth2/token`, the upgrade page flips to "Currently trialing this
  plan" with no reload, a reload keeps the session (stubbed Tauri store), and
  after cancelling in the portal the billing page shows "Cancelled: Unlimited
  ends …".
- **FIXED** `useBillingReturnRefresh` rotated the token ONCE on return; Polar
  redirects before its webhook reaches the Hub, so a quick return could pin the
  old plan until the token's natural expiry. Now re-rotates every 2 s until the
  subscription claim changes (≤ 15 tries), like the web success page.
- Polar's sandbox portal changed since 2026-10-11: cards are headed
  "Meridian Unlimited — Monthly" (catalog name) and cancelled ones show
  "Uncancel" (active ones no longer show "Change plan"). `cancelAllMeridianTrials`
  (now shared in `e2e/support/polar.ts`) matches `/^Meridian\b/` level-3
  headings without an "Uncancel" button. The web journey would have failed the
  same way.
- One retry lost a press on "Update billing email" while the error banner was
  animating in; `tauriStub.next()` now repeats the click every 5 s until the
  opener gets a URL.
- Environment: the first run skipped everything with "Sign-in via the Hub
  failed" — the local Hub's DB is a remote Neon Postgres (ap-southeast-1) and the
  code exchange took 9–12 s (> the SDK's 10 s cold-start budget) until the
  network recovered ~15 min later. `curl -w %{time_total}
localhost:4828/oidc/jwks` above ~0.3 s = wait, not a Meridian bug.
- Not driven: the real packaged `.app` (opener/store plugins are stubbed, deep
  links are not involved in billing). Still open: a `meridian://billing/complete`
  deep-link return so the browser jumps back to the app by itself.

Full-suite run afterwards surfaced two unrelated PWA bugs (both FIXED):

- **FIXED** `todos › create a list and add a todo into it` failed under today's
  latency: adding a todo while the list's FIRST fetch is still in flight. The
  optimistic contract cancels in-flight fetches of every cache it writes, and a
  query cancelled before it ever had data stays `pending`/`idle` with no data —
  the list rendered "No todos yet" until a reload. `lib/query-client.ts` now
  has a `MutationCache.onSettled` that refetches exactly those data-less,
  observed queries after every mutation (nothing was on screen, so nothing can
  revert).
- **FIXED** that hook first did nothing because `StageholderSpaProvider` (nested
  inside the app's `<QueryClientProvider>`) creates its OWN QueryClient when
  `config.queryClient` is not passed — every view ran on the SDK's private
  client and the module-level singleton was dead. That also meant
  `encryption-store.ts`'s `lock()` evicted journal plaintext from a cache no
  view reads. `App.tsx` now passes `queryClient` into the SDK config.
- `first-run` (Hub sign-up spinner > 30 s) and the `auth` flakes were the slow
  Hub ↔ Neon link (a direct sign-up POST took 25 s). Spec hardening so a slow
  Hub degrades to "slow", not "red": sign-up waits 60 s; `setBillingEmail`
  waits for the Hub to accept the save and re-reads the value after a reload
  (the web journey used to ask for a checkout while the save was still in
  flight → "billing email's domain doesn't accept mail" again); the upgrade
  page's trial button is awaited for 60 s before the first click.
- Final: full suite 30 passed / 2 skipped (account-deletion, paywall) with the
  desktop paid journey green; `first-run` and the web paid journey green on
  their own reruns after the hardening (web needed its retry once: the trial
  button took > 15 s to render under latency, hence the last change).

### 2026-10-17 — PRODUCTION Hub fixed via jevb (admin, user-authorised writes)

Driven with `jevb` (session `hub-prod`) on `hub.stageholder.com/admin/products/meridian`,
with the operator's explicit go-ahead for production writes (the usual rule is
read-only). Every write was confirmed through the Hub admin API
(`id.stageholder.com/api/admin/...`) afterwards, not from the form state.

- Apps: **created `meridian-desktop`** (Native, first-party, PKCE public client;
  grants authorization_code + refresh_token; all scopes; redirect URIs
  `meridian://auth/callback` + `meridian-dev://auth/callback`; post-logout
  `https://meridian.stageholder.com/goodbye`). `meridian-web` (the client the
  web deploy uses — `deploy/cloudbuild.pwa.yaml` default) got the missing
  post-logout `https://meridian.stageholder.com/goodbye`.
- **Not fixable from the UI:** the legacy `meridian` SPA client has
  `client_credentials` in its grant types; the editor shows "Grant
  client_credentials is not allowed for a Single-Page App" with the checkbox
  disabled, so Save never fires (no PATCH). It still only allows
  `http://localhost:4001/auth/callback`. Nothing in production uses it; fix the
  row in the identity repo/DB or archive it.
- Overview → description set to Meridian's tagline (PATCH 200, "Saved just now").
- Plans & Pricing → Import. **Prices were deliberately NOT taken from
  `docs/billing/meridian-hub-catalog.json`** ($4.99/$49, Rp 19,000/199,000,
  14-day trial): production sells Unlimited at $2.29/mo, $19/yr, Rp 39,999/mo,
  Rp 149,999/yr with a 7-day trial, and the operator chose to keep that. A copy
  with production prices + `trialDays: 7` was imported instead (POST
  `/plans/import` 201). Free limits now 3 habits / 5 groups / 5 lists / 10 todos.
- Features → deleted Team Members + Storage (bulk-delete 201). Catalog is
  Habits / Habit groups / Todo lists / Active todos.
- Preview & sync → "UPDATE 2" (Polar product names → "Meridian Unlimited —
  Monthly/Yearly" + hub metadata; no create/archive, no price change) → Apply →
  2 succeeded, `sync.status: in_sync`.
- jevb notes: `element fill` APPENDS to a non-empty field and `keyboard press
Meta+A` does not select-all — use `page eval` `el.select()` + `keyboard type`
  (real key events; React state updates, scripted `value=` does not submit).
  `network requests` captured nothing; a `window.fetch` wrapper installed via
  `page eval` did. Auto-mode classifier: only pure `jevb …` commands pass the
  `Bash(jevb *)` allow rule — no pipes, `grep`, `sleep`.
- Follow-ups: rotate the Hub admin password (it was pasted into the chat);
  the catalog file in `docs/billing/` still carries the $4.99 prices.
