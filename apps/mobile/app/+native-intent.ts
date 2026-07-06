// apps/mobile/app/+native-intent.ts
//
// Expo Router runs this for every incoming native deep link BEFORE it tries to
// match a route, letting us rewrite or swallow URLs that shouldn't map to a
// screen.
//
// Why it exists: the OIDC sign-in (expo-web-browser's openAuthSessionAsync,
// driven by @stageholder/sdk/react-native) redirects to
//     meridian://auth/callback?code=...&state=...
// That URL fires the app's `meridian://` intent-filter, so the SAME deep link
// is delivered to TWO listeners at once:
//   1. expo-web-browser's auth-session handler — captures the URL, exchanges
//      the code for tokens, and signs the user in. This is the part we want and
//      it runs independently of the router.
//   2. expo-router — which would try to render `/auth/callback`, a route that
//      does not exist, so it falls through to the built-in "Unmatched Route"
//      screen (the bug we saw).
//
// We intercept the callback here and send the router to `/` instead. `/`
// resolves to the (authed) group, which gates on auth state — so once the auth
// session has signed the user in, they land on home; if it somehow didn't, the
// gate bounces them back to /sign-in. The auth session still receives the raw
// URL regardless of what we return here.
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string {
  if (isAuthCallback(path)) {
    return "/";
  }
  return path;
}

// Match ONLY the OIDC callback, anchored to the path segment — a loose
// `includes("auth/callback")` would also swallow any legitimate deep link that
// merely contains that substring (e.g. a query param, or a journal deep link
// whose slug happens to contain it). Expo hands `path` as either the full
// `meridian://auth/callback?...` URL or a router-relative `/auth/callback?...`,
// so we can't rely on `new URL().pathname` (a custom scheme treats `auth` as
// the host → pathname `/callback`). Instead strip scheme + query/hash and
// compare the bare route segment exactly.
function isAuthCallback(path: string): boolean {
  const withoutScheme = path.replace(/^meridian:\/\//, "");
  const routeOnly = withoutScheme.split(/[?#]/, 1)[0].replace(/^\/+/, "");
  return routeOnly === "auth/callback";
}
