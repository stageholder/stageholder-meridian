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
  IconButton,
  Paragraph,
  ScrollView,
  Spinner,
  Text,
  View,
  XStack,
  YStack,
  useToast,
} from "@stageholder/ui";
import {
  useStageholder,
  useSubscription,
  useUser,
} from "@stageholder/sdk/react-native";
import { ChevronLeft } from "@tamagui/lucide-icons-2";
import { useRouter } from "expo-router";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { openURL } from "@repo/core/platform/linking";
import { BOTTOM_NAV_CLEARANCE } from "@/components/mobile-bottom-nav";
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
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { user } = useUser();
  const { refreshSession } = useStageholder();

  const enabled = iapEnabled();
  // §4 prevention: if the active plan is a PAID web (Polar) subscription,
  // buying in-app would create a SECOND subscription across two billers for the
  // same product. Block the purchase UI and point to web management instead.
  // The auto-provisioned free tier is also an `active` "polar" claim, so it
  // MUST be excluded (`!isFreeTier`) — a free user is exactly who we want to
  // sell to. Default provider to "polar" when absent (older Hub tokens).
  const sub = useSubscription();
  const polarManaged =
    !!sub &&
    !sub.isFreeTier &&
    (sub.provider ?? "polar") === "polar" &&
    (sub.status === "active" || sub.status === "trialing");
  const [packages, setPackages] = useState<IapPackage[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

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
    setBusyId(pkg.identifier);
    try {
      const bought = await purchase(pkg);
      if (!bought) return; // user cancelled — no noise
      // Entitlement flows store → RevenueCat webhook → Hub → session claim.
      // Poll the session a few times (detached) so the new plan lands as the
      // webhook arrives without the user refreshing; the toast covers the lag.
      void reconcileEntitlement(refreshSession);
      toast.show({
        title: "Purchase complete",
        message: "Your plan is activating — this can take a moment.",
        intent: "success",
      });
      router.navigate("/billing");
    } catch {
      toast.show({ title: "Purchase failed", intent: "danger" });
    } finally {
      setBusyId(null);
    }
  }

  async function handleRestore() {
    setRestoring(true);
    try {
      await restorePurchases();
      void reconcileEntitlement(refreshSession);
      toast.show({ title: "Purchases restored", intent: "success" });
    } catch {
      toast.show({ title: "Nothing to restore", intent: "info" });
    } finally {
      setRestoring(false);
    }
  }

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <XStack items="center" px="$2" py="$2" position="relative">
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Back to billing"
            onPress={() => router.navigate("/billing")}
          >
            <ChevronLeft size={20} />
          </IconButton>
          <Text
            position="absolute"
            l={0}
            r={0}
            text="center"
            pointerEvents="none"
            fontSize="$5"
            fontWeight="600"
            color="$color"
          >
            Upgrade
          </Text>
        </XStack>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            pb: BOTTOM_NAV_CLEARANCE + insets.bottom,
          }}
        >
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

                <Button
                  intent="ghost"
                  loading={restoring}
                  loadingText="Restoring…"
                  onPress={() => void handleRestore()}
                >
                  Restore purchases
                </Button>

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
          </YStack>
        </ScrollView>
      </SafeAreaView>
    </YStack>
  );
}
