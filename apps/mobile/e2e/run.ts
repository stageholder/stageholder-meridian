/**
 * Mobile E2E runner — the native counterpart of `apps/pwa` `bun run e2e`.
 *
 *   1. checks the local stack is up (the tests never start servers);
 *   2. signs the dedicated `jevb+…` test account in (headless, via the PWA
 *      suite's global setup) ONLY to obtain an API token for setup/cleanup;
 *   3. wipes that account (habits, todos, lists, groups, journal) so every
 *      run starts identical — same `resetAccount()` the PWA suite uses;
 *   4. runs the Maestro journeys in `e2e/flows` against the installed dev
 *      build on the booted iOS simulator / Android emulator;
 *   5. wipes the account again.
 *
 * Credentials come from the SAME gitignored file as the PWA suite
 * (`apps/pwa/e2e/.env.e2e`) or the environment, and are passed to Maestro as
 * `--env` values — never printed.
 *
 * Usage (from apps/mobile):
 *   bun run e2e                     # every journey
 *   bun run e2e -- flows/habits.yaml  # one journey
 *   bun run e2e:android             # Android emulator (adds adb reverse)
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const HERE = new URL(".", import.meta.url).pathname;
const PWA_E2E = join(HERE, "../../pwa/e2e");

// ---- env: process env wins, then apps/pwa/e2e/.env.e2e (shared account) ----
const envFile = join(PWA_E2E, ".env.e2e");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || process.env[m[1]!] !== undefined) continue;
    process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
}

const { env, SKIP_FILE } = await import(join(PWA_E2E, "support/env.ts"));
const { stackDownReason, waitForApi } = await import(
  join(PWA_E2E, "support/stack.ts")
);
const { MeridianApi } = await import(join(PWA_E2E, "support/api.ts"));
const globalSetup = (await import(join(PWA_E2E, "support/global-setup.ts")))
  .default;

const args = process.argv.slice(2);
const android = args.includes("--android");
// --release: a RELEASE build is installed (`bun run e2e:build:android`) —
// precompiled Hermes bytecode, local-stack URLs baked in at build time, no
// Metro. Closest to what users run; dev-client builds parse raw JS on every
// launch, which on a slow emulator costs minutes and ~1GB before first render.
const release = args.includes("--release");
const passthrough = args.filter((a) => a !== "--android" && a !== "--release");

function fail(message: string): never {
  console.error(`\n[mobile-e2e] ${message}\n`);
  process.exit(1);
}

// ---- 1. stack ----
await waitForApi(env.apiUrl, 30_000);
const down = await stackDownReason(env.pwaUrl, env.apiUrl, env.hubUrl);
if (down) fail(down);
if (!env.email || !env.password || !env.journalPassphrase) {
  fail(
    "E2E_EMAIL / E2E_PASSWORD / E2E_JOURNAL_PASSPHRASE are not set (apps/pwa/e2e/.env.e2e). See e2e/README.md.",
  );
}

// ---- 1b. the app under test must talk to the LOCAL stack ----
// `bun run e2e:metro` serves PRODUCTION-mode bundles (--no-dev --minify) with
// dotenv off: in dev mode Expo's virtual env module re-merges every .env*
// file over process.env, so a prod-pointed .env.local would win and sign the
// app into PRODUCTION while this runner wipes the local account. Production
// bundles inline process.env at build time, so the overrides stick — and
// prod-mode JS is also what users actually run (representative perf).
const METRO = process.env.E2E_METRO_URL ?? "http://localhost:8081";
const bundle = release
  ? "http://localhost:4828/oidc (release build — baked in by e2e:build:*)"
  : await fetch(
      `${METRO}/apps/mobile/index.bundle?platform=${android ? "android" : "ios"}&dev=false&minify=true`,
      { signal: AbortSignal.timeout(600_000) },
    )
      .then((r) => (r.ok ? r.text() : ""))
      .catch(() => "");
if (!bundle) {
  fail(
    `Metro isn't serving the app at ${METRO}. Start it with \`bun run e2e:metro\`.`,
  );
}
if (
  !bundle.includes("http://localhost:4828/oidc") ||
  bundle.includes("id.stageholder.com/oidc") ||
  bundle.includes("api.meridian.stageholder.com")
) {
  fail(
    "Metro's bundle is not pointed at the local stack (it would sign the app into a real Hub). Restart Metro with `bun run e2e:metro` — it ignores .env.local and targets localhost.",
  );
}

// ---- 2. API token for setup/cleanup (reuses a fresh saved session) ----
await globalSetup({ projects: [{ use: { baseURL: env.pwaUrl } }] } as never);
if (existsSync(SKIP_FILE)) fail(readFileSync(SKIP_FILE, "utf8"));
const api = new MeridianApi();

// ---- 3. clean slate ----
console.log("[mobile-e2e] resetting the test account…");
await api.resetAccount();
// The journeys start from a set-up account. Mobile's onboarding gate is a
// LOCAL flag OR the server's `hasCompletedOnboarding`; a fresh install has no
// local flag, so set the server one (idempotent) or every flow lands on the
// wizard instead of Today.
await api.post("/me/onboarding/complete");

// ---- 4. Maestro ----
const maestro =
  spawnSync("which", ["maestro"]).stdout?.toString().trim() ||
  join(homedir(), ".maestro/maestro/bin/maestro");
if (!existsSync(maestro)) {
  fail(
    "Maestro CLI not found. Install it once per machine — see e2e/README.md.",
  );
}

// Android: pin ONE online device (a second, offline/booting emulator makes
// both adb and Maestro ambiguous).
let deviceArgs: string[] = [];
if (android) {
  const adb =
    spawnSync("which", ["adb"]).stdout?.toString().trim() ||
    join(homedir(), "Library/Android/sdk/platform-tools/adb");
  const online = (spawnSync(adb, ["devices"]).stdout?.toString() ?? "")
    .split("\n")
    .slice(1)
    .map((l) => l.trim().split(/\s+/))
    .filter(([, state]) => state === "device")
    .map(([serial]) => serial!);
  const serial = process.env.ANDROID_SERIAL ?? online[0];
  if (!serial) fail("No online Android emulator/device (adb devices).");
  if (!process.env.ANDROID_SERIAL && online.length > 1) {
    console.warn(
      `[mobile-e2e] several devices online — using ${serial} (set ANDROID_SERIAL to choose).`,
    );
  }
  process.env.ANDROID_SERIAL = serial;
  // Maestro only gets --device when the user pinned one explicitly: its own
  // device discovery rejects an id while another emulator is still offline.
  if (process.env.E2E_PIN_DEVICE) deviceArgs = ["--device", serial];
  for (const port of ["8081"])
    spawnSync(adb, ["reverse", `tcp:${port}`, `tcp:${port}`]);
  const reverse = spawnSync(
    "bash",
    [join(HERE, "../scripts/android-reverse.sh")],
    {
      stdio: "inherit",
      env: process.env,
    },
  );
  if (reverse.status !== 0)
    fail("adb reverse failed — is the emulator booted?");
  // Start from a known state: the app may still be signed in as ANOTHER
  // account (the flows would happily test it while the runner resets this
  // one), and Chrome may hold another user's Hub session that the sign-in
  // Custom Tab would silently reuse via SSO. Clearing both makes the first
  // flow sign in as E2E_EMAIL. E2E_KEEP_STATE=1 skips this.
  if (!process.env.E2E_KEEP_STATE) {
    for (const pkg of ["com.stageholder.meridian", "com.android.chrome"]) {
      spawnSync(adb, ["shell", "pm", "clear", pkg]);
    }
  }
} else {
  // iOS: pin the booted simulator. Without --device Maestro picks ANY
  // connected target, and an Android emulator left running wins silently.
  const udid = process.env.E2E_IOS_UDID ?? bootedSimulator();
  if (!udid)
    fail("No booted iOS simulator (xcrun simctl list devices booted).");
  deviceArgs = ["--device", udid];
}

function bootedSimulator(): string | undefined {
  const out = spawnSync("xcrun", [
    "simctl",
    "list",
    "devices",
    "booted",
    "-j",
  ]).stdout?.toString();
  if (!out) return undefined;
  const devices = Object.values(
    (JSON.parse(out) as { devices: Record<string, { udid: string }[]> })
      .devices,
  ).flat();
  return devices[0]?.udid;
}

const targets = passthrough.filter((a) => !a.startsWith("-"));
const flags = passthrough.filter((a) => a.startsWith("-"));
const result = spawnSync(
  maestro,
  [
    "test",
    ...deviceArgs,
    ...flags,
    "--env",
    `E2E_EMAIL=${env.email}`,
    "--env",
    `E2E_PASSWORD=${env.password}`,
    "--env",
    `E2E_JOURNAL_PASSPHRASE=${env.journalPassphrase}`,
    "--env",
    `PLATFORM=${android ? "android" : "ios"}`,
    "--test-output-dir",
    join(HERE, ".output"),
    ...(targets.length
      ? targets.map((t) => join(HERE, t))
      : [join(HERE, "flows")]),
  ],
  { stdio: "inherit", cwd: HERE },
);

// ---- 5. cleanup (always) ----
await api
  .resetAccount()
  .catch((e: Error) =>
    console.warn(`[mobile-e2e] cleanup failed: ${e.message}`),
  );
process.exit(result.status ?? 1);
