/**
 * E2E configuration. Everything comes from the environment (or the gitignored
 * `e2e/.env.e2e`, loaded by playwright.config.ts); nothing secret is
 * hardcoded. See ../README.md.
 */
export const env = {
  pwaUrl: process.env.E2E_BASE_URL ?? "http://localhost:4001",
  apiUrl: process.env.E2E_API_URL ?? "http://localhost:4000",
  hubUrl: process.env.E2E_HUB_URL ?? "http://localhost:4828",
  hubWebUrl: process.env.E2E_HUB_WEB_URL ?? "http://localhost:4829",
  /** Dedicated test account (onboarded, Free plan). */
  email: process.env.E2E_EMAIL ?? "",
  password: process.env.E2E_PASSWORD ?? "",
  /** Journal encryption passphrase for that account (set up on first run). */
  journalPassphrase: process.env.E2E_JOURNAL_PASSPHRASE ?? "",
};

/** Saved signed-in browser states (gitignored). */
export const AUTH_DIR =
  process.env.E2E_AUTH_DIR ?? new URL("../.auth/", import.meta.url).pathname;
export const OWNER_STATE = `${AUTH_DIR}owner.json`;
export const SKIP_FILE = `${AUTH_DIR}skip-reason.txt`;

/** SDK session key in localStorage (`stageholder:session:<productSlug>`). */
export const SESSION_KEY = "stageholder:session:meridian";

/** Unique, recognisable test-data name: `JEVB E2E <label> <timestamp>`. */
export const uniqueName = (label: string): string =>
  `JEVB E2E ${label} ${Date.now().toString().slice(-8)}`;

/** Prefix shared by every record a journey creates (cleanup matches on it). */
export const TEST_PREFIX = "JEVB E2E";
