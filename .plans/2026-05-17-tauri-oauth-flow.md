# Meridian Desktop OAuth Flow — Implementation Brief

> **Status:** Pending. Discovered 2026-05-17 after migrating Meridian onto `@stageholder/sdk@^1.0.0-alpha.46`. The migration didn't cause this — desktop sign-in was never end-to-end wired.

## Symptom

Opening the desktop app cold lands on `/auth/login`, which calls `useSignIn()` from `@stageholder/sdk/spa`. The SDK redirects the webview to the Hub's OIDC URL. The Hub authenticates and redirects back to `http://localhost:14001/auth/callback?code=...&state=...&iss=...`. The webview tries to load that URL — **nothing is listening on port 14001** — and the console shows:

```
Failed to load resource: Could not connect to the server. (callback, line 0)
```

## Root cause

The Tauri Rust core (`apps/desktop/src-tauri/src/lib.rs:37`) registers `tauri_plugin_oauth::init()` correctly, and `apps/pwa/src/lib/spa-config.ts:23` configures `redirectUri = "http://localhost:14001/auth/callback"` for Tauri mode. But **nothing on the JS side ever invokes the plugin to spawn the loopback server**, and **nothing opens the OIDC URL in the system browser** instead of the webview. So the sign-in flow tries to authenticate inside the embedded webview (which federated IdPs like Google reject anyway) and the callback has nowhere to land.

## What needs to be built

A Tauri-specific sign-in flow in `apps/pwa/src/lib/` (e.g. `tauri-auth.ts`), plus a branch in `apps/pwa/src/routes/_auth/auth.login.tsx` so web keeps using SDK's `useSignIn()` while desktop uses the new helper.

The helper must:

1. **Start the loopback server** before the user is sent to the IdP:

   ```ts
   import { invoke } from "@tauri-apps/api/core";
   const port = await invoke<number>("plugin:oauth|start", {
     config: { ports: [14001] },
   });
   ```

   Pin port 14001 specifically (it's already registered as a redirect URI on the `meridian-web` OIDC client at the Hub).

2. **Subscribe to the `oauth://url` Tauri event** before opening the browser:

   ```ts
   import { listen, type UnlistenFn } from "@tauri-apps/api/event";
   const unlisten: UnlistenFn = await listen<string>("oauth://url", (event) => {
     const url = new URL(event.payload);
     // url is e.g. http://localhost:14001/auth/callback?code=...&state=...&iss=...
     // Navigate the webview to the React route so useHandleCallback runs
     window.location.assign(url.pathname + url.search);
     unlisten();
     // Optional: invoke('plugin:oauth|cancel') to release the port if it
     // doesn't auto-close after first callback.
   });
   ```

3. **Build the OIDC authorize URL** without redirecting the webview. The SDK's `useSignIn()` does this but immediately redirects — for Tauri we need the URL string and don't want the redirect. Two options:
   - Reach into SDK internals (find the URL builder it uses; might be exported as a helper).
   - Build it locally: `${issuerUrl}/oidc/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid+profile+email+offline_access&state=${state}&code_challenge=${challenge}&code_challenge_method=S256&nonce=${nonce}`. Requires PKCE verifier/challenge generation + state/nonce — the SDK exports `createPkcePair` from `/core` and you can self-generate state/nonce via Web Crypto.

   Whichever path: persist the PKCE verifier in the same storage adapter the SDK uses (`createTauriStoreStorage` already wired in `spa-config.ts`) under a key the SDK's `useHandleCallback` recognizes, OR build a parallel state-tracking system. **The first path is cleaner — check SDK source at `/Users/garda_dafi/Project/stageholder-identity/packages/sdk/src/spa/` for the existing key namespace before deciding.**

4. **Open the system browser** (not the webview) to the OIDC URL:

   ```ts
   import { openUrl } from "@tauri-apps/plugin-opener";
   await openUrl(authUrl);
   ```

   `@tauri-apps/plugin-opener` is already registered in `lib.rs:34`. Add to `apps/pwa/package.json` if not already a dependency.

5. **Single-instance handling** already works — `lib.rs:12` has `tauri_plugin_single_instance::init` that focuses the existing window on second-launch, so the system browser deep-linking back doesn't open a new instance.

## Reference implementation

Atlas (`/Users/garda_dafi/Project/stageholder-atlas/apps/desktop/src-tauri/src/auth/`) has the same end-to-end flow working, but Atlas does the loopback in **custom Rust** (not via `tauri-plugin-oauth`). Meridian's Cargo already pulls `tauri-plugin-oauth = "2"`, so stick with the plugin — less custom Rust to maintain. The JS orchestration is the same shape either way: start server → listen → open browser → catch event → navigate webview.

## Constraints

- **OIDC client `meridian-web` at the Hub** must already have `http://localhost:14001/auth/callback` and `http://localhost:14001/goodbye` in its registered `redirect_uris`. If not, the Hub will 400 on `redirect_uri_mismatch`. Verify against `apps/api/src/database/schema.ts` `oidc_clients` table or via the Hub admin UI.
- **The Tauri webview must not navigate to the OIDC URL itself** — if it does, the IdP login screen renders inside the app's webview, which is what we're trying to avoid (security, plus federated IdPs refuse it). The new helper must NEVER call `window.location.assign(authUrl)` for the auth URL.
- **PKCE verifier storage must be compatible with SDK's `useHandleCallback`** so the callback page's existing logic still runs cleanly.

## Don't change

- `apps/desktop/src-tauri/src/lib.rs` — plugins already wired correctly
- `apps/pwa/src/lib/spa-config.ts` — loopback redirect URI is correct
- `apps/pwa/src/routes/_auth/auth.callback.tsx` — the React callback handler is fine; it just needs to receive the navigation from the new helper

## Suggested implementation order

1. Read the SDK source at `/Users/garda_dafi/Project/stageholder-identity/packages/sdk/src/spa/` and find: PKCE storage keys, the `signIn` internals, whether there's an exported `buildAuthorizeUrl` helper. This tells you which of the two paths in Step 3 to take.
2. Write `apps/pwa/src/lib/tauri-auth.ts` exporting a `tauriSignIn(opts: { returnTo?: string }): Promise<void>` function.
3. Branch `apps/pwa/src/routes/_auth/auth.login.tsx` on `isTauri()` from `@stageholder/sdk/tauri` — if Tauri, use the new helper; else use SDK's `useSignIn` unchanged.
4. Manual smoke: `bun --filter=desktop run tauri dev`, click sign-in, verify system browser opens, complete login, verify webview gets the callback and lands authenticated.

## After this lands

Consider whether to upstream this orchestration into the SDK as a `@stageholder/sdk/tauri/auth` helper so Atlas/Almanac don't each have to build it. The user's standing position is **don't** upstream until a third desktop product needs it — keep it product-side for now. See `/Users/garda_dafi/Project/stageholder-identity/docs/superpowers/plans/2026-05-16-sdk-tauri-storage-helper.md` for the Tauri Phase-1 scope decision.
