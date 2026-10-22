# Meridian mobile E2E journeys (Maestro)

The native counterpart of the PWA's Playwright suite (`apps/pwa/e2e`): real
journeys driven on the iOS simulator or Android emulator against the **local
dev stack**, rerun after any change to make sure the app still works.

[Maestro](https://maestro.dev) drives the real native UI (taps, swipes, the
system sign-in sheet, the native tab bar and back gesture), so it tests what a
user touches, not a web rendering of it. Flows are YAML in `flows/`, shared
steps in `subflows/`.

## One-time setup (per machine)

1. **Maestro CLI** (needs Java 17+):
   ```bash
   curl -fsSL --location https://github.com/mobile-dev-inc/maestro/releases/latest/download/maestro.zip -o /tmp/maestro.zip
   unzip -q -o /tmp/maestro.zip -d ~/.maestro
   ```
   The runner finds `~/.maestro/maestro/bin/maestro` on its own (or `maestro`
   on `PATH`). `brew install mobile-dev-inc/tap/maestro` works too once the
   Xcode license is accepted.
2. **iOS**: `sudo xcodebuild -license accept`, then a dev build on a booted
   simulator: `bun run ios`.
   **Android**: a booted emulator and a dev build: `bun run android`.
3. **Account**: the suite reuses the PWA suite's dedicated test account —
   `E2E_EMAIL` / `E2E_PASSWORD` / `E2E_JOURNAL_PASSPHRASE` from
   `apps/pwa/e2e/.env.e2e` (gitignored) or the environment. See
   `apps/pwa/e2e/README.md` → "Account and credentials".

## Run

Start the stack yourself (API `:4000`, PWA `:4001`, Hub `:4828`/`:4829`).
Then, from `apps/mobile`, either:

**Release build (recommended on Android)**: precompiled Hermes bytecode with
the local-stack URLs baked in, no Metro. This is what users run: it starts in
seconds and holds ~420 MB, where a dev-client build parses raw JS on every
launch, which on an emulator takes minutes and 1 GB+ and makes runs flaky.

```bash
bun run e2e:build:android            # once per app change (~1 min incremental); installs on the emulator
bun run e2e:android:release          # every journey
```

The build is E2E-only: `e2e/android/cleartext.init.gradle` merges a manifest
overlay that allows plain HTTP to the local stack, and it builds only
`arm64-v8a` (override with `E2E_ABI=x86_64` on an Intel emulator). Store
builds are unaffected.

**Dev build + Metro**: `bun run e2e:metro` (serves production-mode bundles
pointed at localhost, ignoring `.env.local`), dev build installed, then:

```bash
bun run e2e                          # every journey, iOS simulator
bun run e2e:android                  # every journey, Android emulator (adds adb reverse)
bun run e2e -- flows/habits.yaml     # one journey
bun run e2e:studio                   # Maestro Studio: inspect the screen, record steps
```

Use an emulator with **≥4 GB RAM and several cores** (`emulator -avd <name>
-memory 4096 -cores 4` — the stock AVD config is 1 core); on 2 GB the UI stalls
and taps get lost. Only one Maestro run per machine: two CLIs kill each other's
driver. Emulator traps seen on 2026-10-18: a host under heavy load (load
average > 20) starves the guest until Android shows "Pixel Launcher isn't
responding" over every launch — that is not an app bug, calm the host or
`adb reboot`; `INSTALL_FAILED_INSUFFICIENT_STORAGE` means `/data` is full —
`adb uninstall com.stageholder.meridian` then install; Gboard drops keystrokes
on a starved emulator, so flows that type verify the field and retry. Maestro
also installs its own driver APK, so a full `/data` fails the run before any
flow with "Requested internal only, but not enough space" — keep a few hundred
MB free (uninstall stale builds of other apps). With two emulators attached
(another project's AVD, for instance) pin the run:
`ANDROID_SERIAL=emulator-5556 E2E_PIN_DEVICE=1 bun run e2e:android:release`.
A full HOST disk (macOS APFS container) silently kills the emulator mid-run
and makes every tool fail with `ENOSPC` — keep a few GB free (AVD images,
`~/.gradle/caches`, `~/Library/Caches` and Xcode DerivedData are the usual
hogs). Sheet-open latency can be measured without a profiler: Maestro
`startRecording`/`stopRecording` (relative name; the mp4 lands under the
test-output dir) or `adb shell screenrecord`, then ffmpeg `signalstats` on a
top strip (overlay dim) and a bottom strip (frame arrival).
Known app-side flake the flows tolerate: on Android the todo row's long
swipe-right reveals the green "Done" panel but does not auto-commit
(kit `SwipeableRow` `autoCommit` relies on RNGH `onSwipeableOpen`); the
todos flow taps the revealed panel when it stays open.

Each run: checks the stack → signs the account in headlessly (only to get an
API token) → **wipes the account** (habits, todos, lists, groups, journal; it
refuses to run unless `E2E_EMAIL` is a `jevb+…` account) → runs the journeys
→ wipes again. Screenshots and logs of failures land in `e2e/.output/`
(gitignored).

## Journeys

| Flow         | What it proves                                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `smoke`      | Signed-in launch lands on Today; every tab renders                                                                                                           |
| `navigation` | Detail screens push on a native stack; back gesture / Android Back returns to where you came from (Calendar → Today, Billing → Settings, Journey → Settings) |
| `habits`     | Create → check in → persists across relaunch → detail opens with native header → back                                                                        |
| `todos`      | Quick-add → swipe-right complete → shows under the Done filter                                                                                               |
| `journal`    | Unlock the encrypted journal → write → header shows "Saved" → Done waits for the save → entry listed                                                         |
| `settings`   | Plan row, Appearance switch, Sign out asks for confirmation                                                                                                  |

## Conventions

- Test data is named `JEVB E2E <label> <timestamp>` (same prefix as the PWA).
- Prefer visible text from the source; key controls without stable text carry
  a `testID` (`fab-new-habit`, `fab-new-todo`, `fab-new-journal`,
  `settings-plan`, `settings-sign-out`, `settings-profile`).
- Every flow starts with `subflows/launch-signed-in.yaml`, so any one of them
  runs on its own.
- Never complete a purchase or change the plan from a flow.

## Store billing (`flows/billing.yaml`)

The paywall talks to RevenueCat, so this journey only exercises purchases when
three things line up; otherwise it just verifies the entry points and the
"billed on the web" / "not live yet" states and passes.

1. **Test Store key in the bundle**: `EXPO_PUBLIC_REVENUECAT_IOS_KEY=test_… bun run e2e:metro`
   (the script ignores `.env.local`, so export the key). The Test Store
   replaces StoreKit with a "Test valid / failed purchase / Cancel" dialog.
2. **Webhook to the local Hub**: RevenueCat → `https://<ngrok>/api/billing/revenuecat-webhook`
   (`ngrok http 4828`) with the Hub's `REVENUECAT_WEBHOOK_SECRET`, and the
   Test Store product ids mapped in the Hub's `store_products` table
   (`monthly` / `yearly` → `unlimited`, platform `app_store`). Without the
   mapping the Hub answers 503 and the plan never flips.
3. **A Free account**: the shared e2e owner is web-billed (Polar), so run
   this journey with a store test account that uses the same password:
   `E2E_EMAIL=jevb+rc-<ts>@e2e.stageholder.com bun run e2e -- flows/billing.yaml`.

Test Store subscriptions renew every few minutes and expire on their own
(~30 min), after which the Hub downgrades the row to Free again — so the
journey can be rerun on the same account. Covered: failed purchase shows an
inline error (the paywall is a native modal, toasts underneath it are
invisible), Cancel is silent, a valid purchase closes the paywall and flips
Settings → Plan to Unlimited via the webhook, Plans & billing shows Apple's
receipts note instead of the (Polar-only) invoice ledger, "Manage in App
Store" presents StoreKit's in-app manage-subscriptions sheet (a system sheet
Maestro cannot read: on the simulator it asks for an Apple Account, so the
journey cancels it by position and swipes it down), Restore purchases
returns the active entitlement.
