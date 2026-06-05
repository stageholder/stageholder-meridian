# @meridian/mobile

Expo (SDK 54) app for Meridian, with auth + token lifecycle handled entirely by
`@stageholder/sdk/react-native`. The app shell — root providers, theme, fonts,
sign-in, and the auth-gated tab bar — is done. Product screens live under
`app/(authed)/` (currently spinner placeholders awaiting their real UI).

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
  _layout.tsx          ← Root providers: GestureHandler → SafeArea → UIProvider
                          (themed light/dark via lib/platform/theme) → Haptic →
                          Toast → StageholderProvider → QueryProvider → <Stack>.
                          Holds the splash until fonts + theme hydrate.
  sign-in.tsx          ← Pre-auth landing (OIDC system-browser sign-in)
  (authed)/
    _layout.tsx        ← Auth gate + bottom <Tabs> (5 tabs, theme-tinted chrome)
    index.tsx          ← "Today"    (placeholder — real UI lands later)
    habits.tsx         ← "Habits"   (placeholder)
    todos.tsx          ← "Todos"    (placeholder)
    journal.tsx        ← "Journal"  (placeholder)
    settings.tsx       ← "Settings" (placeholder)
```

`(authed)/_layout.tsx` shows a spinner while the SDK session hydrates, redirects
to `/sign-in` for any unauthenticated request, and otherwise renders the tab
bar. Every screen under `(authed)/` is auth-gated automatically.

Theme: the app supports light/dark/system via `lib/platform/theme.ts` (a
`useSyncExternalStore` store persisted to AsyncStorage under the `theme` key,
mirroring the PWA's contract). The root layout awaits `initTheme()` alongside
font loading before hiding the splash, so there's no theme/font flash.

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
cp .env.example .env.local
```

`.env.example` documents all three `EXPO_PUBLIC_*` vars the app reads, with
per-platform host notes (Simulator / emulator / real device). At minimum,
adjust `EXPO_PUBLIC_STAGEHOLDER_ISSUER_URL` and `EXPO_PUBLIC_MERIDIAN_API_URL`
for your platform.

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

The five tab screens already exist as spinner placeholders under `(authed)/` —
replace a placeholder's body with real UI (don't add a new tab unless you also
register it in `(authed)/_layout.tsx`'s `<Tabs>`). Data comes from the hooks in
`lib/api` (TanStack Query) and auth/claims from the SDK:

```tsx
// app/(authed)/index.tsx — replace the placeholder body
import { useFeature, useUser } from "@stageholder/sdk/react-native";
import { useToday } from "@/lib/api";

export default function TodayScreen() {
  const { user } = useUser();
  const hasAdvancedExport = useFeature("advanced_export");
  const today = useToday();
  // ...build product UI here
}
```

Auth state, token refresh, claims, and gating are already on the context, and
every screen under `(authed)/` is auth-gated automatically.

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
