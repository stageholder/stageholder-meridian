import type { OrgMembership } from "@stageholder/sdk/core";

/**
 * Subset of claims Meridian needs to read off the OIDC access token
 * server-side. Mirrors the shape Hub stamps in
 * `OidcService.findAccount.claims`.
 *
 * Decoded WITHOUT signature verification — safe here because the JWT is
 * read from the iron-session sealed cookie, which the SDK already
 * trust-roots (the seal is a cryptographic gate; if it opened, the
 * payload is what Hub issued).
 */
export interface AccessTokenClaims {
  sub?: string;
  organizations?: OrgMembership[];
}

/**
 * Decode the payload segment of a JWT without verifying. Returns `null`
 * for malformed tokens (opaque tokens, truncated strings) so callers can
 * default-handle missing claims rather than crash.
 *
 * Mirrors the SDK's internal `decodeAccessTokenClaims` (in
 * `helpers/require-feature.ts`) — Meridian carries its own copy because
 * the SDK doesn't export the helper.
 */
export function decodeAccessTokenClaims(jwt: string): AccessTokenClaims | null {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1]!;
    const padded = payload.padEnd(
      payload.length + ((4 - (payload.length % 4)) % 4),
      "=",
    );
    const json = Buffer.from(
      padded.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf8");
    return JSON.parse(json) as AccessTokenClaims;
  } catch {
    return null;
  }
}
