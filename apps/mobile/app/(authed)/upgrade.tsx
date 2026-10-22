// apps/mobile/app/(authed)/upgrade.tsx
//
// Native paywall — the store-distribution counterpart of the PWA's
// /settings/billing/upgrade. Plans come from the store via RevenueCat
// offerings (price strings are the STORE's localized prices — App Store /
// Play are the merchant of record for these subs, not Polar), purchases run
// through StoreKit / Play Billing, and the entitlement becomes authoritative
// when the RevenueCat webhook lands in the Hub (docs/iap-hub-contract.md).
//
// Until the RevenueCat keys exist in env (developer-program registration in
// progress), `iapEnabled()` is false and this screen renders a friendly
// placeholder — safe to ship in dev builds that don't carry the native pod.
//
// Apple review notes baked in: a Restore Purchases affordance (required),
// auto-renewal disclosure copy, and no links to external payment from this
// screen.

import { useCallback, useEffect, useState } from "react";
import {
  Banner,
  Button,
  Card,
  Paragraph,
  ScrollView,
  Spinner,
  Text,
  View,
  XStack,
  YStack,
  toast,
} from "@stageholder/ui";
import {
  useStageholder,
  useSubscription,
  useUser,
} from "@stageholder/sdk/react-native";
import { Stack, useRouter } from "expo-router";

import { openURL } from "@repo/core/platform/linking";
import { ScreenScroll } from "@/components/screen-scroll";
import { PlanComparison } from "@/components/plan-comparison";
import { useHubPricing } from "@/lib/api/hub";
import {
  configurePurchases,
  getCurrentOfferingPackages,
  iapEnabled,
  PRIVACY_POLICY_URL,
  purchase,
  reconcileEntitlement,
  restorePurchases,
  TERMS_OF_USE_URL,
  type IapPackage,
} from "@/lib/purchases";

/** Human label for a package's billing period. */
function periodLabel(pkg: IapPackage): string {
  switch (pkg.packageType) {
    case "ANNUAL":
      return "per year";
    case "MONTHLY":
      return "per month";
    case "WEEKLY":
      return "per week";
    case "LIFETIME":
      return "one time";
    default:
      return "";
  }
}

export default function UpgradeScreen() {
  const router = useRouter();
  const { user } = useUser();
  const { refreshSession } = useStageholder();

  const enabled = iapEnabled();
  // §4 prevention: if the active plan is a PAID web (Polar) subscription,
  // buying in-app would create a SECOND subscription across two billers for the
  // same product. Block the purchase UI and point to web management instead.
  // The auto-provisioned free tier is also an `active` "polar" claim, so it
  // MUST be excluded (`!isFreeTier`) — a free user is exactly who we want to
  // sell to. Default provider to "polar" when absent (older Hub tokens).
  //
  // Gate on ENTITLEMENT-LIVE, not an `active|trialing` allowlist: `past_due` is
  // the dunning/grace window where the web sub is STILL entitled — a user there
  // buying IAP would double-bill across two billers, the exact §4 hazard. The
  // ended states (`canceled`/`expired`) are correctly excluded so a lapsed user
  // CAN re-subscribe in-app (Polar marks "cancel at period end" as `active`, so
  // a still-in-period cancel is caught by `active`, not `canceled`).
  const sub = useSubscription();
  const ENTITLEMENT_LIVE: ReadonlyArray<NonNullable<typeof sub>["status"]> = [
    "active",
    "trialing",
    "past_due",
  ];
  const polarManaged =
    !!sub &&
    !sub.isFreeTier &&
    (sub.provider ?? "polar") === "polar" &&
    ENTITLEMENT_LIVE.includes(sub.status);
  const [packages, setPackages] = useState<IapPackage[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  // Outcome feedback stays INLINE on this screen: it is presented as a native
  // modal and the app's single <Toaster/> sits in the root layout underneath
  // it, so a toast fired while the paywall is up is never seen. Only the
  // paths that dismiss the paywall (purchase / restore success) toast.
  const [notice, setNotice] = useState<{
    intent: "danger" | "info";
    title: string;
    description: string;
  } | null>(null);

  // Hub pricing catalog — feeds the feature-comparison section only (plan
  // LIMITS are Hub truth regardless of biller). Purchasable prices above it
  // stay the store's. Rendered whenever the catalog loads, including the
  // pre-store (`!enabled`) and web-billed states — it's informational either
  // way and quietly absent on fetch failure.
  const pricingQuery = useHubPricing();

  const load = useCallback(async () => {
    if (!enabled || !user?.sub) return;
    setLoadError(false);
    try {
      await configurePurchases(user.sub);
      setPackages(await getCurrentOfferingPackages());
    } catch {
      setLoadError(true);
    }
  }, [enabled, user?.sub]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handlePurchase(pkg: IapPackage) {
    setNotice(null);
    setBusyId(pkg.identifier);
    try {
      const bought = await purchase(pkg);
      if (!bought) return; // user cancelled — nothing to report
      // Entitlement flows store → RevenueCat webhook → Hub → session claim.
      // Poll the session a few times (detached) so the new plan lands as the
      // webhook arrives without the user refreshing; the toast covers the lag.
      void reconcileEntitlement(refreshSession);
      toast.success("Purchase complete", {
        description: "Your plan is activating — this can take a moment.",
      });
      // Dismiss the paywall back to wherever it was opened from.
      if (router.canGoBack()) router.back();
      else router.replace("/billing");
    } catch {
      setNotice({
        intent: "danger",
        title: "Purchase failed",
        description:
          "The store didn't complete the purchase and you weren't charged. Try again.",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleRestore() {
    setNotice(null);
    setRestoring(true);
    try {
      const restored = await restorePurchases();
      if (restored) {
        void reconcileEntitlement(refreshSession);
        toast.success("Purchases restored", {
          description: "Your plan is activating — this can take a moment.",
        });
        if (router.canGoBack()) router.back();
        else router.replace("/billing");
      } else {
        setNotice({
          intent: "info",
          title: "No purchases to restore",
          description: "This store account has no active Meridian plan.",
        });
      }
    } catch {
      setNotice({
        intent: "danger",
        title: "Couldn't reach the store",
        description: "Check your connection and try again.",
      });
    } finally {
      setRestoring(false);
    }
  }

  return (
    <YStack flex={1} bg="$background">
      {/* Modal sheet: swipe down OR this button dismisses it. */}
      <Stack.Screen
        options={{
          headerRight: () => (
            <Button
              intent="ghost"
              size="sm"
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/")
              }
            >
              Close
            </Button>
          ),
        }}
      />

      <ScreenScroll stackScreen showsVerticalScrollIndicator={false}>
        <YStack gap="$5" px="$4" pt="$2" pb="$10">
          <YStack gap="$1">
            <Text
              fontFamily="$mono"
              fontSize={11}
              textTransform="uppercase"
              letterSpacing={3.5}
              color="$mutedForeground"
            >
              Plans
            </Text>
            <Text fontSize="$8" fontWeight="700" color="$color">
              Choose your plan
            </Text>
            <Paragraph fontSize="$3" color="$mutedForeground">
              Billed through your app store account.
            </Paragraph>
          </YStack>

          {notice ? (
            <Banner intent={notice.intent}>
              <Banner.Body>
                <Banner.Title>{notice.title}</Banner.Title>
                <Banner.Description>{notice.description}</Banner.Description>
              </Banner.Body>
            </Banner>
          ) : null}

          {polarManaged ? (
            // Active plan is web-billed (Polar) — don't sell a second,
            // store-billed subscription on top of it (contract §4).
            <Banner intent="info">
              <Banner.Body>
                <Banner.Title>Your plan is managed on the web</Banner.Title>
                <Banner.Description>
                  Your current subscription is billed through the Meridian web
                  app. Manage or change it there — buying here would start a
                  separate in-app subscription.
                </Banner.Description>
              </Banner.Body>
            </Banner>
          ) : !enabled ? (
            // Pre-store-launch builds: keys not configured yet.
            <Banner intent="info">
              <Banner.Body>
                <Banner.Title>Purchases aren&apos;t live yet</Banner.Title>
                <Banner.Description>
                  In-app upgrades arrive with the store release. Until then,
                  plans can be managed from the web app.
                </Banner.Description>
              </Banner.Body>
            </Banner>
          ) : loadError ? (
            <Banner intent="danger">
              <Banner.Body>
                <Banner.Title>Couldn&apos;t load plans</Banner.Title>
                <Banner.Description>
                  The store didn&apos;t return any offerings. Check your
                  connection and try again.
                </Banner.Description>
                <Banner.Action self="flex-end" mt="$2">
                  <Button
                    intent="secondary"
                    size="sm"
                    onPress={() => void load()}
                  >
                    Try again
                  </Button>
                </Banner.Action>
              </Banner.Body>
            </Banner>
          ) : packages === null ? (
            <View py="$8" items="center">
              <Spinner size="large" />
            </View>
          ) : packages.length === 0 ? (
            <Paragraph fontSize="$3" color="$mutedForeground">
              No plans are available right now.
            </Paragraph>
          ) : (
            <YStack gap="$3">
              {packages.map((pkg) => (
                <Card key={pkg.identifier}>
                  <Card.Body gap="$2">
                    <Text fontSize="$5" fontWeight="600" color="$color">
                      {pkg.product.title}
                    </Text>
                    {pkg.product.description ? (
                      <Paragraph fontSize="$3" color="$mutedForeground">
                        {pkg.product.description}
                      </Paragraph>
                    ) : null}
                    <XStack items="baseline" gap="$2">
                      <Text fontSize="$7" fontWeight="700" color="$color">
                        {pkg.product.priceString}
                      </Text>
                      <Text fontSize="$2" color="$mutedForeground">
                        {periodLabel(pkg)}
                      </Text>
                    </XStack>
                    <Button
                      intent="primary"
                      mt="$2"
                      loading={busyId === pkg.identifier}
                      loadingText="Purchasing…"
                      disabled={busyId !== null}
                      onPress={() => void handlePurchase(pkg)}
                    >
                      Continue
                    </Button>
                  </Card.Body>
                </Card>
              ))}

              {/* Apple-required auto-renew disclosure. */}
              <Paragraph fontSize="$1" color="$mutedForeground">
                Subscriptions renew automatically unless cancelled at least 24
                hours before the end of the current period. Manage or cancel
                anytime in your app store account settings.
              </Paragraph>

              {/* Required legal links (App Store guideline 3.1.2 + Play). */}
              <XStack gap="$4" mt="$1">
                <Text
                  fontSize="$1"
                  color="$mutedForeground"
                  textDecorationLine="underline"
                  onPress={() => openURL(TERMS_OF_USE_URL)}
                >
                  Terms of Use
                </Text>
                <Text
                  fontSize="$1"
                  color="$mutedForeground"
                  textDecorationLine="underline"
                  onPress={() => openURL(PRIVACY_POLICY_URL)}
                >
                  Privacy Policy
                </Text>
              </XStack>
            </YStack>
          )}

          {/* Restore is reachable whenever store purchases are live — not
                only once offerings load: a reinstalling subscriber whose
                offerings fetch failed must still be able to restore
                (App Review 3.1.1). */}
          {enabled && !polarManaged ? (
            <Button
              intent="ghost"
              loading={restoring}
              loadingText="Restoring…"
              onPress={() => void handleRestore()}
            >
              Restore purchases
            </Button>
          ) : null}

          {/* ---- Feature comparison (PWA ComparisonSheet parity) ---- */}
          {pricingQuery.data ? (
            <View mt="$4">
              <PlanComparison
                plans={pricingQuery.data.plans}
                features={pricingQuery.data.features}
              />
            </View>
          ) : null}
        </YStack>
      </ScreenScroll>
    </YStack>
  );
}
