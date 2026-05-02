/**
 * Dev-time check that a fattest-case ProductSession seals to under 4 KB.
 *
 * Run with: bun run apps/pwa/scripts/check-cookie-size.ts
 * Or from the pwa package: bun run check:cookie-size
 *
 * Exits non-zero if the projected sealed size exceeds 3500 bytes (the
 * recommended budget — leaves headroom for cookie attributes and growth
 * in the `custom` bag).
 *
 * If the hard 4096-byte limit is breached in production, the browser silently
 * drops the cookie and every request becomes unauthenticated. Switch to a
 * server-side SessionStore (Postgres/Redis) before deploying if this check
 * warns consistently.
 */
import { measureSessionCookieSize } from "@stageholder/sdk/nextjs";
import type { ProductSession } from "@stageholder/sdk/nextjs";
import type { MeridianCustom } from "../lib/stageholder";

/** Worst-case session with maximally-sized tokens and full custom payload. */
const fakeFatSession: ProductSession<MeridianCustom> = {
  sub: "00000000-0000-0000-0000-000000000000",
  email: "user@example.test",
  name: "User Name",
  picture: "https://example.test/avatar.jpg",
  emailVerified: true,
  accessToken: "header." + "a".repeat(1500) + ".sig", // ~1.5 KB JWT with claims
  refreshToken: "rt_" + "b".repeat(64),
  accessTokenExpiresAt: Math.floor(Date.now() / 1000) + 900,
  activeOrgId: "00000000-0000-0000-0000-000000000000",
  csrfToken: "d".repeat(43),
  custom: {
    personalOrgId: "00000000-0000-0000-0000-000000000000",
    hasCompletedOnboarding: false,
  },
};

const SECRET = process.env.SESSION_SECRET ?? "x".repeat(32);
const SOFT_LIMIT = 3500;
const HARD_LIMIT = 4096;

const size = await measureSessionCookieSize(fakeFatSession, SECRET);

console.log(`Sealed cookie size: ${size} bytes`);
console.log(`  Soft limit: ${SOFT_LIMIT} bytes`);
console.log(`  Hard limit: ${HARD_LIMIT} bytes (browser)`);

if (size > HARD_LIMIT) {
  console.error(`FAIL: ${size} bytes exceeds the 4 KB browser hard limit.`);
  console.error(
    "Switch to a server-side SessionStore (Postgres/Redis) before deploying.",
  );
  process.exit(1);
}

if (size > SOFT_LIMIT) {
  console.warn(`WARN: ${size} bytes exceeds the soft budget of ${SOFT_LIMIT}.`);
  console.warn(
    "Consider reducing the size of session.custom or moving to a server-side store.",
  );
}
