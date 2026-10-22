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

import { useCallback, useRef, useState } from "react";
import {
  Badge,
  Banner,
  Button,
  Card,
  IconButton,
  Paragraph,
  ScrollView,
  Separator,
  Skeleton,
  Spinner,
  Text,
  View,
  XStack,
  YStack,
  toast,
} from "@stageholder/ui";
import { openURL } from "@repo/core/platform/linking";
import {
  useEnterprise,
  useOrg,
  useStageholder,
  useSubscription,
  useUser,
} from "@stageholder/sdk/react-native";
import { Download } from "@tamagui/lucide-icons-2/icons/Download";
import { ExternalLink } from "@tamagui/lucide-icons-2/icons/ExternalLink";
import { useFocusEffect, useRouter } from "expo-router";

import { ScreenScroll } from "@/components/screen-scroll";
import {
  canManageBilling,
  fetchInvoiceUrl,
  useBillingPortal,
  useInvoices,
  type HubInvoice,
} from "@/lib/api/hub";
import { iapEnabled, openStoreSubscriptions } from "@/lib/purchases";

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
  const router = useRouter();

  const sub = useSubscription();
  const enterprise = useEnterprise();
  const { user } = useUser();
  const { org, activeOrgId } = useOrg();
  const { refreshSession } = useStageholder();
  const canManage = canManageBilling(org?.role);

  // Re-pull the session ONCE per focus — catches the entitlement landing
  // after a store purchase (the /upgrade poll + the navigation here) or after
  // an app background-return, so the plan card and provider branch are never
  // stale. Read `refreshSession` through a ref: the SDK rebuilds that
  // function after every refresh (it closes over the auth state), so listing
  // it as a dependency re-ran this effect after each refresh — an unbounded
  // refresh loop (~2/s) that rotated the refresh token until the Hub rejected
  // one and the app was signed out.
  const refreshSessionRef = useRef(refreshSession);
  refreshSessionRef.current = refreshSession;
  useFocusEffect(
    useCallback(() => {
      void refreshSessionRef.current().catch(() => {});
    }, []),
  );

  // Which biller owns the active subscription (SDK `provider` claim). Drives
  // where plan management lives. Default to "polar" when absent (older Hub
  // tokens predate the field, and a missing provider means web-billed).
  const provider = sub?.provider ?? "polar";
  const storeBilled = provider === "app_store" || provider === "play";
  const storeName = provider === "play" ? "Google Play" : "App Store";
  // A PAID store plan. A lapsed store subscription is downgraded by the Hub
  // to the free plan but keeps its provider, so gate the store-management
  // affordances on the plan being paid, not just on the provider.
  const storePaid = storeBilled && !!sub && !sub.isFreeTier;
  // Apple / Google are the merchant of record for store plans: they bill the
  // customer and hold the receipts; the Hub ledger only has Polar invoices.
  const invoicesQuery = useInvoices(
    canManage && !storePaid ? activeOrgId : undefined,
  );
  const portal = useBillingPortal();
  // Is this a store-distributed build (RevenueCat key present)? On store builds
  // we must not surface external payment links (App Store guideline 3.1.1).
  const storeBuild = iapEnabled();

  function openPortal() {
    if (!activeOrgId) return;
    portal.mutate(
      { orgId: activeOrgId },
      {
        onSuccess: ({ url }) => openURL(url),
        onError: () => toast.error("Couldn't open the billing portal"),
      },
    );
  }

  return (
    <YStack flex={1} bg="$background">
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
              Billing
            </Text>
            <Text fontSize="$8" fontWeight="700" color="$color">
              Your subscription
            </Text>
            <Paragraph fontSize="$3" color="$mutedForeground">
              {storePaid
                ? `Billed through your ${storeName} account.`
                : "Manage your plan, payment method, and invoices."}
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
              {sub?.currentPeriodEnd && !sub.isFreeTier ? (
                <Text fontSize="$3" color="$mutedForeground">
                  {sub.cancelAtPeriodEnd ? "Ends" : "Renews"}{" "}
                  {formatDate(sub.currentPeriodEnd)}
                </Text>
              ) : null}
              {sub?.pricingModel === "seat_based" && sub.seats != null ? (
                <Text fontSize="$3" color="$mutedForeground">
                  {sub.seats}
                  {sub.memberLimit != null ? ` of ${sub.memberLimit}` : ""}{" "}
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
                  // changes live in the store's subscription management —
                  // presented IN-APP (StoreKit sheet / Play screen) — the
                  // Polar portal can't touch these. On a store build we also
                  // offer an in-app plan change through the store paywall.
                  // A lapsed (now free) store row only gets the upgrade path.
                  <YStack gap="$2">
                    {storeBuild ? (
                      <Button
                        intent="primary"
                        onPress={() => router.push("/upgrade")}
                      >
                        {storePaid ? "Change plan" : "Upgrade plan"}
                      </Button>
                    ) : null}
                    {storePaid ? (
                      <Button
                        intent={storeBuild ? "outline" : "primary"}
                        onPress={() => void openStoreSubscriptions(user?.sub)}
                      >
                        {`Manage in ${storeName}`}
                      </Button>
                    ) : null}
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
                      This plan is billed on the web. Manage your payment method
                      and plan from the Meridian web app.
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

          {/* ---- Invoices (the PWA ledger) / store receipts ---- */}
          <YStack gap="$2">
            <Text fontSize="$5" fontWeight="600" color="$color">
              {storePaid ? "Receipts" : "Invoices"}
            </Text>

            {storePaid ? (
              // Store plans are billed by Apple / Google, who email a receipt
              // for every charge and keep the purchase history — no invoice
              // ever reaches the Hub ledger. Point at the store's history.
              <Paragraph fontSize="$3" color="$mutedForeground">
                {provider === "play"
                  ? "Google Play bills this plan and emails a receipt for every charge. Your full history is in the Play Store under Payments & subscriptions."
                  : "Apple bills this plan and emails a receipt for every charge. Your full history is in Settings → your Apple Account → Media & Purchases → Purchase History."}
              </Paragraph>
            ) : !canManage ? (
              <Paragraph fontSize="$3" color="$mutedForeground">
                Invoices are visible to organization owners and admins.
              </Paragraph>
            ) : invoicesQuery.isLoading ? (
              <InvoiceListSkeleton />
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
                        onError={() => toast.error("Couldn't open the invoice")}
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
      </ScreenScroll>
    </YStack>
  );
}

/* -------------------------- Invoice list skeleton ------------------------- */

/** Loading placeholder mirroring the invoice-row silhouette (date/status
 *  column + amount) so the ledger doesn't pop in from a bare spinner. */
function InvoiceListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Card>
      <Card.Body gap="$0" p="$0">
        {Array.from({ length: rows }).map((_, i) => (
          <YStack key={i}>
            {i > 0 ? <Separator /> : null}
            <XStack items="center" gap="$3" px="$4" py="$3">
              <YStack flex={1} minW={0} gap="$1.5">
                <Skeleton height={13} width="42%" rounded="$sm" />
                <Skeleton height={11} width="28%" rounded="$sm" />
              </YStack>
              <Skeleton height={13} width={56} rounded="$sm" />
            </XStack>
          </YStack>
        ))}
      </Card.Body>
    </Card>
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
