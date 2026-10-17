# Expo SDK 54 → 56 Migration — Design Spec

**Date:** 2026-07-30
**Status:** Approved design, pending implementation plan
**Sub-project:** 1 of 3 in the "Native UI adoption" initiative

---

## Why this exists (the bigger picture)

The user wants Meridian's native app to _feel_ native — iOS 26 **liquid glass**, Android **Material** — by adopting Expo's native-UI stack (native tabs + `@expo/ui` SwiftUI/Jetpack Compose components). The guiding principle for the whole initiative:

> **Native = interaction + structure, not skin.** Replace the _motion_ (gestures, transitions, haptics, scroll physics) and the _structural scaffolding_ (tab bar, nav headers, lists/sections, sheets, context menus) with the real per-platform native ones. Let each platform express its own conventions (iOS looks iOS, Android looks Android). **Meridian's features, information architecture, and brand identity stay the same.**

The initiative is sequenced as **three stacked sub-projects**, each with its own spec → plan → build cycle:

1. **This spec — SDK 54 → 56 migration** (the enabling foundation). The stable `@expo/ui` universal component layer only exists on SDK 56, so nothing else starts until we're on 56.
2. **Native navigation shell** — native tabs (liquid glass / Material) + native stack headers, replacing the custom floating kit BottomNav capsule. Native is explicitly allowed to diverge from the PWA.
3. **Native component adoption** — screen by screen, kit widgets → `@expo/ui` universal components, per the interaction+structure principle.

This document covers **only sub-project 1**.

---

## Goal

Move `apps/mobile` from **Expo SDK 54** (RN 0.81.5 / React 19.1.0) to **Expo SDK 56** (RN 0.85 / React 19.2), the current latest stable SDK, with **zero feature regressions** and **no change to the app's UI or behavior**. This is purely an enabling infrastructure bump. Native-UI adoption happens in sub-projects 2 and 3.

---

## Scope

### In scope

- Bump `expo` → SDK 56 in `apps/mobile`.
- Align all Expo-managed native modules to their SDK-56 versions via `expo install --fix`.
- Bump mobile `react` / `react-dom` 19.1.0 → 19.2.x (unifies with the PWA and root, which are already on 19.2).
- Verify and, where required, bump the **non-Expo JSI native modules** for RN 0.85 compatibility.
- Refresh the Bun lockfile.
- `expo prebuild --clean`, dev builds on both platforms, manual QA.

### Non-goals (explicitly out)

- **No `@expo/ui` install.** Added at the start of sub-project 2. Keeps the rollback boundary clean.
- **No native tabs / native headers.** Sub-project 2.
- **No UI, layout, or interaction changes.** The app looks and behaves identically after this migration.
- **No kit (`@stageholder/ui`) or Tamagui changes.** Verified compatible (see below) — kit stays at alpha.126, Tamagui stays pinned at 2.3.2.
- **No PWA or desktop changes.** PWA is already on React 19.2 and does not use Expo; desktop wraps the PWA. This migration touches `apps/mobile` only.
- **No SDK (`@stageholder/sdk`) change** unless Phase 0 surfaces an RN 0.85 incompatibility (not expected — it's a JS/auth SDK).

### Latitude granted

Where a native module has **no RN 0.85-compatible version**, or a native path is clearly better, a **total refactor to a native alternative is authorized** (e.g. replacing the rich-text editor). Such a refactor is preferred over pinning the whole migration to an abandoned dependency. If a refactor is large enough to be its own effort, it is split into its own spec rather than bloating this one.

---

## De-risking summary (already verified)

| Concern                  | Finding                                                                      | Consequence                                                             |
| ------------------------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| New Architecture         | `app.json` already has `newArchEnabled: true`                                | No new-arch migration needed; `@expo/ui` prerequisite already met       |
| Tamagui / kit on RN 0.85 | Tamagui 2 officially supports RN 0.81+ (0.85 fine), React 19.2, New Arch     | **Kit + Tamagui untouched.** No forced republish. Biggest risk retired. |
| React version            | PWA already `^19.2.0`; root `@types/react` 19.2.2; only mobile pinned 19.1.0 | Bump _unifies_ the monorepo rather than diverging it. Low risk.         |
| `@expo/ui`               | Not installed yet                                                            | Clean slate; deferred to sub-project 2                                  |

---

## Migration approach

**Expo-managed incremental bump on a dedicated branch.** Tool-driven, following Expo's official upgrade path, with an upfront JSI verification gate.

Rejected alternatives:

- **Clean-room full rebuild** (wipe node_modules + lockfile, fresh install): heavier; only wins when the lockfile is corrupt. The current lockfile is healthy — not justified.
- **Two-step 54 → 55 → 56**: pointless. SDK 55 was the `@expo/ui` beta; 56 is stable. No reason to stop at 55.

---

## The migration sequence

### Phase 0 — JSI compatibility spike (GATE) ⚠️

Before touching the app's SDK version, verify each **non-Expo JSI native module** against RN 0.85 / New Arch. This is a research + throwaway-install spike — no changes committed to the app yet. Chosen over "bump-and-discover" so blockers surface _before_ the migration, not mid-build.

Modules to verify (each: confirm an RN 0.85-compatible version exists, note the target version, note fallback):

| Module                             | Current | Role                                         | Why it's risky                                                   | Fallback if blocked                                         |
| ---------------------------------- | ------- | -------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------- |
| `react-native-quick-crypto`        | ^0.7.16 | **Journal E2E encryption** (DEK/crypto core) | JSI/TurboModule, security-critical, requires a dev build already | Blocker → halt & escalate; crypto has no casual substitute  |
| `@10play/tentap-editor`            | ^1.0.1  | Journal rich-text editor (WebView-backed)    | Native + WebView bridge                                          | Candidate for native refactor (sub-project 3), or pin/patch |
| `react-native-keyboard-controller` | 1.18.5  | Keyboard-aware journal editor                | Native view manager                                              | Bump to RN 0.85-compatible release                          |
| `react-native-purchases`           | ^9.0.0  | RevenueCat IAP / paywall                     | Native billing SDK                                               | Bump to RevenueCat's RN 0.85 release                        |
| `react-native-quick-base64`        | ^3.0.0  | base64 for crypto path                       | JSI                                                              | Bump; low risk                                              |
| `@craftzdog/react-native-buffer`   | ^6.1.2  | Buffer polyfill for crypto                   | JS-ish, JSI-adjacent                                             | Low risk                                                    |

**Gate criterion:** every module above has a known-good RN 0.85 path (a compatible version, a patch, or an approved refactor decision) **before** Phase 1 begins. `react-native-quick-crypto` is the hard gate — if it has no path, the migration pauses for an escalation decision.

**Canary for validation:** journal create/read (exercises quick-crypto + tentap + keyboard-controller together). If the journal editor encrypts, saves, and reopens on a dev build, the highest-risk surface is proven.

### Phase 1 — Core SDK bump

1. Create a dedicated migration branch (user owns git; the plan will name it, not run it).
2. Snapshot the current `bun.lock` for rollback.
3. Bump `expo` → `~56.x` in `apps/mobile/package.json`.
4. `bunx expo install --fix` — aligns all Expo-managed native modules to SDK-56 versions:
   `react-native` (→ 0.85), `react-native-reanimated` (→ SDK-56 4.x), `react-native-worklets`, `react-native-screens`, `react-native-gesture-handler`, `react-native-safe-area-context`, `react-native-svg`, `react-native-webview`, `@shopify/flash-list`, `expo-*` modules, `babel-preset-expo`, `@expo/metro-runtime`.
5. Bump `react` / `react-dom` → 19.2.x; bump mobile `@types/react` to match root (19.2.2).
6. Apply the Phase 0 JSI module version decisions.
7. Refresh the lockfile (`bun install`).

### Phase 2 — Config & build reconciliation

1. `bunx expo-doctor` — resolve every reported issue.
2. Reconcile `app.json` plugins and any config-plugin changes SDK 56 introduces.
3. Verify the metro config (kit dedupe of `@tamagui/*`, worklets plugin) still holds — the existing `metro.config.js` + babel worklets setup must survive; adjust only if SDK 56 requires it.
4. `bunx expo prebuild --clean` — regenerate native projects.

### Phase 3 — Validation & manual QA (user-executed)

Per user preference, **the user runs all builds and does manual verification** — no automated tests, no CI in this loop. The plan provides the checklist; the user executes it. Dev builds on **both** iOS and Android (Expo Go is insufficient — quick-crypto is a TurboModule needing a dev build).

**QA checklist (regression-focused — behavior must be identical to pre-migration):**

- [ ] App boots past the auth gate + onboarding gate to the Today tab.
- [ ] **Journal canary**: create an entry, encrypt/save, close, reopen, decrypt — on both platforms.
- [ ] Rich-text editor (tentap): toolbar, formatting, keyboard-controller behavior.
- [ ] Habit check-in animation + streak (the lag-sensitive path from prior perf work).
- [ ] Tab switching stays a native visibility flip (no re-render lag regression).
- [ ] Paywall / RevenueCat: restore + purchase flow initializes.
- [ ] Reanimated 4 animations (RadianceBurst, check-in) render correctly.
- [ ] FlashList screens (todos) scroll without regressions.
- [ ] Calendar, journey, settings render.
- [ ] Sheets (quick-add, calendar picker) open/close with correct portal context.
- [ ] No new red-box / console errors on either platform.

---

## Risk register

| Risk                                         | Likelihood | Impact                        | Mitigation                                                                 |
| -------------------------------------------- | ---------- | ----------------------------- | -------------------------------------------------------------------------- |
| `quick-crypto` has no RN 0.85 build          | Low–Med    | **Critical** (journal broken) | Phase 0 gate; hard stop + escalate before migrating                        |
| `tentap-editor` breaks on RN 0.85            | Med        | High                          | Phase 0 verify; fallback = native editor refactor (own spec)               |
| Reanimated 4 minor-version behavior drift    | Med        | Med                           | `expo install --fix` picks the SDK-blessed version; QA the animation paths |
| `react-native-purchases` RN 0.85 lag         | Low        | Med                           | Verify RevenueCat release notes in Phase 0                                 |
| Metro/Tamagui dedupe breaks after bump       | Low        | Med                           | Verify `metro.config.js` in Phase 2; kit dedupe is load-bearing            |
| Monorepo React hoist conflict (19.1 vs 19.2) | Low        | Low                           | Bump unifies to 19.2 everywhere; already the PWA/root version              |
| Lockfile drift across workspaces             | Low        | Med                           | Snapshot lockfile; dedicated branch; clean `bun install`                   |

---

## Rollback

- All work on a **dedicated migration branch** (user-managed git).
- **`bun.lock` snapshotted** before Phase 1.
- Rollback = discard the branch + restore the lockfile snapshot. Native projects are regenerated (`prebuild`), so no committed native state to unwind.

---

## Success criteria

1. `apps/mobile` runs on Expo SDK 56 / RN 0.85 / React 19.2.
2. `expo-doctor` clean.
3. Dev builds succeed on iOS and Android.
4. Full QA checklist passes with **no behavioral or visual regression** vs the SDK-54 build.
5. Kit (alpha.126), Tamagui (2.3.2), PWA, and desktop are untouched.
6. The app is now ready for `@expo/ui` + native tabs (sub-project 2).

---

## What this unblocks

With SDK 56 in place, sub-project 2 (native navigation shell) can install `@expo/ui` + adopt `expo-router` native tabs, and sub-project 3 can begin swapping screen widgets to native `@expo/ui` universal components — all on a stable, supported foundation.
