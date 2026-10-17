import { chromium, type FullConfig } from "@playwright/test";
import {
  rmSync,
  mkdirSync,
  existsSync,
  renameSync,
  readFileSync,
  writeFileSync,
} from "node:fs";

import { signInViaHub } from "./sign-in";
import { completeOnboarding } from "./onboarding";
import { waitForApi, stackDownReason } from "./stack";
import { env, AUTH_DIR, SKIP_FILE, OWNER_STATE, SESSION_KEY } from "./env";

const EMPTY_STATE = JSON.stringify({ cookies: [], origins: [] });

/**
 * Reuse a saved session only while its access token stays valid for at least
 * E2E_AUTH_MIN_LEFT_MIN more minutes (default 20). The SDK refreshes ahead of
 * expiry in the page, but API setup calls read the stored token directly.
 */
const MIN_LEFT_MS = Number(process.env.E2E_AUTH_MIN_LEFT_MIN ?? 20) * 60_000;

function freshState(path: string, email: string): boolean {
  if (process.env.E2E_FORCE_SIGNIN || !existsSync(path)) return false;
  try {
    const state = JSON.parse(readFileSync(path, "utf8")) as {
      origins?: Array<{
        localStorage?: Array<{ name: string; value: string }>;
      }>;
    };
    const item = state.origins
      ?.flatMap((o) => o.localStorage ?? [])
      .find((i) => i.name === SESSION_KEY);
    const session = JSON.parse(item?.value ?? "{}") as {
      expiresAt?: number;
      accessToken?: string;
    };
    // A state saved for a different account (credentials changed) is stale.
    const claims = JSON.parse(
      Buffer.from(
        session.accessToken?.split(".")[1] ?? "",
        "base64url",
      ).toString() || "{}",
    ) as { email?: string };
    if (claims.email?.toLowerCase() !== email.toLowerCase()) return false;
    return Number(session.expiresAt ?? 0) - Date.now() > MIN_LEFT_MS;
  } catch {
    return false;
  }
}

/** Sign in via the Hub; the saved state is replaced only when sign-in succeeds. */
async function saveSignedInState(baseURL: string): Promise<void> {
  if (freshState(OWNER_STATE, env.email)) return;
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await signInViaHub(page, env.email, env.password, "/");
    // A brand-new account lands on /onboarding; finish it once.
    await completeOnboarding(page);
    // Let the SDK persist the session before snapshotting storage.
    await page
      .waitForFunction(
        (key) => Boolean(window.localStorage.getItem(key)),
        SESSION_KEY,
        { timeout: 15_000 },
      )
      .catch(() => undefined);
    await context.storageState({ path: `${OWNER_STATE}.tmp` });
    renameSync(`${OWNER_STATE}.tmp`, OWNER_STATE);
  } finally {
    await browser.close();
  }
}

/**
 * Runs once: checks the stack is up, then signs the test account in via the
 * Hub and saves its storage state. When anything is missing it writes a skip
 * reason that every journey reads (see fixtures.ts), so the run reports clear
 * skips instead of timeouts.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  mkdirSync(AUTH_DIR, { recursive: true });
  rmSync(SKIP_FILE, { force: true });
  if (!existsSync(OWNER_STATE)) writeFileSync(OWNER_STATE, EMPTY_STATE);

  const skip = (reason: string) => {
    writeFileSync(SKIP_FILE, reason);
    console.warn(`\n[e2e] SKIPPING ALL JOURNEYS: ${reason}\n`);
  };

  await waitForApi(env.apiUrl, 60_000);
  const down = await stackDownReason(env.pwaUrl, env.apiUrl, env.hubUrl);
  if (down) return skip(down);
  if (!env.email || !env.password) {
    return skip(
      "E2E_EMAIL / E2E_PASSWORD are not set. See apps/pwa/e2e/README.md.",
    );
  }

  const baseURL = config.projects[0]?.use.baseURL ?? env.pwaUrl;
  try {
    await saveSignedInState(baseURL);
  } catch (error) {
    return skip(
      `Sign-in via the Hub failed: ${(error as Error).message.split("\n")[0]}`,
    );
  }
}
