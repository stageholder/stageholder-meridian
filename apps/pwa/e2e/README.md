# Meridian E2E journeys (Playwright)

Browser journeys that drive the PWA in a visible Chromium window (headless with
`bun run e2e:headless` or under CI) against the **local dev stack**, so a change to one feature can be
checked against every other flow without clicking through the app. Rerun the
whole suite after any feature change. The tests never start servers; the
operator does.

Exploratory QA with `jevb` and the run log live in
`docs/testing/jev-browser-meridian-journeys.md`; this suite is the
reproducible part of that work.

## Prerequisites

| Surface              | Default URL             | Override          |
| -------------------- | ----------------------- | ----------------- |
| Meridian PWA         | `http://localhost:4001` | `E2E_BASE_URL`    |
| Meridian API         | `http://localhost:4000` | `E2E_API_URL`     |
| Hub API/OIDC         | `http://localhost:4828` | `E2E_HUB_URL`     |
| Hub web (login page) | `http://localhost:4829` | `E2E_HUB_WEB_URL` |

Start the stack yourself: `bun run dev:pwa` at the repo root (PWA + API) and
`bun run dev` in `stageholder-identity`. Chromium for Playwright 1.63 is
installed once per machine (`bun x playwright install chromium`; shared with
Atlas's suite).

## Account and credentials

Credentials come from the environment or the gitignored `e2e/.env.e2e`
(loaded by `playwright.config.ts`). Never commit or print them.

| Variable                     | Purpose                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| `E2E_EMAIL`                  | Dedicated test account, **must** be `jevb+…@e2e.stageholder.com`                     |
| `E2E_PASSWORD`               | Its Hub password                                                                     |
| `E2E_JOURNAL_PASSPHRASE`     | Its journal encryption passphrase (set up by the first journal run)                  |
| `E2E_AUTH_MIN_LEFT_MIN`      | Reuse the saved sign-in only while the token has this many minutes left (default 20) |
| `E2E_FORCE_SIGNIN`           | Any value: sign in again regardless                                                  |
| `E2E_HEADLESS`, `E2E_SLOWMO` | Run without a window; ms per action (default 0)                                      |

The account is wiped before and after each journey file (`api.resetAccount()`:
ALL habits, todos, custom lists and groups, journal entries), which is what
makes runs repeatable on a Free-plan account (3 habits / 10 active todos).
`resetAccount()` refuses to run unless `E2E_EMAIL` starts with `jevb+`, so the
suite can never be pointed at a real account by mistake.

### Re-creating the account on a fresh Hub

1. Hub `http://localhost:4829/auth/register`: create
   `jevb+meridian-owner@e2e.stageholder.com` (local Hub: no email
   verification). Put email + password + a journal passphrase in
   `e2e/.env.e2e`.
2. Run the suite: global setup signs in and finishes Meridian onboarding;
   `journal.e2e.ts` sets the journal passphrase up on its first run.

`first-run.e2e.ts` registers a throwaway `jevb+meridian-new-<ts>@…` account on
the local Hub each run (only when the Hub is on localhost).

## Run

```bash
cd apps/pwa
bun run e2e                          # all journeys, visible window (~2-3 min)
bun run e2e -- smoke                 # stack + every route renders (run first)
bun run e2e -- e2e/habits.e2e.ts     # one file
bun run e2e -- -g "check in"         # by test title
bun run e2e:watch                    # visible, 250 ms per action (easy to follow)
bun run e2e:headless                 # no window (background / CI)
bun run e2e:ui                       # Playwright UI mode (step through, time-travel)
bun x playwright show-report         # last HTML report (traces + screenshots on failure)
bun run check                        # also type-checks the specs (e2e/tsconfig.json)
E2E_PAYMENT=1 bun run e2e -- payment # the Polar sandbox paid journeys, web + desktop (see below)
E2E_WEBHOOKS=1 bun run e2e -- account-deletion  # Hub user.deleted → Meridian erasure
```

Journeys run serially with one worker (one shared account). If the PWA, API
or Hub is down, or credentials are missing, every journey is skipped with the
reason (see `e2e/.auth/skip-reason.txt`).

## Specs

| File                      | Journey                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `smoke.e2e.ts`            | Dashboard greets the account; every app route renders (no error boundary, no API 5xx)                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `auth.e2e.ts`             | Anonymous visit → Hub login with PKCE (`client_id=meridian`, S256); `/goodbye` public; fresh sign-in returns to the requested URL; sign-out ends the session                                                                                                                                                                                                                                                                                                                                                                 |
| `first-run.e2e.ts`        | Hub sign-up → onboarding (persists across reload) → journal encryption setup **shows the recovery codes** → Done → editor opens                                                                                                                                                                                                                                                                                                                                                                                              |
| `habits.e2e.ts`           | Create (persists after reload); check-in creates ONE entry for today, survives reload, undo removes it; detail page; archive → Archived; 4th habit on Free → "Plan limit reached" paywall, nothing created                                                                                                                                                                                                                                                                                                                   |
| `todos.e2e.ts`            | Smart quick-add (`tomorrow !p1` → do-date tomorrow, priority urgent, words stripped, in Upcoming); complete → Completed → reopen → Inbox; create list + add a todo into it                                                                                                                                                                                                                                                                                                                                                   |
| `journal.e2e.ts`          | Wrong passphrase stays locked; new entry autosaves with the text **absent from the POST body** (E2E encryption); reload locks; unlock decrypts                                                                                                                                                                                                                                                                                                                                                                               |
| `settings.e2e.ts`         | Display-name edit persists (restored after); Targets/Account tabs; billing shows the account's real plan → plans page                                                                                                                                                                                                                                                                                                                                                                                                        |
| `api.e2e.ts`              | `GET /feedback` returns only the caller's feedback; Hub webhook receiver: correctly signed → 200, forged → 401 (reads `STAGEHOLDER_WEBHOOK_SECRET` from `apps/api/.env`)                                                                                                                                                                                                                                                                                                                                                     |
| `account-deletion.e2e.ts` | **Opt-in (`E2E_WEBHOOKS=1`)**, GDPR erasure: fresh account with data in every collection (journal keys + encrypted entry, habit + check-in/Light, habit group, todo list + todo, feedback) deletes itself on the Hub (Account → Security) → Meridian's `user.deleted` handler must leave ZERO rows in all 14 user collections (checked directly in Mongo via `MONGODB_URI` from `apps/api/.env`)                                                                                                                             |
| `payment.e2e.ts`          | **Opt-in (`E2E_PAYMENT=1`)**, Polar sandbox: fresh account → rejected billing email shows the tailored error → "Update billing email" opens Hub org settings → checkout with test card 4242 → success page says "You're on Unlimited." → billing shows the trial end → cancel in the Polar portal → billing shows "Cancelled: … ends …"                                                                                                                                                                                      |
| `payment-desktop.e2e.ts`  | **Opt-in (`E2E_PAYMENT=1`)**, the same journey as the Tauri DESKTOP app: the page is stubbed as the Tauri webview (`support/tauri-stub.ts`), a second plain browser context plays the system browser → "Update billing email", checkout and the portal go to the OS opener and the app window stays put → Polar returns the browser to the public `/billing/complete` page (no session, no login bounce) → back in the app, the focus handler rotates the session and shows the trial, then the cancellation, with no reload |

## Live-webhook journeys (Polar sandbox, account deletion)

`payment.e2e.ts`, `payment-desktop.e2e.ts` and `account-deletion.e2e.ts`
need the Hub → Meridian webhook loop live, so they are opt-in:

- Hub reachable by Polar (its Polar webhook endpoint, e.g. `ngrok http 4828`).
- Meridian's API reachable by the Hub: `ngrok http 4000` (the API port —
  `4001` is the PWA's Vite server, which answers 403 "Blocked request"),
  registered in Hub admin → Products → Meridian → **Webhooks** as
  `https://<host>/api/v1/webhooks/stageholder`, and that endpoint's signing
  secret in `apps/api/.env` as `STAGEHOLDER_WEBHOOK_SECRET`.

Every paid run registers `jevb+meridian-pay-<ts>@…` (desktop:
`jevb+meridian-desk-<ts>@…`) on the local Hub, sets its
org's billing email to `jevb-billing-test@stageholder.com` (Polar refuses
domains without MX records, like `e2e.stageholder.com`), and ends by
cancelling every still-active "Meridian Monthly" in the shared sandbox
portal — so runs leave only cancelled trials behind. All test accounts share
that billing email, i.e. one Polar customer: its portal also lists Atlas
test subscriptions, which the journey never touches.

The browser is pinned to `Asia/Jakarta` (east of UTC) in
`playwright.config.ts`, so date-key bugs that only show east of UTC fail
every run.

## Conventions

- Test data is named `JEVB E2E <label> <timestamp>` (`uniqueName()`).
- The `page` fixture fails a test on any uncaught page error or Meridian API
  5xx. Opt out per test with `test.use({ allowPageErrors: true })` only with
  a comment naming the bug.
- No `data-testid`: roles, labels and visible text, taken from the source.
- Setup/cleanup that is not under test goes through `support/api.ts` (REST
  with the saved session's token); its errors never include headers.
- Auth/first-run journeys use a fresh anonymous context: signing out in the
  shared saved state would revoke the token every other journey reuses.
- Kit quirks: Playwright treats `opacity: 0` as visible, and adding a todo
  cross-fades the optimistic row into the server row; `settledRow()` in
  `todos.e2e.ts` waits for exactly one fully opaque row. The smart-parse
  suggestion popover covers "Add Todo", so submit with Enter (first Enter
  picks the suggestion, second submits).
- Never: complete a checkout or change the plan.

## Probes

Throwaway exploration specs go in `e2e/.probe/` (gitignored, excluded from the
main config and lint) and run with `bun x playwright test -c
e2e/.probe/config.ts <name>`, where `config.ts` spreads the main config with
`testDir: "."`. Print `await page.locator("main").ariaSnapshot()` to learn
roles and names.
