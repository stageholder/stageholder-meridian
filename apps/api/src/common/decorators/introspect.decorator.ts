import { SetMetadata } from "@nestjs/common";

export const IS_INTROSPECT_KEY = "isIntrospect";

/**
 * Marks a route as revocation-sensitive. The AuthGuard performs an extra
 * RFC 7662 introspection call to the Hub after JWT signature verification,
 * blocking requests that carry a signature-valid-but-revoked access token
 * (e.g. a token leaked before the user hit "sign out everywhere").
 *
 * Adds one synchronous network round-trip to the Hub per request, so apply
 * only to genuinely destructive operations — E2EE key rotation, recovery
 * finalization, that kind of thing. Ordinary data mutations rely on the
 * 15-minute access-token TTL to bound the blast radius of a leaked token.
 */
export const Introspect = () => SetMetadata(IS_INTROSPECT_KEY, true);
