# Native IAP × Stageholder Hub — integration contract

Spec for adding **App Store / Play Billing subscriptions** (via RevenueCat)
as a second billing provider next to Polar. The mobile client half is
already scaffolded in this repo (`apps/mobile/lib/purchases.ts`,
`app/(authed)/upgrade.tsx`, provider branching in `app/(authed)/billing.tsx`);
this document is the work order for the **stageholder-hub** side plus the
operational setup.

Principle: the Hub stays the single entitlement source of truth. Apps keep
reading `useSubscription` claims; nothing entitlement-related lives in the
mobile client.

## 1. Flow

```
StoreKit / Play Billing ──► RevenueCat ──► POST hub /api/billing/revenuecat-webhook
                                                  │
                                   upsert subscription (provider: app_store|play)
                                                  │
                              token claims (subscriptions[]) ◄── session refresh
                                                  │
                              meridian apps: useSubscription (unchanged)
```

- Mobile configures RevenueCat with `appUserID = sub` (Hub user UUID), so
  webhook events arrive keyed to our identity — no alias resolution.
- After purchase the client calls `refreshSession()`; until the webhook has
  landed the UI says "activating…" rather than flipping state locally.

## 2. Hub: webhook endpoint

`POST /api/billing/revenuecat-webhook`

- Auth: RevenueCat's `Authorization` header secret (configured in the RC
  dashboard), constant-time compare.
- Events to handle: `INITIAL_PURCHASE`, `RENEWAL`, `PRODUCT_CHANGE`,
  `CANCELLATION` (sets `cancelAtPeriodEnd`), `UNCANCELLATION`, `EXPIRATION`,
  `BILLING_ISSUE` (→ `past_due`). Ignore the rest idempotently.
- Mapping: `event.app_user_id` → user → that user's **personal org** (store
  subs are per-Apple/Google account; they cannot be seat-based team subs —
  see §6). `event.product_id` → plan slug via a `store_products` table
  (`product_id`, `platform`, `plan`, `product` columns).
- Upsert into the existing subscriptions model with `provider`:
  `"app_store" | "play"` (Polar rows get `provider: "polar"` in the same
  migration). Store `currentPeriodEnd = event.expiration_at_ms`,
  `trialEndsAt` from `period_type === "TRIAL"`.

## 3. Hub: claim changes

`SubscriptionClaim` gains one field:

```ts
/** Which biller owns this subscription. Drives the manage-UI branch. */
provider: "polar" | "app_store" | "play";
```

SDK type bump + meridian mobile then replaces its `iapEnabled()` branch in
`billing.tsx` with a real per-sub branch (`provider === "polar"` → portal,
else → OS subscription settings). Marked `TODO(provider)` in code.

## 4. Entitlement merge rule

A user could hold a Polar sub AND a store sub for the same product/org pair.

- **Resolution: most-entitled wins** (higher plan tier; tie → latest
  `currentPeriodEnd`). One claim per (org, product) pair in the token, as
  today.
- **Prevention (the real fix):**
  - Paywall (`upgrade.tsx`) should hide/disable purchase when the active
    claim's `provider === "polar"` and status is active — show "your plan is
    managed on the web" instead. (Client TODO once `provider` ships.)
  - Web upgrade page: when the active claim is store-billed, point to the
    phone's subscription settings instead of Polar checkout.

## 5. Operational setup (blocked on developer-program registration)

### 5.0 Canonical product catalog (authoritative — all three layers must match)

This is the single source of truth for store product IDs. The **same**
identifiers must be used in (a) App Store Connect + Play Console, (b) the
RevenueCat "default" Offering packages, and (c) the Hub `store_products`
mapping table (§2). Meridian sells one fixed-price paid plan
(`meridian-unlimited`, product slug `meridian`) on a personal org — see §6.

| Store product ID             | Platform(s)      | Cycle   | → plan slug          | → product slug | RC package    |
| ---------------------------- | ---------------- | ------- | -------------------- | -------------- | ------------- |
| `meridian_unlimited_monthly` | app_store + play | monthly | `meridian-unlimited` | `meridian`     | `$rc_monthly` |
| `meridian_unlimited_yearly`  | app_store + play | yearly  | `meridian-unlimited` | `meridian`     | `$rc_annual`  |

Notes:

- **Use the identical product ID string on both stores.** Play Console
  subscription IDs and App Store Connect product IDs are independent
  namespaces, so reusing the string keeps the Hub mapping platform-agnostic
  (the `store_products` row still carries `platform`, but the ID matches).
- On Play, the subscription has a single base plan per cycle; name the base
  plan after the cycle (`monthly` / `yearly`) under the subscription ID above.
- Hub `store_products` seed rows (one per platform × product):
  - `(meridian_unlimited_monthly, app_store, meridian-unlimited, meridian)`
  - `(meridian_unlimited_monthly, play,      meridian-unlimited, meridian)`
  - `(meridian_unlimited_yearly,  app_store, meridian-unlimited, meridian)`
  - `(meridian_unlimited_yearly,  play,      meridian-unlimited, meridian)`
- The client never hardcodes these — RevenueCat's Offering drives the paywall
  list and `priceString`. This table exists so the store config, RC offering,
  and Hub mapping don't drift.

1. App Store Connect: create the app, a subscription group, and the products
   from §5.0 (`meridian_unlimited_monthly`, `meridian_unlimited_yearly`);
   enable the In-App Purchase capability; Paid Apps agreement + banking.
2. Play Console: app + subscription products using the **same** IDs as §5.0,
   each with a base plan per cycle.
3. RevenueCat: project + iOS/Android apps, attach store credentials
   (App Store Connect API key, Play service account), one Offering
   ("default") containing the packages; webhook → Hub endpoint (§2).
4. Meridian mobile env (`.env.local` / EAS secrets):
   - `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (public Apple API key, `appl_…`)
   - `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (public Google key, `goog_…`)
     These are PUBLIC client keys (safe to inline); their presence is the
     feature flag — no key, no IAP UI.
5. Rebuild natives: `bun install && expo prebuild --clean` + dev build
   (`react-native-purchases` adds a pod/gradle dep). Until then the lazy
   `require` in `lib/purchases.ts` keeps existing builds working.
6. Sandbox test: App Store sandbox tester / Play license tester, buy →
   verify webhook → claim within one refresh.

## 6. Decisions taken (revisit if product strategy changes)

- **Personal-org only**: store IAP maps to the buyer's personal org.
  Seat-based team plans stay web-billed (store billing has no notion of
  org seats). The paywall therefore only shows fixed-price plans.
- **Store is merchant of record for store subs** — prices are configured
  per-store (the 15–30% cut means store prices may differ from Polar's);
  the client always displays the store's localized `priceString`.
- **No external-purchase links on store builds** (guideline 3.1.1): the
  Polar portal button is hidden whenever `iapEnabled()` — revisit only if
  we deliberately adopt the US external-link entitlement.

## 7. Out of scope (this pass)

- Promo codes / offer codes, win-back offers.
- Grace-period UI beyond the existing `past_due` badge.
- Upgrade/downgrade proration UX (stores handle proration themselves).
