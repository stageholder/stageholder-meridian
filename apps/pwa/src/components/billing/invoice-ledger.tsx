import { useState } from "react";
import {
  useCanManageBilling,
  useInvoices,
  useStageholder,
} from "@stageholder/sdk/spa";
import { Download, Loader2 } from "lucide-react";
import {
  Button,
  H2,
  Paragraph,
  Skeleton,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";

/**
 * Invoice list rendered as a vintage logbook. Mono header row, hairline
 * separators, no zebra striping — let typography and rhythm do the work.
 *
 * Built directly on `useInvoices()` — no SDK component used. Renders the
 * admin-required note via `useCanManageBilling()` because Hub's invoice
 * endpoint 403s for non-admin members and we want the explainer here too.
 */
export function InvoiceLedger({
  changePlanHref = "/settings/billing/upgrade",
}: {
  changePlanHref?: string;
}) {
  const { state } = useStageholder();
  const { canManage } = useCanManageBilling();
  const orgId =
    state.status === "authenticated" ? state.data.activeOrgId : undefined;
  const { data, isLoading, isError } = useInvoices(orgId);

  return (
    <View
      tag="section"
      position="relative"
      rounded={32}
      borderWidth={1}
      borderColor="$borderColor"
      bg="$card"
      p="$6"
      $md={{ p: "$7" }}
      // allowlist: billing-reveal / billing-stagger-3 — staggered section
      // reveal keyframe shared across the billing dashboard (no token equiv).
      className="billing-reveal billing-stagger-3"
    >
      {/* Header */}
      <XStack
        tag="header"
        mb="$6"
        flexWrap="wrap"
        items="flex-end"
        justify="space-between"
        gap="$3"
        borderBottomWidth={1}
        borderColor="$borderColor"
        pb="$3"
      >
        <YStack gap="$1">
          <H2
            fontSize="$8"
            letterSpacing={-0.5}
            // Display serif lives only as a CSS var (no kit font token).
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            Invoices
          </H2>
          <Text fontSize="$3" color="$mutedForeground">
            All past charges and downloadable receipts.
          </Text>
        </YStack>
        {(data?.length ?? 0) > 0 && (
          <Text fontSize="$1" color="$mutedForeground">
            {data?.length} {data?.length === 1 ? "invoice" : "invoices"}
          </Text>
        )}
      </XStack>

      {/* Body branches */}
      {!canManage && state.status === "authenticated" ? (
        <NoticePanel
          headline="Only admins can view invoices"
          body="Ask an owner or admin in your organization for a copy of any invoice."
        />
      ) : isLoading ? (
        <LedgerSkeleton />
      ) : isError ? (
        <NoticePanel
          headline="Couldn't load invoices"
          body="Something went wrong on our side. Refresh the page or try again in a minute."
        />
      ) : !data || data.length === 0 ? (
        <EmptyLedger changePlanHref={changePlanHref} />
      ) : (
        <YStack>
          <XStack
            gap="$5"
            borderBottomWidth={1}
            borderColor="$borderColor"
            pb="$3"
          >
            <Text
              flex={1}
              fontSize="$1"
              fontWeight="500"
              color="$mutedForeground"
            >
              Date
            </Text>
            <Text
              flex={1}
              fontSize="$1"
              fontWeight="500"
              color="$mutedForeground"
            >
              Reason
            </Text>
            <Text
              flex={1}
              fontSize="$1"
              fontWeight="500"
              color="$mutedForeground"
            >
              Amount
            </Text>
            <Text
              fontSize="$1"
              fontWeight="500"
              color="$mutedForeground"
              text="right"
            >
              Receipt
            </Text>
          </XStack>
          {data.map((inv) => (
            <XStack
              key={inv.id}
              items="center"
              gap="$5"
              borderBottomWidth={1}
              borderColor="$borderColor"
              py="$4"
              transition="quick"
              hoverStyle={{ bg: "$accent" }}
            >
              <Text flex={1} fontFamily="$mono" fontSize="$1" color="$color">
                {new Date(inv.createdAt).toLocaleDateString(undefined, {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </Text>
              <Text
                flex={1}
                fontSize="$3"
                color="$color"
                textTransform="capitalize"
              >
                {humanReason(inv.billingReason)}
              </Text>
              <Text
                flex={1}
                fontFamily="$mono"
                fontSize="$3"
                fontWeight="500"
                color="$color"
              >
                {inv.totalFormatted}
              </Text>
              <DownloadButton orgId={orgId} orderId={inv.id} />
            </XStack>
          ))}
        </YStack>
      )}
    </View>
  );
}

/**
 * "Download" pill on a single invoice row. Hub's `/api/billing/invoices/:orgId/:orderId/url`
 * returns `{url}` JSON (not a redirect), so an anchor href would navigate to
 * the JSON page. Fetch the JSON on click, then open the resolved Polar
 * hosted-invoice URL in a new tab.
 */
function DownloadButton({
  orgId,
  orderId,
}: {
  orgId: string | undefined;
  orderId: string;
}) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      intent="outline"
      size="sm"
      disabled={!orgId || pending}
      icon={
        pending ? (
          // allowlist: animate-spin — loading spinner, no token equivalent
          <Loader2 className="animate-spin" size={14} strokeWidth={2} />
        ) : (
          <Download size={14} strokeWidth={2} />
        )
      }
      onPress={async () => {
        if (!orgId) return;
        setPending(true);
        try {
          const res = await fetch(
            `/api/billing/invoices/${orgId}/${orderId}/url`,
            { credentials: "include", headers: { accept: "application/json" } },
          );
          if (!res.ok) throw new Error(`invoice url failed: ${res.status}`);
          const { url } = (await res.json()) as { url?: string };
          if (url) window.open(url, "_blank", "noopener,noreferrer");
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("[meridian] invoice download failed:", err);
        } finally {
          setPending(false);
        }
      }}
    >
      Download
    </Button>
  );
}

function NoticePanel({ headline, body }: { headline: string; body: string }) {
  return (
    <YStack
      rounded={16}
      borderWidth={1}
      borderStyle="dashed"
      borderColor="$borderColor"
      bg="$muted"
      p="$6"
    >
      <Text
        fontSize="$5"
        letterSpacing={-0.3}
        style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
      >
        {headline}
      </Text>
      <Paragraph mt="$2" maxW={448} fontSize="$3" color="$mutedForeground">
        {body}
      </Paragraph>
    </YStack>
  );
}

function EmptyLedger({ changePlanHref }: { changePlanHref: string }) {
  return (
    <XStack
      flexWrap="wrap"
      items="center"
      justify="space-between"
      gap="$6"
      rounded={16}
      borderWidth={1}
      borderStyle="dashed"
      borderColor="$borderColor"
      bg="$background"
      p="$7"
    >
      <YStack flex={1} minW={240}>
        <Text
          fontSize="$6"
          letterSpacing={-0.3}
          style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
        >
          No invoices yet
        </Text>
        <Paragraph mt="$1.5" maxW={448} fontSize="$3" color="$mutedForeground">
          You&rsquo;re on the Free plan. Once you upgrade, every invoice will
          appear here as a downloadable PDF.
        </Paragraph>
      </YStack>
      {/* External-style anchor wrapping a kit Button: the route is owned by
          the host page; an <a> keeps it a real navigable link. */}
      <a href={changePlanHref} style={{ textDecoration: "none" }}>
        <Button>See plans</Button>
      </a>
    </XStack>
  );
}

function LedgerSkeleton() {
  return (
    <YStack gap="$3">
      {Array.from({ length: 3 }).map((_, i) => (
        <XStack
          key={i}
          items="center"
          gap="$5"
          borderBottomWidth={1}
          borderColor="$borderColor"
          py="$4"
        >
          <Skeleton flex={1} height={12} rounded={9999} />
          <Skeleton flex={1} height={12} rounded={9999} />
          <Skeleton flex={1} height={12} rounded={9999} />
          <Skeleton width={96} height={28} rounded={9999} />
        </XStack>
      ))}
    </YStack>
  );
}

function humanReason(reason: string | undefined): string {
  if (!reason) return "—";
  switch (reason) {
    case "subscription_create":
      return "New subscription";
    case "subscription_cycle":
      return "Renewal";
    case "subscription_update":
      return "Plan change";
    case "purchase":
      return "Purchase";
    default:
      return reason.replace(/_/g, " ");
  }
}
