import {
  defineStageholderConfig,
  createMongoStorageBackend,
} from "@stageholder/sdk/nextjs";

/**
 * Meridian-specific custom session shape.
 *
 * Populated server-side by the `enrichSession` hook wired into the auth
 * catch-all route at every session create/refresh. Reading these fields from
 * `session.custom` avoids a live `GET /api/v1/me` call on every page load.
 */
export interface MeridianCustom {
  /** Meridian's "personal" org id resolved at login time. */
  personalOrgId: string;
  /** Onboarding flag — gates the post-login → /onboarding redirect. */
  hasCompletedOnboarding: boolean;
}

/**
 * Server-side session storage backend (singleton, module-scoped).
 *
 * Persists in MongoDB's `sessions` collection alongside Meridian's regular
 * data — same backend in dev, staging, and production. Sessions survive
 * server restarts and replicate across Cloud Run replicas because they
 * live in the database, not in process memory.
 *
 * The Hub's access tokens carry `organizations`, `product_access`, and
 * `subscriptions` claims that push the sealed iron-session cookie past
 * the browser's 4096-byte per-cookie limit; with this backend the cookie
 * carries only an opaque session id (~120 bytes).
 *
 * Document shape `{ _id, value, expiresAt: Date }` and TTL index are
 * byte-compatible with the previous custom impl — live sessions migrate
 * seamlessly across the SDK swap.
 */
// Pass `uri` (not a pre-connected client) so the SDK lazy-connects on first
// session read/write. Keeps `next build`'s page-data collection from
// attempting a real DB connection at module load.
export const sessionBackend = createMongoStorageBackend({
  uri: process.env.MONGODB_URI ?? "mongodb://build-placeholder.invalid:27017",
  db: "meridian",
  collection: "sessions",
});

/**
 * Singleton SDK config bundle for Meridian's BFF.
 *
 * Env-derived defaults: `issuerUrl` (`IDENTITY_ISSUER_URL`), `clientId`
 * (`IDENTITY_CLIENT_ID`), `clientSecret` (`IDENTITY_CLIENT_SECRET`),
 * `redirectUri` (`IDENTITY_REDIRECT_URI`), `sessionSecret`
 * (`SESSION_SECRET`), `audience` (`IDENTITY_TOKEN_AUDIENCE`). Config is
 * validated synchronously at module init — misconfigured env throws a
 * `ConfigError` at cold-start.
 */
export const stageholder = defineStageholderConfig<MeridianCustom>({
  productSlug: "meridian",
  silentSso: false,
  storageBackend: sessionBackend,
  loginRedirectPath: "/",
  // Where the Hub sends the browser after RP-initiated logout completes.
  // Must match a `post_logout_redirect_uris` entry on this client's row in
  // the Hub's `oidc_clients` table — landing on /goodbye also runs the
  // cross-tab BroadcastChannel that wakes other tabs into the signed-out UI.
  logoutRedirectUri:
    process.env.LOGOUT_REDIRECT_URI ?? "http://localhost:4001/goodbye",
});
