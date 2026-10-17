# Expo SDK 54 → 56 Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `apps/mobile` from Expo SDK 54 (RN 0.81.5 / React 19.1.0) to Expo SDK 56 (RN 0.85 / React 19.2) with zero feature or visual regression, unlocking the `@expo/ui` native-UI stack for sub-projects 2 and 3.

**Architecture:** Tool-driven incremental bump on a dedicated branch. Expo CLI aligns all Expo-managed native modules; five non-Expo JSI modules are bumped by hand. The one non-trivial code change is adapting `@repo/crypto`'s native primitives to `react-native-quick-crypto` v1 (Nitro Modules) while preserving byte-for-byte wire compatibility. Everything else is dependency/config reconciliation validated by manual QA on dev builds.

**Tech Stack:** Expo SDK 56, React Native 0.85, React 19.2, Bun 1.3.6 (package manager + workspaces), Turborepo, Tamagui 2.3.2 (unchanged), `@stageholder/ui` alpha.126 (unchanged).

## Global Constraints

- **Scope: `apps/mobile` ONLY.** Do not modify the PWA, desktop, the kit (`@stageholder/ui`), or Tamagui (pinned 2.3.2 via root `resolutions`/`overrides`). Exception: `packages/crypto/src/primitives.native.ts` (native-only file, consumed by mobile).
- **Target versions (exact):** `expo` `~56.x`, `react`/`react-dom` `19.2.x`, `react-native` `0.85.x`, `react-native-quick-crypto` `^1.1.6`, `react-native-nitro-modules` `^0.36.4`, `react-native-keyboard-controller` `^1.22.2`, `react-native-purchases` `^10.5.0`, `react-native-quick-base64` `^3.0.1`. Prefer whatever `expo install` selects for Expo-managed modules over these when they differ.
- **No UI / behavior / layout change.** The app must look and behave identically to the SDK-54 build. This is infrastructure only. No `@expo/ui`, no native tabs — those are sub-projects 2 and 3.
- **CRYPTO WIRE-FORMAT INVARIANT (load-bearing):** `packages/crypto`'s native primitives MUST keep producing identical bytes — AES-GCM blob = `base64(iv[12] || ciphertext || gcmTag[16])`; AES-KW = RFC 3394 default IV; PBKDF2-HMAC-SHA256 @ 600_000 iterations → 32 bytes. Web (`primitives.ts`) and native (`primitives.native.ts`) sync the same encrypted journals; a byte change breaks cross-device decrypt. Verify by cross-decrypt, never assume.
- **`newArchEnabled: true`** stays (already set; `@expo/ui` prerequisite).
- **User owns git and builds.** The agent edits files and runs read-only/`npm view`-style commands. All `git`, `bun install`, `expo install`, `expo prebuild`, dev builds, and device QA are **run by the user** — the plan gives exact commands + expected output for them. No `Co-Authored-By` trailer on any commit.
- **No automated tests exist** (project convention). "Verification" = `expo-doctor`, successful dev build, and the manual QA checklist. There is no unit-test harness to add.

---

## File / change map

- `apps/mobile/package.json` — dependency version bumps (edit).
- `packages/crypto/src/primitives.native.ts` — adapt to quick-crypto v1 if the v1 API surface requires it; otherwise unchanged (edit only if needed, see Task 3).
- `apps/mobile/app.json` — reconcile config plugins for SDK 56 (edit if `expo-doctor` flags it).
- `apps/mobile/metro.config.js` — verify the Tamagui `@tamagui/*` dedupe + worklets setup survives (verify; edit only if broken).
- `apps/mobile/babel.config.js` — verify `babel-preset-expo` + worklets plugin still valid (verify).
- `bun.lock` (root) — refreshed by `bun install` (user-run).
- **New reference doc:** `docs/superpowers/notes/sdk56-migration-log.md` — running log of what `expo install --fix` changed + QA results (created during execution).

---

## Task 1: Create the migration branch and snapshot rollback state

**Files:**

- Read-only: `apps/mobile/package.json`, root `bun.lock`

**Interfaces:**

- Produces: a clean branch + a `bun.lock` snapshot that Task 7's rollback path depends on.

- [ ] **Step 1: (USER RUNS) Create the branch off the current mobile branch**

```bash
git checkout -b feat/expo-sdk56-migration
```

Expected: `Switched to a new branch 'feat/expo-sdk56-migration'`

- [ ] **Step 2: (USER RUNS) Snapshot the lockfile for rollback**

```bash
cp bun.lock bun.lock.sdk54-snapshot
```

Expected: no output; `bun.lock.sdk54-snapshot` exists. (This file is temporary — deleted in Task 7; do not commit it.)

- [ ] **Step 3: (AGENT) Create the migration log file**

Create `docs/superpowers/notes/sdk56-migration-log.md`:

```markdown
# SDK 56 Migration Log

## expo install --fix — version changes

(fill in during Task 2)

## expo-doctor output

(fill in during Task 4)

## QA results

(fill in during Task 6)
```

- [ ] **Step 4: (USER RUNS, optional) Commit the starting point**

```bash
git add docs/superpowers/notes/sdk56-migration-log.md
git commit -m "chore(mobile): start SDK 56 migration branch + log"
```

Expected: one commit on `feat/expo-sdk56-migration`.

---

## Task 2: Bump Expo SDK + React + Expo-managed native modules

**Files:**

- Modify: `apps/mobile/package.json`
- Modify: `docs/superpowers/notes/sdk56-migration-log.md`

**Interfaces:**

- Consumes: the branch from Task 1.
- Produces: `apps/mobile` declaring `expo ~56`, `react`/`react-dom` 19.2, and SDK-56-aligned Expo native modules. Task 3 layers the JSI crypto bump on top; Task 4 validates.

- [ ] **Step 1: (AGENT) Bump the SDK + React lines in `apps/mobile/package.json`**

Change these dependency lines:

```jsonc
"expo": "~56.0.0",
"react": "19.2.0",
"react-dom": "19.2.0",
```

And bump the mobile dev dependency to match root (`@types/react` is pinned to `19.2.2` by root `resolutions`):

```jsonc
"@types/react": "~19.2.2",
```

Leave `babel-preset-expo` as-is for now (`expo install --fix` in Step 3 will correct it to the `~56.0.0` line).

- [ ] **Step 2: (USER RUNS) Install so the Expo CLI is on SDK 56**

```bash
cd apps/mobile && bun install
```

Expected: install completes; `expo` resolves to a 56.x version. Warnings about peer mismatches are expected here and get resolved by Step 3.

- [ ] **Step 3: (USER RUNS) Let Expo align every managed native module to SDK 56**

```bash
cd apps/mobile && bunx expo install --fix
```

Expected: Expo rewrites the versions of Expo-managed packages in `apps/mobile/package.json` — `react-native` (→ 0.85.x), `react-native-reanimated`, `react-native-worklets`, `react-native-screens`, `react-native-gesture-handler`, `react-native-safe-area-context`, `react-native-svg`, `react-native-webview`, `@shopify/flash-list`, all `expo-*` modules, `@expo/metro-runtime`, `babel-preset-expo`. It prints each change as `package: old → new`.

- [ ] **Step 4: (AGENT) Record the changes in the migration log**

Copy the `expo install --fix` change list into the "expo install --fix — version changes" section of `docs/superpowers/notes/sdk56-migration-log.md`. This is the record Task 6 QA and any rollback reason against.

- [ ] **Step 5: (USER RUNS, optional) Commit**

```bash
git add apps/mobile/package.json bun.lock docs/superpowers/notes/sdk56-migration-log.md
git commit -m "feat(mobile): bump Expo SDK 54 -> 56, React 19.2, RN 0.85 managed deps"
```

---

## Task 3: Migrate `react-native-quick-crypto` 0.7 → 1.x (Nitro) — the crypto canary

This is the highest-risk task. quick-crypto v1 moved to Nitro Modules (new native backend, new `react-native-nitro-modules` dependency) but **kept the node-style JS API** (`randomBytes`, `pbkdf2`, `createCipheriv`/`createDecipheriv` + `getAuthTag`/`setAuthTag`, `createHash`). The job is: add the native dep, bump the version, and **prove byte-for-byte compatibility** so existing journals still decrypt and web↔mobile interop holds.

**Files:**

- Modify: `apps/mobile/package.json`
- Read (adapt only if the v1 API differs): `packages/crypto/src/primitives.native.ts`
- Modify: `docs/superpowers/notes/sdk56-migration-log.md`

**Interfaces:**

- Consumes: SDK-56 base from Task 2.
- Produces: a native crypto layer whose public functions are unchanged in signature — `getRandomBytes(n)`, `deriveKwKey(secret, salt, iterations)`, `generateGcmKey()`, `wrapKeyRaw(dek, kek)`, `unwrapKeyRaw(wrapped, kek)`, `gcmEncrypt(key, iv, plaintext)`, `gcmDecrypt(key, iv, ciphertextWithTag)`, `sha256(data)` — all returning the same bytes as before. Higher layers (`apps/mobile/lib/journal-crypto.ts`) are untouched.

- [ ] **Step 1: (AGENT) Add the JSI crypto deps to `apps/mobile/package.json`**

```jsonc
"react-native-quick-crypto": "^1.1.6",
"react-native-nitro-modules": "^0.36.4",
"react-native-quick-base64": "^3.0.1",
```

(`@craftzdog/react-native-buffer` stays `^6.1.2` — already latest.)

- [ ] **Step 2: (USER RUNS) Reconcile the Nitro version against Expo, then install**

```bash
cd apps/mobile && bunx expo install react-native-nitro-modules react-native-quick-crypto && bun install
```

Expected: if Expo tracks these, it may adjust `react-native-nitro-modules` to an SDK-56-blessed version (accept Expo's choice over `^0.36.4`). Install completes with no unmet-peer error on `react-native-nitro-modules >=0.31.2`.

- [ ] **Step 3: (AGENT) Read v1's API surface and confirm the primitives file still compiles against it**

Read `node_modules/react-native-quick-crypto/lib/typescript` (or the package's `.d.ts` entry) and confirm these exist with node-style shapes: `randomBytes(size): Buffer`, `pbkdf2(password, salt, iters, keylen, digest, cb)`, `createCipheriv(algo, key, iv)` with `.update()/.final()/.getAuthTag()`, `createDecipheriv(...)` with `.setAuthTag()`, `createHash(algo).update().digest()`.

- If ALL are present and unchanged → **no edit to `primitives.native.ts` is needed.** Proceed.
- If v1 renamed/moved any of them (e.g. named exports instead of a default `QuickCrypto` object), update ONLY the affected call in `packages/crypto/src/primitives.native.ts`, preserving the exact byte behavior described in that file's header comment (tag-append on encrypt, tag-split on decrypt, `toBytes` normalization). Do not change the wire format.

- [ ] **Step 4: (AGENT) Typecheck the native primitives**

Run (read-only, no build):

```bash
cd apps/mobile && bunx tsc --noEmit
```

Expected: PASS, or only pre-existing unrelated errors. Any error originating in `primitives.native.ts` or `journal-crypto.ts` must be fixed before continuing.

- [ ] **Step 5: (USER RUNS) Build a dev client — quick-crypto is a TurboModule/Nitro module, NOT available in Expo Go**

```bash
cd apps/mobile && bunx expo prebuild --clean && bunx expo run:ios
```

Expected: native build succeeds; app launches on the simulator/device. (Android equivalent: `bunx expo run:android`.)

- [ ] **Step 6: (USER RUNS — CRYPTO CANARY, the make-or-break check) Byte-compat verification**

Perform this manual sequence on a dev build and record results in the log:

1. **Backward-compat:** Open a journal entry that was created and encrypted on the SDK-54 build (an existing account with existing entries). It must **decrypt and render** correctly. → proves v1 reads v0.7-era ciphertext.
2. **Round-trip:** Create a NEW entry, save (encrypt), fully close and reopen it. It must decrypt. → proves v1 encrypt+decrypt.
3. **Cross-platform interop:** Confirm a journal entry created on mobile opens on the PWA and vice-versa (same account). → proves web↔mobile wire compat held.

Expected: all three succeed. **If backward-compat or interop fails, STOP** — the wire format changed; do not proceed. Escalate: this is the hard gate from the spec.

- [ ] **Step 7: (USER RUNS, optional) Commit**

```bash
git add apps/mobile/package.json packages/crypto/src/primitives.native.ts bun.lock docs/superpowers/notes/sdk56-migration-log.md
git commit -m "feat(crypto): migrate react-native-quick-crypto to v1 (Nitro), verify byte-compat"
```

---

## Task 4: Bump remaining JSI modules + resolve `expo-doctor`

**Files:**

- Modify: `apps/mobile/package.json`
- Verify (edit only if flagged): `apps/mobile/app.json`, `apps/mobile/metro.config.js`, `apps/mobile/babel.config.js`
- Modify: `docs/superpowers/notes/sdk56-migration-log.md`

**Interfaces:**

- Consumes: the crypto-migrated tree from Task 3.
- Produces: an `expo-doctor`-clean project with every non-Expo JSI module on an RN 0.85-compatible version.

- [ ] **Step 1: (AGENT) Bump the remaining hand-managed JSI modules in `apps/mobile/package.json`**

```jsonc
"react-native-keyboard-controller": "^1.22.2",
"react-native-purchases": "^10.5.0",
```

(`@10play/tentap-editor` stays `^1.0.1` — already the latest published version; it is verified by build, not bump.)

- [ ] **Step 2: (USER RUNS) Install**

```bash
cd apps/mobile && bun install
```

Expected: no unmet peer errors. `react-native-keyboard-controller` peer `react-native-reanimated >=3.0.0` is satisfied by the SDK-56 Reanimated 4.x from Task 2.

- [ ] **Step 3: (USER RUNS) Run expo-doctor and paste output into the log**

```bash
cd apps/mobile && bunx expo-doctor
```

Expected: ideally "No issues detected." Record every warning/error in the log's "expo-doctor output" section.

- [ ] **Step 4: (AGENT) Resolve each expo-doctor finding**

For each issue reported:

- **Version mismatch** on an Expo-managed package → run `bunx expo install <pkg>` (user) and record.
- **Config plugin** change required in `app.json` → apply the minimal edit the doctor names.
- **Unsupported/duplicate package** → address per the doctor's message.
  Re-run Step 3 until clean or only known-accepted warnings remain (document any accepted warning + why).

- [ ] **Step 5: (AGENT) Verify the Tamagui/metro/babel config survived the bump**

Read `apps/mobile/metro.config.js` and `apps/mobile/babel.config.js`. Confirm:

- Metro still dedupes `@tamagui/*` (the load-bearing single-copy rule from the project's architecture notes).
- `babel-preset-expo` + the worklets/reanimated babel plugin are still present and ordered correctly for Reanimated 4.
  Only edit if SDK 56 changed the required shape; otherwise leave untouched and note "verified, no change" in the log.

- [ ] **Step 6: (USER RUNS) RevenueCat major-bump smoke check (9 → 10)**

On a dev build, confirm `configurePurchases` runs at the authed root without throwing and the paywall/upgrade screen renders offerings. RevenueCat v10's API is source-compatible for the surface this app uses (`Purchases.configure`, `getOfferings`, `purchasePackage`, `restorePurchases`); if any renamed symbol errors, update the call site in `apps/mobile/lib/purchases.ts` to the v10 name. Record result.

- [ ] **Step 7: (USER RUNS, optional) Commit**

```bash
git add apps/mobile/package.json apps/mobile/app.json apps/mobile/metro.config.js apps/mobile/babel.config.js bun.lock docs/superpowers/notes/sdk56-migration-log.md
git commit -m "feat(mobile): bump remaining JSI modules; expo-doctor clean"
```

---

## Task 5: Clean native rebuild on both platforms

**Files:**

- Regenerated (not committed): `apps/mobile/ios/`, `apps/mobile/android/` (via prebuild)

**Interfaces:**

- Consumes: the doctor-clean tree from Task 4.
- Produces: successful native dev builds on iOS and Android — the precondition for QA.

- [ ] **Step 1: (USER RUNS) Regenerate native projects from scratch**

```bash
cd apps/mobile && bunx expo prebuild --clean
```

Expected: `ios/` and `android/` regenerated without error; config plugins (incl. Nitro/quick-crypto, `expo-build-properties`) apply cleanly.

- [ ] **Step 2: (USER RUNS) iOS dev build**

```bash
cd apps/mobile && bunx expo run:ios
```

Expected: Xcode build succeeds; app boots on simulator past the auth + onboarding gate to the Today tab. If the build fails on a pod/Nitro step, record the exact error in the log before iterating.

- [ ] **Step 3: (USER RUNS) Android dev build**

```bash
cd apps/mobile && bunx expo run:android
```

Expected: Gradle build succeeds; app boots on emulator/device to the Today tab.

- [ ] **Step 4: (AGENT) Record build outcomes** in the log (pass/fail per platform, any warnings).

---

## Task 6: Full manual QA regression pass (user-executed)

No behavior or visuals may change. This is the project's substitute for an automated suite. Run on BOTH iOS and Android dev builds; record each line pass/fail in the log.

**Files:**

- Modify: `docs/superpowers/notes/sdk56-migration-log.md` (QA results)

**Interfaces:**

- Consumes: working dev builds from Task 5.
- Produces: a signed-off regression checklist — the migration's definition of done.

- [ ] **Step 1: (USER RUNS) Core boot + navigation**
  - App boots past auth gate + onboarding gate to Today.
  - Tab switching (Today / Todos / Habits / Journal / Settings) is a native visibility flip with no lag regression (the prior perf work's behavior must hold).
  - The floating kit BottomNav capsule renders and hides correctly on full-screen flows (journal editor/detail, onboarding) — unchanged from SDK 54.

- [ ] **Step 2: (USER RUNS) Journal / crypto (already exercised in Task 3, re-confirm end-to-end)**
  - Create, edit (tentap rich-text toolbar + formatting), save, reopen, decrypt.
  - Keyboard-controller: editor keyboard avoidance behaves as before.
  - Writing heatmap / journal list render.

- [ ] **Step 3: (USER RUNS) Habits**
  - Habit check-in animation + RadianceBurst render (Reanimated 4 path).
  - Streak math correct; check-in re-renders only the tapped row (no fan-out regression).
  - Habit detail screen opens (pushed route).

- [ ] **Step 4: (USER RUNS) Todos**
  - FlashList todos scroll smoothly; swipe-to-complete / swipe-to-delete work.
  - Compact quick-add (todo + habit) opens and creates.

- [ ] **Step 5: (USER RUNS) Calendar / Journey / Settings**
  - Calendar month grid + day agenda; calendar picker sheet opens with correct portal context.
  - Journey (gamification) screen renders.
  - Settings view-first cards + Edit → FormSheet.

- [ ] **Step 6: (USER RUNS) Billing / paywall**
  - RevenueCat configures; upgrade/paywall renders offerings; restore flow initializes.

- [ ] **Step 7: (USER RUNS) Error hygiene**
  - No new red-box errors or console warnings on either platform vs the SDK-54 baseline.

- [ ] **Step 8: (AGENT) Summarize QA results** in the log. Any failure blocks completion and is triaged before Task 7.

---

## Task 7: Finalize migration

**Files:**

- Delete: `bun.lock.sdk54-snapshot`
- Modify: `docs/superpowers/notes/sdk56-migration-log.md` (final status)

**Interfaces:**

- Consumes: green QA from Task 6.
- Produces: a merged-ready branch on SDK 56 — the foundation sub-project 2 builds on.

- [ ] **Step 1: (AGENT) Confirm success criteria in the log**
  - Runs on Expo SDK 56 / RN 0.85 / React 19.2. ✅
  - `expo-doctor` clean (or documented accepted warnings). ✅
  - iOS + Android dev builds succeed. ✅
  - Full QA checklist passes, no regression. ✅
  - Kit (alpha.126), Tamagui (2.3.2), PWA, desktop untouched. ✅

- [ ] **Step 2: (USER RUNS) Remove the rollback snapshot**

```bash
rm bun.lock.sdk54-snapshot
```

- [ ] **Step 3: (AGENT) Write the sub-project-2 handoff note** at the bottom of the log: "SDK 56 in place. Ready to install `@expo/ui` + adopt `expo-router` native tabs. Begin sub-project 2 brainstorming."

- [ ] **Step 4: (USER RUNS) Final commit + merge per your own git flow**

```bash
git add -A
git commit -m "chore(mobile): finalize SDK 56 migration"
```

**Rollback (if any gate fails):** `git checkout <original-branch>` and `cp bun.lock.sdk54-snapshot bun.lock && bun install`. Native projects are regenerated by prebuild, so there is no committed native state to unwind.

---

## Self-review — spec coverage

- Spec Phase 0 (JSI spike) → **done during planning** (version matrix in Global Constraints + Task 3/4); quick-crypto Nitro risk surfaced and given a concrete path.
- Spec Phase 1 (core bump) → Task 2.
- Spec Phase 2 (config/build reconcile) → Task 4 (doctor + metro/babel/app.json).
- Spec Phase 3 (validation/QA) → Tasks 5–6.
- Spec risk register: quick-crypto → Task 3; tentap → Task 4 Step 1 + Task 6 Step 2; purchases → Task 4 Step 6; reanimated → Task 4 Step 5 + Task 6 Step 3; metro/Tamagui → Task 4 Step 5; React hoist → Task 2 Step 1; lockfile → Task 1 Step 2 + Task 7.
- Spec rollback → Task 1 (snapshot) + Task 7 (restore).
- Spec success criteria → Task 7 Step 1.
- Byte-compat invariant → Task 3 Step 6 (canary) + Global Constraints.

No placeholders: every code/version change shows the exact value; every command shows expected output; the one conditional edit (Task 3 Step 3) states both branches explicitly.

## What this unblocks

SDK 56 in place → **sub-project 2** installs `@expo/ui` + `expo-router` native tabs (liquid glass / Material), and **sub-project 3** swaps screen widgets to native `@expo/ui` universal components — each with its own spec → plan → build cycle, per the agreed sequencing.
