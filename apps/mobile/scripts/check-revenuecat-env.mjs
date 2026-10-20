#!/usr/bin/env node
// apps/mobile/scripts/check-revenuecat-env.mjs
//
// Build-time guard: refuse to build a RELEASE binary with a RevenueCat Test
// Store key. Runs as the `eas-build-pre-install` hook (package.json), before
// dependencies are installed, so a misconfigured EAS environment fails in
// seconds instead of producing a TestFlight build that dies on sign-in.
//
// Why: purchases-ios (and purchases-android) `fatalError` on configure() when
// the key starts with `test_` and the binary was compiled in Release. Every
// EAS profile WITHOUT `developmentClient: true` compiles Release. Test Store
// keys are therefore valid ONLY on dev-client profiles; TestFlight / internal
// builds must use the real `appl_` / `goog_` key against the store sandbox.
//
// Inputs (all from the environment EAS injects into build hooks):
//   EAS_BUILD_PROFILE                  — profile name, looked up in eas.json
//   EAS_BUILD_PLATFORM                 — "ios" | "android" (only that key checked)
//   EXPO_PUBLIC_REVENUECAT_IOS_KEY / EXPO_PUBLIC_REVENUECAT_ANDROID_KEY
//
// Local use: `node scripts/check-revenuecat-env.mjs --profile production`.
// Outside EAS with no --profile, the script is a no-op (dev workflows vary).
// Plain Node, zero dependencies — it runs before `bun install`.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TEST_STORE_PREFIX = "test_";
const KEYS = {
  ios: "EXPO_PUBLIC_REVENUECAT_IOS_KEY",
  android: "EXPO_PUBLIC_REVENUECAT_ANDROID_KEY",
};

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const profile = argValue("--profile") ?? process.env.EAS_BUILD_PROFILE;
if (!profile) {
  console.log("[check-revenuecat-env] no build profile (not an EAS build) — skipping");
  process.exit(0);
}

const easJsonPath = resolve(dirname(fileURLToPath(import.meta.url)), "../eas.json");
const easJson = JSON.parse(readFileSync(easJsonPath, "utf8"));
const profileConfig = easJson.build?.[profile];
if (!profileConfig) {
  console.error(`[check-revenuecat-env] unknown EAS build profile "${profile}" (not in eas.json)`);
  process.exit(1);
}

// Dev-client profiles compile Debug → Test Store keys are fine there.
if (profileConfig.developmentClient === true) {
  console.log(`[check-revenuecat-env] profile "${profile}" is a dev client — Test Store keys allowed`);
  process.exit(0);
}

const platform = argValue("--platform") ?? process.env.EAS_BUILD_PLATFORM;
const platformsToCheck = platform && KEYS[platform] ? [platform] : Object.keys(KEYS);

const offenders = platformsToCheck
  .map((p) => KEYS[p])
  .filter((name) => (process.env[name] ?? "").startsWith(TEST_STORE_PREFIX));

if (offenders.length > 0) {
  console.error(
    [
      "",
      `[check-revenuecat-env] ✖ RevenueCat Test Store key on RELEASE profile "${profile}":`,
      ...offenders.map((name) => `    ${name} starts with "${TEST_STORE_PREFIX}"`),
      "",
      "  The native RevenueCat SDK crashes on launch when a Test Store key is used in a",
      "  Release build, and App Review rejects it. Test Store keys are only valid on",
      "  dev-client profiles (developmentClient: true).",
      "",
      "  Fix: in the EAS environment for this profile, set the REAL public key from",
      "  RevenueCat → Project → API keys (iOS `appl_…`, Android `goog_…`), e.g.",
      `    eas env:update --variable-name ${offenders[0]} --variable-environment ${profileConfig.environment ?? profile} --environment development --non-interactive`,
      "  to move the test key to development only, then add the real key for",
      "  production/preview. See docs/iap-hub-contract.md §5.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

console.log(`[check-revenuecat-env] ✓ profile "${profile}": no Test Store keys on a release build`);
