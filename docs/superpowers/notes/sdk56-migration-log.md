# SDK 56 Migration Log

Branch: user-managed (work done on `dev/mobile` working tree; user owns git)
Started: 2026-07-30 · Executor: agent runs everything except git (per user 2026-07-30)

## Final dependency state (after `expo install --fix` + overrides)

| Package                          | From     | To       | Note                                                                                                                                                                                                                                                                        |
| -------------------------------- | -------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| expo                             | ~54.0.36 | ~56.0.0  |                                                                                                                                                                                                                                                                             |
| react / react-dom                | 19.1.0   | 19.2.3   | + root override pins 19.2.3 monorepo-wide                                                                                                                                                                                                                                   |
| react-native                     | 0.81.5   | 0.85.3   |                                                                                                                                                                                                                                                                             |
| react-native-reanimated          | ~4.1.1   | 4.3.1    |                                                                                                                                                                                                                                                                             |
| react-native-worklets            | 0.5.1    | 0.8.3    |                                                                                                                                                                                                                                                                             |
| react-native-screens             | ~4.16.0  | ~4.26.0  |                                                                                                                                                                                                                                                                             |
| react-native-gesture-handler     | ~2.28.0  | ~2.31.1  |                                                                                                                                                                                                                                                                             |
| react-native-safe-area-context   | ~5.6.0   | ~5.7.0   |                                                                                                                                                                                                                                                                             |
| react-native-svg                 | 15.12.1  | 15.15.4  |                                                                                                                                                                                                                                                                             |
| react-native-webview             | 13.15.0  | 13.16.1  |                                                                                                                                                                                                                                                                             |
| @shopify/flash-list              | ^2.3.1   | 2.0.2    | ⚠️ Expo's SDK-56 blessed version is LOWER; tsc clean; watch todos list at runtime                                                                                                                                                                                           |
| react-native-keyboard-controller | 1.18.5   | 1.21.6   | Expo's blessed version (not latest 1.22.x)                                                                                                                                                                                                                                  |
| react-native-quick-crypto        | ^0.7.16  | 1.1.6    | **Nitro rewrite** — API surface verified unchanged (node-style); NO code change needed in `packages/crypto/src/primitives.native.ts` (`update()`/`final()` now return Buffer; `toBytes()` already normalizes). `install()` global polyfill NOT needed (we import directly). |
| react-native-nitro-modules       | —        | 0.36.4   | new native dep required by quick-crypto v1                                                                                                                                                                                                                                  |
| react-native-quick-base64        | ^3.0.0   | 3.0.1    | + root override (dedupe vs buffer's nested copy)                                                                                                                                                                                                                            |
| react-native-purchases           | ^9.0.0   | ^10.5.0  | major bump — paywall needs runtime QA                                                                                                                                                                                                                                       |
| @types/react (mobile)            | ~19.1.10 | ~19.2.14 |                                                                                                                                                                                                                                                                             |
| typescript (mobile)              | ^5.3.0   | ~6.0.3   | expo install --fix bumped it                                                                                                                                                                                                                                                |
| babel-preset-expo                | ~54.0.0  | 56.0.18  |                                                                                                                                                                                                                                                                             |
| all expo-\* modules              | 54-line  | 56-line  | via `expo install --fix`                                                                                                                                                                                                                                                    |

Root `package.json` additions (resolutions + overrides): `react 19.2.3`, `react-dom 19.2.3`, `react-native-quick-base64 3.0.1` — collapses nested copies (features' react 19.2.6, tentap's react-dom 18, buffer's quick-base64 3.0.0).

## Code changes

1. `apps/mobile/app.json` — removed `newArchEnabled` (SDK 56 schema removed it; RN 0.85 is New-Arch-only).
2. `apps/mobile/metro.config.js` — removed `unstable_enableSymlinks` (Metro default now; expo-doctor flags the override).
3. `apps/mobile/app/_layout.tsx` + `components/unmount-on-blur.tsx` — **expo-router 56 vendors react-navigation**; `@react-navigation/native` no longer resolves as a package. Imports moved to expo-router's re-exports (`ThemeProvider`, `DarkTheme`, `DefaultTheme`, `useIsFocused`). NOTE: installing `@react-navigation/native` directly would be a BUG (second copy → split navigation context).
4. `packages/features/src/tamagui-augmentation.d.ts` (new) — kit alpha.126's types restructure stopped leaking the `TamaguiCustomConfig` augmentation into features' standalone tsc; ambient type-only augmentation restores shorthand props (`items`, `rounded`, …) for `check`. Pre-existing break exposed by clean reinstall, not caused by SDK 56.
5. `apps/pwa/tsconfig.json` — removed stale `vite-plugin-pwa/client` types entry (package was removed with the offline feature June 2026; a stale unpruned node_modules copy had been masking it).

## expo-doctor

**21/21 checks passed** (after: schema fix, metro fix, clean reinstall, react/quick-base64 overrides, stale-nested-copy purge).

## Typecheck

`bun run check` — **all 6 workspaces clean** (api, core, crypto, features, mobile, pwa).

## Build outcomes

- `expo prebuild --clean`: ✅ ios + android regenerated, CocoaPods installed. (CLI notes SDK 57 exists now; staying on 56 per spec.)
- iOS (`expo run:ios`): ✅ **Build Succeeded** — 0 errors, 2 warnings (dev-launcher script-phase dependency warning, benign); installed + launched on iPhone 17 simulator. quick-crypto v1 / Nitro pods compiled and linked.
- Android: ⏳ **USER-RUN** — `cd apps/mobile && bunx expo run:android`. Agent's background Gradle build + emulator were killed by the environment before producing an APK; the emulator also refused to stay up under the agent's shell (GUI boot reached full startup then got a graceful shutdown ~90s in; headless attempt killed too). Nothing suggests a code problem — the same tree passed prebuild + pod install + the full iOS compile. Expo attempt note: first `expo run:android` failed at the _emulator launch_ step ("quit before it finished opening"), before Gradle ever ran.

## Crypto canary (user device QA) — MAKE-OR-BREAK

- [ ] Backward-compat: existing (SDK-54-encrypted) journal decrypts
- [ ] Round-trip: new entry encrypt → close → reopen → decrypt
- [ ] Cross-platform: mobile entry opens on PWA and vice-versa

## QA results (user device QA)

(fill in per plan Task 6)

## Discovered for sub-project 2 🎁

expo-router 56 ships `@expo/ui ^56.0.24` and `expo-glass-effect` as its OWN dependencies — the native-tabs/liquid-glass stack is already in the tree.

## Final status

**Agent-side work COMPLETE (2026-07-30).** Remaining, all user-owned:

1. Android build: `cd apps/mobile && bunx expo run:android` (agent on standby for build errors).
2. Device QA per plan Task 6 — crypto canary first (checklist above).
3. Git: branch/commit as you see fit; delete `scratchpad/bun.lock.sdk54-snapshot` copy after (rollback: restore it over `bun.lock` + `bun install`).

Then: sub-project 2 (native tabs / liquid glass / Material shell) brainstorming.
