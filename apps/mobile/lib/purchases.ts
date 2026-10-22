// apps/mobile/lib/purchases.ts
//
// Native in-app purchases (App Store / Play Billing) via RevenueCat —
// FEATURE-FLAGGED scaffold for store distribution. See
// docs/iap-hub-contract.md for the full architecture (Hub ingests
// RevenueCat webhooks as a second billing provider next to Polar; the
// apps keep reading entitlements from the SDK's `useSubscription` claim).
//
// FLAG: IAP is on only when the platform's RevenueCat public API key env
// is set (EXPO_PUBLIC_REVENUECAT_IOS_KEY / EXPO_PUBLIC_REVENUECAT_ANDROID_KEY).
// Until then every entry point no-ops and the billing screen keeps the
// web (Polar portal) flow.
//
// LAZY require: `react-native-purchases` is a native TurboModule. The dep
// is declared in package.json, but current dev builds were prebuilt
// WITHOUT its pod — a static import would evaluate the module (and touch
// the missing native binding) on app boot. Requiring inside the gated
// functions means builds without the pod never evaluate it; after the
// next `expo prebuild --clean` + build it lights up.
//
// app_user_id = the Hub user UUID (`sub`) — RevenueCat events then arrive
// at the Hub webhook already keyed to our identity (no alias dance).

import { Platform } from "react-native";

import { openURL } from "@repo/core/platform/linking";

/** Minimal structural slice of RevenueCat's types — local so importing
 *  this module never pulls the real package at type-eval time. */
export interface IapPackage {
  identifier: string;
  packageType: string;
  product: {
    identifier: string;
    title: string;
    description: string;
    priceString: string;
    /** e.g. "P1M" / "P1Y" — ISO-8601 period when the store provides it. */
    subscriptionPeriod?: string | null;
  };
}

export interface IapOffering {
  identifier: string;
  availablePackages: IapPackage[];
}

// A `test_…` (RevenueCat Test Store) key in a Release build crashes the
// native SDK on configure() by design. That is a CONFIG error, caught at
// build time by scripts/check-revenuecat-env.mjs (EAS pre-install hook) — not
// masked here. Test Store keys belong only to dev-client (Debug) builds.
function apiKey(): string | undefined {
  return Platform.OS === "ios"
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
    : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
}

/** Native store billing available on this build? (key present for this
 *  platform — the single feature flag the UI branches on.) */
export function iapEnabled(): boolean {
  return Boolean(apiKey());
}

// react-native-purchases' default export (the Purchases singleton). Typed
// loosely on purpose — the real types come with the package; this module
// is the only place that touches them pre-activation.
/* eslint-disable @typescript-eslint/no-explicit-any */
let purchasesModule: any | null = null;
let configuredFor: string | null = null;

function loadPurchases(): any {
  if (!purchasesModule) {
    // Lazy native require — see file header.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    purchasesModule = require("react-native-purchases").default;
  }
  return purchasesModule;
}

/**
 * Idempotent SDK init, keyed to the signed-in Hub user. Call before any
 * other purchases call (the paywall screen does, on mount). Re-running
 * with the same `sub` is a no-op; a different `sub` re-configures (sign
 * out → sign in as someone else).
 */
export async function configurePurchases(sub: string): Promise<void> {
  if (!iapEnabled()) return;
  if (configuredFor === sub) return;
  const Purchases = loadPurchases();
  Purchases.configure({ apiKey: apiKey()!, appUserID: sub });
  configuredFor = sub;
}

/**
 * Reset RevenueCat identity on sign-out. RevenueCat keys purchases and restores
 * to the configured `appUserID` (the Hub user UUID); without resetting, the
 * NEXT user signing in on the same device would inherit the previous user's
 * RevenueCat identity (cross-account purchase/restore attribution). `logOut()`
 * returns the SDK to an anonymous id. No-op when IAP is off or was never
 * configured this session.
 */
export async function logOutPurchases(): Promise<void> {
  if (!iapEnabled()) return;
  if (!configuredFor) return;
  const Purchases = loadPurchases();
  try {
    await Purchases.logOut();
  } catch {
    // logOut throws if the current id is already anonymous — benign here; all
    // we need is the previous user's identity cleared.
  }
  configuredFor = null;
}

/** Current offering's packages (the paywall's plan list), [] when none. */
export async function getCurrentOfferingPackages(): Promise<IapPackage[]> {
  if (!iapEnabled()) return [];
  const Purchases = loadPurchases();
  const offerings = await Purchases.getOfferings();
  const current: IapOffering | null = offerings.current ?? null;
  return current?.availablePackages ?? [];
}

/**
 * Run a purchase. Resolves `true` on success, `false` on user cancel;
 * throws on real errors. Entitlement becomes authoritative only once the
 * RevenueCat webhook lands in the Hub and the session refreshes — callers
 * refresh the session and message "activating…" rather than flipping UI
 * state locally.
 */
export async function purchase(pkg: IapPackage): Promise<boolean> {
  const Purchases = loadPurchases();
  try {
    await Purchases.purchasePackage(pkg);
    return true;
  } catch (err) {
    if ((err as { userCancelled?: boolean }).userCancelled) return false;
    throw err;
  }
}

/**
 * Reconcile the entitlement after a purchase/restore. The new plan only
 * becomes authoritative once the store → RevenueCat → Hub webhook lands and
 * the session is refreshed — which lags the on-device purchase by seconds.
 * Re-pull the session a few times with backoff so the new claim appears
 * without the user manually refreshing. Best-effort and fire-and-forget:
 * runs detached from any screen (each `refresh()` updates the SDK claim, so
 * whatever billing surface is mounted re-renders when it lands).
 */
export async function reconcileEntitlement(
  refresh: () => Promise<void>,
): Promise<void> {
  const delaysMs = [1500, 3000, 5000, 8000];
  await refresh().catch(() => {});
  for (const d of delaysMs) {
    await new Promise((resolve) => setTimeout(resolve, d));
    await refresh().catch(() => {});
  }
}

/** Restore previous purchases (Apple requires this affordance). */
/** Restore store purchases. Resolves `true` only when the store returned at
 *  least one ACTIVE entitlement — "restored" must not be claimed when the
 *  account simply had nothing to restore. */
export async function restorePurchases(): Promise<boolean> {
  const Purchases = loadPurchases();
  const info = (await Purchases.restorePurchases()) as
    | { entitlements?: { active?: Record<string, unknown> } }
    | undefined;
  return Object.keys(info?.entitlements?.active ?? {}).length > 0;
}

/**
 * OS-level subscription management — where STORE-billed subs are
 * cancelled / changed (the Polar portal can't touch them). Returns the
 * platform deep link; callers hand it to `openURL`.
 *
 * Both stores: iOS → App Store account subscriptions; Android → Google Play
 * account subscriptions.
 */
export function storeManagementUrl(): string {
  return Platform.OS === "ios"
    ? "https://apps.apple.com/account/subscriptions"
    : "https://play.google.com/store/account/subscriptions";
}

/**
 * Open subscription management for a STORE-billed plan the way the platforms
 * intend: StoreKit's in-app manage-subscriptions sheet on iOS 15+ (Play's
 * subscription screen on Android) via the RevenueCat SDK, so the user
 * cancels / changes the plan without leaving the app. Falls back to the
 * store's web management page when the SDK has no key, isn't configured, or
 * the sheet can't be presented (older iOS, simulator without StoreKit).
 */
export async function openStoreSubscriptions(
  sub: string | undefined,
): Promise<void> {
  if (iapEnabled() && sub) {
    try {
      await configurePurchases(sub);
      await loadPurchases().showManageSubscriptions();
      return;
    } catch {
      // Fall through to the web management page.
    }
  }
  openURL(storeManagementUrl());
}

// Legal links required on the paywall for auto-renewable subscriptions.
// Apple guideline 3.1.2 requires functional Terms of Use (EULA) AND Privacy
// Policy links on any screen offering subscriptions; Google Play likewise
// expects an accessible privacy policy. Shown on the paywall footer.
//
// These point at the Stageholder Hub's legal pages: they are the suite-wide
// terms/privacy (they name Meridian explicitly) and they are LIVE. The
// Meridian web app has no /legal routes of its own, so a product-domain URL
// would 404 during App Review.
export const TERMS_OF_USE_URL = "https://hub.stageholder.com/legal/terms";
export const PRIVACY_POLICY_URL = "https://hub.stageholder.com/legal/privacy";
