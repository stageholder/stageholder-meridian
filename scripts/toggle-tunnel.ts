#!/usr/bin/env bun
/**
 * toggle-tunnel.ts
 *
 * One-command switch for the Hub + Meridian API + mobile dev envs
 * between "localhost" mode (browser-based dev — PWA, desktop) and
 * "tunnel" mode (real-iPhone dev via cloudflared at id-dev.stageholder.com).
 *
 *   bun tunnel          — flip the current mode (auto-detect)
 *   bun tunnel on       — force tunnel mode
 *   bun tunnel off      — force localhost mode
 *   bun tunnel status   — show current mode without changing anything
 *   bun tunnel up       — flip to tunnel, start cloudflared, revert on Ctrl+C
 *
 * `bun tunnel up` is the most ergonomic for daily mobile work:
 *   - flips env to tunnel mode
 *   - spawns `cloudflared tunnel run meridian-dev`
 *   - on Ctrl+C: kills cloudflared, flips env back to localhost
 *   - on unexpected cloudflared exit: same cleanup, returns to localhost
 *
 * Why this exists: OIDC's `issuer` claim must match the URL clients
 * discover Hub at, so Hub can only advertise ONE issuer URL at a time.
 * That means flipping between local-only and tunnel-reachable dev
 * requires coordinated edits across multiple .env files. Doing it by
 * hand is error-prone — miss one line and you get OIDC issuer
 * mismatches or 401 loops.
 *
 * The script edits these three files in place:
 *   - stageholder-identity/.env                    (Hub)
 *   - stageholder-meridian/apps/mobile/.env.local  (mobile JS bundle URLs)
 *   - stageholder-meridian/apps/api/.env           (Meridian API JWT issuer)
 *
 * It works by detecting which value of each key is currently active
 * (uncommented) and toggling. Each file has the alternative URL as a
 * commented line in its respective Block A / Block B layout.
 *
 * Setup prerequisite (one-time): a cloudflared tunnel named
 * `meridian-dev` with DNS routes for id-dev / id-web-dev /
 * meridian-api-dev under stageholder.com. See ~/.cloudflared/config.yml.
 */

import { readFile, writeFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/* ───────────────────────────── paths ─────────────────────────────────── */

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

// Hub lives as a sibling repo. If you move it, update this path.
const HUB_ENV = join(REPO_ROOT, "..", "stageholder-identity", ".env");
const MOBILE_ENV = join(REPO_ROOT, "apps", "mobile", ".env.local");
const MERIDIAN_API_ENV = join(REPO_ROOT, "apps", "api", ".env");

/* ───────────────────────────── config ────────────────────────────────── */

type ToggleEntry = {
  key: string;
  localhost: string;
  tunnel: string;
};

const HUB_ENTRIES: ToggleEntry[] = [
  {
    key: "ISSUER_URL",
    localhost: "http://localhost:4828",
    tunnel: "https://id-dev.stageholder.com",
  },
  {
    key: "NEXT_PUBLIC_API_URL",
    localhost: "http://localhost:4828",
    tunnel: "https://id-dev.stageholder.com",
  },
  {
    key: "NEXT_PUBLIC_ISSUER_URL",
    localhost: "http://localhost:4828",
    tunnel: "https://id-dev.stageholder.com",
  },
  {
    key: "FRONTEND_URL",
    localhost: "http://localhost:4829",
    tunnel: "https://id-web-dev.stageholder.com",
  },
  // Cross-subdomain cookie scope. In localhost mode, must be EMPTY —
  // browsers reject Domain=localhost on cookies (single-label hosts
  // can't host cookies at the host level). In tunnel mode, scoped to
  // the parent domain so the `sid` cookie set on id-dev.stageholder.com
  // is also sent to id-web-dev.stageholder.com (and vice versa).
  // Without this, post-register / post-login redirects between the two
  // subdomains lose the session cookie and bounce back to /auth/login.
  {
    key: "COOKIE_DOMAIN",
    localhost: "",
    tunnel: ".stageholder.com",
  },
];

const MOBILE_ENTRIES: ToggleEntry[] = [
  {
    key: "EXPO_PUBLIC_STAGEHOLDER_ISSUER_URL",
    localhost: "http://localhost:4828/oidc",
    tunnel: "https://id-dev.stageholder.com/oidc",
  },
  {
    key: "EXPO_PUBLIC_MERIDIAN_API_URL",
    localhost: "http://localhost:4000/api/v1",
    tunnel: "https://meridian-api-dev.stageholder.com/api/v1",
  },
];

// Meridian API validates incoming JWTs against IDENTITY_ISSUER_URL — if
// the token's `iss` claim doesn't match exactly, every authenticated
// route 401s. Must flip together with Hub's ISSUER_URL.
const MERIDIAN_API_ENTRIES: ToggleEntry[] = [
  {
    key: "IDENTITY_ISSUER_URL",
    localhost: "http://localhost:4828/oidc",
    tunnel: "https://id-dev.stageholder.com/oidc",
  },
  {
    key: "IDENTITY_HUB_URL",
    localhost: "http://localhost:4828",
    tunnel: "https://id-dev.stageholder.com",
  },
];

/* ───────────────────────────── helpers ───────────────────────────────── */

type Mode = "localhost" | "tunnel";
type State = Mode | "mixed";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Detect whether each entry is currently localhost or tunnel by looking
 * for an uncommented `KEY=value` line for one of the two known values.
 * Returns "mixed" if entries disagree (manual edit, half-flip, etc.).
 */
function detectMode(content: string, entries: ToggleEntry[]): State {
  let local = 0;
  let tunnel = 0;
  for (const entry of entries) {
    if (
      new RegExp(
        `^${escapeRegex(entry.key)}=${escapeRegex(entry.localhost)}\\s*$`,
        "m",
      ).test(content)
    ) {
      local++;
    } else if (
      new RegExp(
        `^${escapeRegex(entry.key)}=${escapeRegex(entry.tunnel)}\\s*$`,
        "m",
      ).test(content)
    ) {
      tunnel++;
    }
  }
  if (local === entries.length) return "localhost";
  if (tunnel === entries.length) return "tunnel";
  return "mixed";
}

/**
 * Flip a file's content to the target mode. Comments-out the OLD value
 * line and uncomments the NEW value line for each entry. Idempotent —
 * applying the same target twice is a no-op.
 */
function applyMode(
  content: string,
  entries: ToggleEntry[],
  target: Mode,
): string {
  let out = content;
  for (const entry of entries) {
    const active = target === "localhost" ? entry.localhost : entry.tunnel;
    const inactive = target === "localhost" ? entry.tunnel : entry.localhost;

    // Comment the inactive line if currently uncommented. Anchored to
    // line start with `^`, end with `\s*$` to tolerate trailing
    // whitespace.
    out = out.replace(
      new RegExp(
        `^(${escapeRegex(entry.key)}=${escapeRegex(inactive)})\\s*$`,
        "m",
      ),
      "# $1",
    );

    // Uncomment the active line if currently commented. Allows zero or
    // one space after `#`.
    out = out.replace(
      new RegExp(
        `^# ?(${escapeRegex(entry.key)}=${escapeRegex(active)})\\s*$`,
        "m",
      ),
      "$1",
    );
  }
  return out;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/* ───────────────────────────── output ────────────────────────────────── */

function colorize(s: string, code: number): string {
  return `\x1b[${code}m${s}\x1b[0m`;
}
const green = (s: string) => colorize(s, 32);
const yellow = (s: string) => colorize(s, 33);
const cyan = (s: string) => colorize(s, 36);
const dim = (s: string) => colorize(s, 90);
const bold = (s: string) => colorize(s, 1);

function modeLabel(state: State): string {
  if (state === "localhost") return cyan("localhost");
  if (state === "tunnel") return green("tunnel");
  return yellow("mixed (manually edited?)");
}

function printState(
  hubState: State,
  mobileState: State,
  meridianApiState: State,
) {
  console.log(`\n${bold("Current mode:")}`);
  console.log(`  Hub          ${modeLabel(hubState)}`);
  console.log(`  Mobile       ${modeLabel(mobileState)}`);
  console.log(`  Meridian API ${modeLabel(meridianApiState)}\n`);
}

function printNextSteps(newMode: Mode) {
  if (newMode === "tunnel") {
    console.log(bold("Next:"));
    console.log(
      `  1. Make sure the cloudflared tunnel is running. In another terminal:`,
    );
    console.log(`       ${cyan("cloudflared tunnel run meridian-dev")}`);
    console.log(
      `  2. Restart Hub so it picks up the new ${cyan("ISSUER_URL")}:`,
    );
    console.log(`       ${cyan("cd ../stageholder-identity && bun run dev")}`);
    console.log(
      `  3. Restart Meridian API so JWT validation accepts the new issuer:`,
    );
    console.log(`       ${cyan("cd apps/api && bun run dev")}`);
    console.log(
      `  4. Restart Metro with cache clear so the new mobile URLs are bundled in:`,
    );
    console.log(`       ${cyan("cd apps/mobile && bunx expo start --clear")}`);
    console.log(
      `\n  ${dim("Clear iPhone Safari cookies for *.stageholder.com if you've signed in before.")}\n`,
    );
  } else {
    console.log(bold("Next:"));
    console.log(`  1. Restart Hub:`);
    console.log(`       ${cyan("cd ../stageholder-identity && bun run dev")}`);
    console.log(`  2. Restart Meridian API:`);
    console.log(`       ${cyan("cd apps/api && bun run dev")}`);
    console.log(`  3. Restart Metro with cache clear:`);
    console.log(`       ${cyan("cd apps/mobile && bunx expo start --clear")}`);
    console.log(
      `\n  ${dim("cloudflared can keep running — it's harmless when idle. Or stop it.")}\n`,
    );
  }
}

/* ───────────────────────────── flip helper ──────────────────────────── */
//
// Shared between the regular toggle commands and the `up` session
// command. Reads all three files, applies the target mode, writes
// them back. Returns the new state (post-flip) so callers can report.

async function flipAllTo(target: Mode): Promise<void> {
  const [hubContent, mobileContent, meridianApiContent] = await Promise.all([
    readFile(HUB_ENV, "utf-8"),
    readFile(MOBILE_ENV, "utf-8"),
    readFile(MERIDIAN_API_ENV, "utf-8"),
  ]);
  await Promise.all([
    writeFile(HUB_ENV, applyMode(hubContent, HUB_ENTRIES, target)),
    writeFile(MOBILE_ENV, applyMode(mobileContent, MOBILE_ENTRIES, target)),
    writeFile(
      MERIDIAN_API_ENV,
      applyMode(meridianApiContent, MERIDIAN_API_ENTRIES, target),
    ),
  ]);
}

/* ───────────────────────────── session ──────────────────────────────── */
//
// `bun tunnel up` — full mobile-dev session lifecycle:
//   1. Flip env files to tunnel
//   2. Spawn cloudflared, inherit stdio so user sees its logs live
//   3. Wait for cloudflared to exit (Ctrl+C from user OR a crash)
//   4. Always flip env back to localhost in finally{}
//   5. Exit with cloudflared's exit code
//
// Idempotent on the env side — if already in tunnel mode, the flip is
// a no-op. Idempotent on the cloudflared side too — if another
// cloudflared is already running for the same tunnel, cloudflared
// itself errors out (it can't grab the same tunnel twice) and we
// gracefully revert.

async function runSession() {
  console.log(`${bold("Starting mobile-dev session…")}\n`);

  // 1. Flip env to tunnel.
  console.log(dim("[1/3] Flipping env files to tunnel mode…"));
  await flipAllTo("tunnel");
  console.log(
    green("      ✓ Hub, Mobile, and Meridian API envs are now tunnel"),
  );

  // Remind the user to restart their dev servers.
  console.log(`
${bold("Restart these dev servers now (so they pick up the new env):")}
  ${cyan("cd ../stageholder-identity/apps/api && bun run dev")}
  ${cyan("cd apps/api && bun run dev")}
  ${cyan("cd apps/mobile && bunx expo start --clear")}

${dim("(Hub web auto-reloads on env change, no restart needed.)")}
`);

  // 2. Spawn cloudflared.
  console.log(dim("[2/3] Starting cloudflared tunnel meridian-dev…"));
  console.log(dim("      Press Ctrl+C to stop and revert env to localhost.\n"));

  const proc = Bun.spawn(["cloudflared", "tunnel", "run", "meridian-dev"], {
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });

  // 3. Signal handlers — same cleanup for SIGINT (Ctrl+C) and SIGTERM.
  let cleaningUp = false;
  const cleanup = async (signal?: NodeJS.Signals) => {
    if (cleaningUp) return;
    cleaningUp = true;
    console.log(
      `\n${dim(`[3/3] ${signal ? `Got ${signal}, ` : ""}stopping cloudflared and reverting env to localhost…`)}`,
    );
    if (!proc.killed) {
      try {
        proc.kill("SIGTERM");
      } catch {
        // Already gone — that's fine.
      }
    }
    // Wait for cloudflared to exit so we don't tear down env mid-request.
    try {
      await proc.exited;
    } catch {
      // Ignore — exit will be observed via the outer await below.
    }
    await flipAllTo("localhost");
    console.log(green("      ✓ Env reverted to localhost"));
    console.log(
      `\n${dim("Restart Hub API + Meridian API to pick up the localhost env.")}`,
    );
    process.exit(0);
  };

  process.on("SIGINT", () => void cleanup("SIGINT"));
  process.on("SIGTERM", () => void cleanup("SIGTERM"));

  // Wait for cloudflared to exit on its own — could mean the user
  // killed it directly, or cloudflared crashed. In either case we
  // still want the env reverted.
  const exitCode = await proc.exited;
  if (!cleaningUp) {
    console.log(
      `\n${yellow(`cloudflared exited unexpectedly (code=${exitCode}). Reverting env…`)}`,
    );
    cleaningUp = true;
    await flipAllTo("localhost");
    console.log(green("      ✓ Env reverted to localhost"));
    process.exit(exitCode ?? 1);
  }
}

/* ───────────────────────────── main ──────────────────────────────────── */

async function main() {
  // Verify paths before doing anything destructive.
  if (!(await fileExists(HUB_ENV))) {
    console.error(`Hub .env not found at: ${HUB_ENV}`);
    console.error(`Update HUB_ENV in scripts/toggle-tunnel.ts.`);
    process.exit(1);
  }
  if (!(await fileExists(MOBILE_ENV))) {
    console.error(`Mobile .env.local not found at: ${MOBILE_ENV}`);
    process.exit(1);
  }
  if (!(await fileExists(MERIDIAN_API_ENV))) {
    console.error(`Meridian API .env not found at: ${MERIDIAN_API_ENV}`);
    process.exit(1);
  }

  const hubContent = await readFile(HUB_ENV, "utf-8");
  const mobileContent = await readFile(MOBILE_ENV, "utf-8");
  const meridianApiContent = await readFile(MERIDIAN_API_ENV, "utf-8");
  const hubState = detectMode(hubContent, HUB_ENTRIES);
  const mobileState = detectMode(mobileContent, MOBILE_ENTRIES);
  const meridianApiState = detectMode(meridianApiContent, MERIDIAN_API_ENTRIES);

  const arg = process.argv[2]?.toLowerCase();

  // Pure status query.
  if (arg === "status") {
    printState(hubState, mobileState, meridianApiState);
    return;
  }

  // Session lifecycle: flip + run cloudflared + auto-cleanup on exit.
  if (arg === "up") {
    await runSession();
    return;
  }

  // Resolve target mode.
  let target: Mode;
  if (arg === "on") target = "tunnel";
  else if (arg === "off") target = "localhost";
  else if (arg === "tunnel") target = "tunnel";
  else if (arg === "localhost") target = "localhost";
  else if (!arg) {
    // Auto-flip from current Hub state.
    if (hubState === "mixed") {
      console.error(
        yellow("Hub is in a mixed state — please pick explicitly:"),
      );
      console.error(`  bun tunnel on        # switch to tunnel mode`);
      console.error(`  bun tunnel off       # switch to localhost mode`);
      process.exit(1);
    }
    target = hubState === "localhost" ? "tunnel" : "localhost";
  } else {
    console.error(`Unknown argument: ${arg}`);
    console.error(`Usage: bun tunnel [on|off|status|up]`);
    process.exit(1);
  }

  printState(hubState, mobileState, meridianApiState);
  console.log(`Flipping to: ${modeLabel(target)}\n`);

  // No-op short-circuit.
  if (
    hubState === target &&
    mobileState === target &&
    meridianApiState === target
  ) {
    console.log(dim("Already in target mode — no changes needed.\n"));
    return;
  }

  const newHub = applyMode(hubContent, HUB_ENTRIES, target);
  const newMobile = applyMode(mobileContent, MOBILE_ENTRIES, target);
  const newMeridianApi = applyMode(
    meridianApiContent,
    MERIDIAN_API_ENTRIES,
    target,
  );

  await writeFile(HUB_ENV, newHub);
  await writeFile(MOBILE_ENV, newMobile);
  await writeFile(MERIDIAN_API_ENV, newMeridianApi);
  console.log(green("✓ Hub .env updated"));
  console.log(green("✓ Mobile .env.local updated"));
  console.log(green("✓ Meridian API .env updated\n"));

  printNextSteps(target);
}

main().catch((err) => {
  console.error("Toggle failed:", err);
  process.exit(1);
});
