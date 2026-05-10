# @meridian/mobile

Expo (SDK 54) app for Meridian, with auth + token lifecycle handled entirely by
`@stageholder/sdk/react-native`. The auth shell is done — drop product screens
under `app/(authed)/`.

## What the SDK already handles

You do **not** need to write any of this yourself:

- OIDC code+PKCE sign-in via the system browser (`ASWebAuthenticationSession` /
  Custom Tabs) — RFC 8252 native public client, no client secret in the app
- Hardware-backed token storage (`expo-secure-store` → iOS Keychain / Android
  Keystore)
- Refresh-token rotation on AppState resume + access-token expiry
- RFC 7009 token revocation on sign-out
- Reactive context (`useUser`, `useOrg`, `useFeature`, `useSubscription`,
  `useEnterprise`) populated from access-token claims — no `/auth/me` round-trip

Your job: build product screens and read from those hooks.

## Layout

```
app/
  _layout.tsx          ← StageholderProvider mount
  sign-in.tsx          ← Pre-auth landing
  (authed)/
    _layout.tsx        ← Auth gate. Add screens beside index.tsx.
    index.tsx          ← Authenticated landing — replace with real product UI
```

`(authed)/_layout.tsx` redirects to `/sign-in` for any unauthenticated request.
Every screen you add under `(authed)/` is auth-gated automatically.

## Prerequisites

### 1. Hub API running

The mobile app needs a reachable Hub OIDC endpoint. For local dev, run the
Hub API at `http://localhost:4828` (from the stageholder-identity repo):

```bash
bun run dev:api
```

### 2. Hub OIDC client registration

Mobile needs a row in Hub's `oidc_clients` table. Either insert via SQL:

```sql
INSERT INTO oidc_clients (
  client_id,
  client_secret,
  redirect_uris,
  post_logout_redirect_uris,
  grant_types,
  scopes,
  application_type,
  token_endpoint_auth_method,
  first_party,
  audience
) VALUES (
  'meridian-mobile',
  NULL,
  '["meridian://auth/callback","exp://127.0.0.1:8081/--/auth/callback"]',
  '["meridian://auth/signed-out"]',
  '["authorization_code","refresh_token"]',
  '["openid","offline_access","profile","email","organizations","product_access","subscriptions"]',
  'native',
  'none',
  TRUE,
  'meridian-api'
);
```

Or use the Hub admin UI at `http://localhost:4829/admin/oidc-clients/new`:

- **Client ID**: `meridian-mobile`
- **Application type**: `native` (this auto-forces `token_endpoint_auth_method = none` — no client secret)
- **Redirect URIs**:
  - `meridian://auth/callback` (production, custom scheme)
  - `exp://127.0.0.1:8081/--/auth/callback` (Expo Go on iOS Simulator dev)
- **Grant types**: `authorization_code`, `refresh_token`
- **Scopes**: `openid`, `offline_access`, `profile`, `email`, `organizations`, `product_access`, `subscriptions`
- **Audience**: `meridian-api`
- **First-party**: ✓ (skips consent screen)

Native clients **must** use `token_endpoint_auth_method = none`. No client
secret is sent — PKCE protects the code exchange.

### 3. Environment

```bash
cp .env.local.example .env.local
```

Adjust `EXPO_PUBLIC_STAGEHOLDER_ISSUER_URL` for your platform (the example file
has notes for Simulator / emulator / real device).

## Install + run

From the repo root:

```bash
bun install
```

From this directory:

```bash
bun run start
```

Then press `i` (iOS Simulator) or `a` (Android emulator). Real devices on the
same Wi-Fi need the issuer URL set to your dev machine's LAN IP.

## Adding product screens

```tsx
// app/(authed)/dashboard.tsx
import { useFeature, useUser } from "@stageholder/sdk/react-native";

export default function Dashboard() {
  const { user } = useUser();
  const hasAdvancedExport = useFeature("advanced_export");
  // ...build product UI here
}
```

That's it — auth state, token refresh, claims, and gating are already on the
context. The route is automatically gated via `(authed)/_layout.tsx`.

## Renaming / re-using

If you fork this app for another product:

| File              | What to change                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| `package.json`    | `name`                                                                                                              |
| `app.json`        | `name`, `slug`, `scheme`, iOS `bundleIdentifier`, Android `package`, intent filter scheme, FaceID usage description |
| `app/_layout.tsx` | `productSlug`, `scheme`, `audience` in StageholderProvider config                                                   |
| `.env.local`      | `EXPO_PUBLIC_STAGEHOLDER_CLIENT_ID`                                                                                 |
| Hub DB            | new `oidc_clients` row with the new `client_id`, `redirect_uris`, and `audience`                                    |

## Troubleshooting

- **"redirect_uri did not match"**: the URI Expo generates (shown on Hub's
  error page) isn't registered. Add it to the `redirect_uris` array in the
  oidc_clients row.
- **"no client authentication mechanism provided"**: the client row's
  `token_endpoint_auth_method` isn't `none`. Set it via admin UI or SQL.
- **Metro hangs / "Could not connect to development server"**: kill any old
  Metro on port 8081 (`lsof -ti:8081 | xargs kill -9`), erase the iOS
  Simulator (Device → Erase All Content and Settings), restart `bun run ios`.
- **"Property 'crypto' doesn't exist"**: SDK below alpha.43. Bump
  `@stageholder/sdk` to ≥ `1.0.0-alpha.43`.
