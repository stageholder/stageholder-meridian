// apps/mobile/app/(authed)/billing.tsx
//
// Plans & billing — native rendition of the PWA's billing dashboard
// (apps/pwa/src/routes/_app/settings/billing/index.tsx: CurrentPlanHero +
// InvoiceLedger). Same data, native presentation:
//
//   Current plan  — the SDK's `useSubscription` claim (planName, status,
//                   trial/renewal dates, seats) + `useOrg` for the member
//                   role. Null claim = Free plan (or enterprise = fully
//                   entitled, no plan card economics to show).
//   Manage        — Hub's Polar billing portal (payment method, invoices,
//                   cancel/change plan), opened in the system browser via
//                   the portal-session endpoint (lib/api/hub). Checkout for
//                   upgrades is a web flow on every platform — the portal
//                   covers plan management here.
//   Invoices      — Hub GET /api/billing/invoices/:orgId rendered as a
//                   simple ledger; each row fetches its hosted-invoice URL
//                   on demand and hands it to the system browser (the PWA's
//                   DownloadButton flow).
//
// Billing ops are owner/admin-gated by Hub (403 otherwise) — same
// `canManageBilling` role check as the SDK, with the PWA's explainer copy
// for plain members. Registered as a hidden tab (`href: null`); reached from
// the Profile sheet and Settings → Account.

import { useCallback, useState } from "react";
import {
  Badge,
  Banner,
  Button,
  Card,
  IconButton,
  Paragraph,
  ScrollView,
  Separator,
  Spinner,
  Text,
  View,
  XStack,
  YStack,
  useToast,
} from "@stageholder/ui";
import { openURL } from "@repo/core/platform/linking";
import {
  useEnterprise,
  useOrg,
  useStageholder,
  useSubscription,
} from "@stageholder/sdk/react-native";
import { ChevronLeft, Download, ExternalLink } from "@tamagui/lucide-icons-2";
import { useFocusEffect, useRouter } from "expo-router";
import { Platform } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { BOTTOM_NAV_CLEARANCE } from "@/components/mobile-bottom-nav";
import {
  canManageBilling,
  fetchInvoiceUrl,
  useBillingPortal,
  useInvoices,
  type HubInvoice,
} from "@/lib/api/hub";
import { iapEnabled, storeManagementUrl } from "@/lib/purchases";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Status → badge intent, matching the PWA hero's color semantics. */
function statusIntent(
  status: string,
): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "active":
      return "success";
    case "trialing":
      return "warning";
    case "past_due":
    case "canceled":
    case "expired":
      return "danger";
    default:
      return "neutral";
  }
}

export default function BillingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();

  const sub = useSubscription();
  const enterprise = useEnterprise();
  const { org, activeOrgId } = useOrg();
  const { refreshSession } = useStageholder();
  const canManage = canManageBilling(org?.role);

  // Re-pull the session whenever this screen regains focus — catches the
  // entitlement landing after a store purchase (the /upgrade poll + the
  // navigation here) or after an app background-return, so the plan card and
  // provider branch are never stale.
  useFocusEffect(
    useCallback(() => {
      void refreshSession().catch(() => {});
    }, [refreshSession]),
  );

  const invoicesQuery = useInvoices(canManage ? activeOrgId : undefined);
  const portal = useBillingPortal();

  // Which biller owns the active subscription (SDK `provider` claim). Drives
  // where plan management lives. Default to "polar" when absent (older Hub
  // tokens predate the field, and a missing provider means web-billed).
  const provider = sub?.provider ?? "polar";
  const storeBilled = provider === "app_store" || provider === "play";
  // Is this a store-distributed build (RevenueCat key present)? On store builds
  // we must not surface external payment links (App Store guideline 3.1.1).
  const storeBuild = iapEnabled();

  function openPortal() {
    if (!activeOrgId) return;
    portal.mutate(
      { orgId: activeOrgId },
      {
        onSuccess: ({ url }) => openURL(url),
        onError: () =>
          toast.show({
            title: "Couldn't open the billing portal",
            intent: "danger",
          }),
      },
    );
  }

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        {/* Header: back to settings · centered title (journal-editor chrome). */}
        <XStack items="center" px="$2" py="$2" position="relative">
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Back to settings"
            onPress={() => router.navigate("/settings")}
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
            Billing
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
                Billing
              </Text>
              <Text fontSize="$8" fontWeight="700" color="$color">
                Your subscription
              </Text>
              <Paragraph fontSize="$3" color="$mutedForeground">
                Manage your plan, payment method, and invoices.
              </Paragraph>
            </YStack>

            {/* ---- Current plan (the PWA hero, card-sized) ---- */}
            <Card>
              <Card.Body gap="$3">
                <Text
                  fontFamily="$mono"
                  fontSize={11}
                  textTransform="uppercase"
                  letterSpacing={2}
                  color="$mutedForeground"
                >
                  Current plan
                </Text>
                <XStack items="center" gap="$3" flexWrap="wrap">
                  <Text fontSize="$8" fontWeight="700" color="$color">
                    {enterprise ? "Enterprise" : (sub?.planName ?? "Free")}
                  </Text>
                  {sub ? (
                    <Badge intent={statusIntent(sub.status)}>
                      {/* Badge's frame is a View — on native, text must go
                          through the Badge.Label Text child. */}
                      <Badge.Label>
                        {sub.status === "past_due"
                          ? "Past due"
                          : sub.status.charAt(0).toUpperCase() +
                            sub.status.slice(1)}
                      </Badge.Label>
                    </Badge>
                  ) : null}
                </XStack>

                {/* Mono metadata rows — trial end, renewal/lapse, seats. */}
                {sub?.trialEndsAt ? (
                  <Text fontSize="$3" color="$mutedForeground">
                    Trial ends {formatDate(sub.trialEndsAt)}
                  </Text>
                ) : null}
                {sub?.currentPeriodEnd ? (
                  <Text fontSize="$3" color="$mutedForeground">
                    {sub.cancelAtPeriodEnd ? "Ends" : "Renews"}{" "}
                    {formatDate(sub.currentPeriodEnd)}
                  </Text>
                ) : null}
                {sub?.pricingModel === "seat_based" && sub.seats != null ? (
                  <Text fontSize="$3" color="$mutedForeground">
                    {sub.seats}
                    {sub.memberLimit != null
                      ? ` of ${sub.memberLimit}`
                      : ""}{" "}
                    seats
                  </Text>
                ) : null}
                {!sub && !enterprise ? (
                  <Paragraph fontSize="$3" color="$mutedForeground">
                    You&apos;re on the free plan.
                  </Paragraph>
                ) : null}

                {canManage && activeOrgId ? (
                  storeBilled ? (
                    // STORE-BILLED sub (provider app_store|play): bought via
                    // StoreKit / Play Billing. Payment, cancel, and plan
                    // changes live in the OS subscription settings — the Polar
                    // portal can't touch these. On a store build we also offer
                    // an in-app plan change through the store paywall.
                    <YStack gap="$2">
                      {storeBuild ? (
                        <Button
                          intent="primary"
                          onPress={() => router.push("/upgrade")}
                        >
                          Change plan
                        </Button>
                      ) : null}
                      <Button
                        intent={storeBuild ? "outline" : "primary"}
                        iconAfter={<ExternalLink size={14} opacity={0.7} />}
                        onPress={() => openURL(storeManagementUrl())}
                      >
                        Manage in{" "}
                        {Platform.OS === "ios" ? "App Store" : "Google Play"}
                      </Button>
                    </YStack>
                  ) : storeBuild ? (
                    // STORE BUILD, web-billed (Polar) or free plan. Guideline
                    // 3.1.1 forbids external payment links here, so the Polar
                    // portal button is hidden (contract §6). A free user (the
                    // auto-provisioned free tier is an active "polar" claim, so
                    // gate on !isFreeTier) can still upgrade in-app via the
                    // store paywall; a PAID web-billed user is told where their
                    // plan is managed.
                    sub && !sub.isFreeTier ? (
                      <Paragraph fontSize="$2" color="$mutedForeground">
                        This plan is billed on the web. Manage your payment
                        method and plan from the Meridian web app.
                      </Paragraph>
                    ) : (
                      <Button
                        intent="primary"
                        onPress={() => router.push("/upgrade")}
                      >
                        Upgrade plan
                      </Button>
                    )
                  ) : (
                    // NON-store build (dev / web-distributed): the Polar portal
                    // owns payment method, cancel, and plan changes.
                    <Button
                      intent="primary"
                      iconAfter={<ExternalLink size={14} opacity={0.7} />}
                      loading={portal.isPending}
                      loadingText="Opening…"
                      onPress={openPortal}
                    >
                      Manage plan & payment
                    </Button>
                  )
                ) : (
                  <Paragraph fontSize="$2" color="$mutedForeground">
                    Only an organization owner or admin can change billing.
                  </Paragraph>
                )}
              </Card.Body>
            </Card>

            {/* ---- Invoices (the PWA ledger) ---- */}
            <YStack gap="$2">
              <Text fontSize="$5" fontWeight="600" color="$color">
                Invoices
              </Text>

              {!canManage ? (
                <Paragraph fontSize="$3" color="$mutedForeground">
                  Invoices are visible to organization owners and admins.
                </Paragraph>
              ) : invoicesQuery.isLoading ? (
                <View py="$6" items="center">
                  <Spinner size="large" />
                </View>
              ) : invoicesQuery.isError ? (
                <Banner intent="danger">
                  <Banner.Body>
                    <Banner.Title>Couldn&apos;t load invoices</Banner.Title>
                    <Banner.Description>
                      {(invoicesQuery.error as Error)?.message ??
                        "Network error."}
                    </Banner.Description>
                    <Banner.Action self="flex-end" mt="$2">
                      <Button
                        intent="secondary"
                        size="sm"
                        onPress={() => void invoicesQuery.refetch()}
                      >
                        Try again
                      </Button>
                    </Banner.Action>
                  </Banner.Body>
                </Banner>
              ) : !invoicesQuery.data || invoicesQuery.data.length === 0 ? (
                <Paragraph fontSize="$3" color="$mutedForeground">
                  No invoices yet.
                </Paragraph>
              ) : (
                <Card>
                  <Card.Body gap="$0" p="$0">
                    {invoicesQuery.data.map((inv, i) => (
                      <YStack key={inv.id}>
                        {i > 0 ? <Separator /> : null}
                        <InvoiceRow
                          invoice={inv}
                          orgId={activeOrgId!}
                          onError={() =>
                            toast.show({
                              title: "Couldn't open the invoice",
                              intent: "danger",
                            })
                          }
                        />
                      </YStack>
                    ))}
                  </Card.Body>
                </Card>
              )}
            </YStack>

            {/* Footer mark (PWA parity). */}
            <XStack
              items="center"
              justify="space-between"
              borderTopWidth={1}
              borderColor="$borderColor"
              pt="$4"
            >
              <Text fontSize="$1" color="$mutedForeground">
                Meridian — personal productivity
              </Text>
              <Text fontSize="$1" color="$mutedForeground">
                Powered by Stageholder
              </Text>
            </XStack>
          </YStack>
        </ScrollView>
      </SafeAreaView>
    </YStack>
  );
}

/* ------------------------------ Invoice row ------------------------------ */

function InvoiceRow({
  invoice,
  orgId,
  onError,
}: {
  invoice: HubInvoice;
  orgId: string;
  onError: () => void;
}) {
  const [opening, setOpening] = useState(false);

  async function openInvoice() {
    setOpening(true);
    try {
      const url = await fetchInvoiceUrl(orgId, invoice.id);
      if (!url) throw new Error("missing url");
      openURL(url);
    } catch {
      onError();
    } finally {
      setOpening(false);
    }
  }

  return (
    <XStack items="center" gap="$3" px="$4" py="$3">
      <YStack flex={1} minW={0}>
        <Text fontSize="$3" color="$color" numberOfLines={1}>
          {formatDate(invoice.createdAt)}
        </Text>
        <Text fontSize="$2" color="$mutedForeground" numberOfLines={1}>
          {invoice.refunded ? "Refunded" : invoice.statusFormatted}
        </Text>
      </YStack>
      <Text fontFamily="$mono" fontSize="$3" color="$color">
        {invoice.totalFormatted}
      </Text>
      <IconButton
        variant="ghost"
        size="sm"
        aria-label="Open invoice"
        disabled={opening}
        onPress={() => void openInvoice()}
      >
        {opening ? <Spinner size="small" /> : <Download size={16} />}
      </IconButton>
    </XStack>
  );
}
