import {
  useBillingPortal,
  useCanManageBilling,
  useOrg,
  useStageholder,
  useSubscription,
} from "@stageholder/sdk/spa";
import { useNavigate } from "@tanstack/react-router";
import { openURL } from "@repo/core/platform/linking";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import { OrbitIllustration } from "./orbit-illustration";
import {
  Button,
  H1,
  Skeleton,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";

/**
 * Editorial hero for the billing dashboard. Reads like the cover page of
 * a quarterly report: large display name of the current plan, mono
 * metadata (status, renewal, member count), and an abstract orbital
 * illustration on the right that mirrors the upgrade page so the two
 * surfaces feel like one publication.
 *
 * Built entirely from SDK hooks (`useSubscription`, `useCanManageBilling`,
 * `useBillingPortal`, `useStageholder`) — no high-level SDK component
 * involved. This is the pattern Meridian uses to fully customize the
 * billing UX while still relying on Hub for the underlying truth.
 */
export function CurrentPlanHero({
  changePlanHref = "/settings/billing/upgrade",
}: {
  changePlanHref?: string;
}) {
  const navigate = useNavigate();
  const sub = useSubscription();
  const { state } = useStageholder();
  const { org } = useOrg();
  const { canManage } = useCanManageBilling();
  const billingPortal = useBillingPortal();
  const portalPending = billingPortal.isPending;

  if (state.status !== "authenticated") {
    return <HeroSkeleton />;
  }

  const isFree = !sub;
  const planName = sub?.planName ?? "Free";
  const status = sub?.status ?? "active";
  const seats =
    sub?.pricingModel === "seat_based"
      ? { used: sub.seats ?? 0, total: sub.memberLimit ?? 0 }
      : null;

  const tier: "rest" | "practice" | "conduct" = isFree
    ? "rest"
    : status === "trialing"
      ? "practice"
      : "conduct";

  return (
    <View
      render="section"
      position="relative"
      rounded={32}
      borderWidth={1}
      borderColor="$borderColor"
      // Was a from-card→card/70 diagonal gradient; flattened to the opaque
      // $card token (no kit gradient token). FLAG: subtle gradient dropped.
      bg="$card"
      p="$7"
      $md={{ p: "$8" }}
      // Staggered section reveal — Tamagui-native mount animation (was the
      // `billing-reveal billing-stagger-1` CSS keyframe), matching upgrade.tsx.
      enterStyle={{ opacity: 0, y: 14 }}
      transition={["medium", { delay: 60 }]}
    >
      {/* Top-row status strip */}
      <XStack mb="$6" $md={{ mb: "$8" }} items="center" gap="$3">
        <StatusPill status={status} />
      </XStack>

      <XStack
        flexDirection="column"
        gap="$6"
        $md={{ flexDirection: "row", items: "center", gap: "$8" }}
      >
        {/* Left: plan name + meta + actions.
            On mobile this is a single column. `flex={1}` (→ flexBasis:0%)
            collapses to ZERO height inside an indefinite-height *column* flex
            container on iOS WebKit, so the meta + actions overflowed the card
            and the Invoices card slid underneath them. Use full width + natural
            height on mobile, and only flex-share the row at md+ (where the orbit
            illustration sits beside it). */}
        <YStack
          width="100%"
          gap="$6"
          $md={{
            width: "auto",
            grow: 1.4,
            shrink: 1,
            flexBasis: 0,
            gap: "$8",
          }}
        >
          <YStack gap="$3">
            <Text
              fontFamily="$mono"
              fontSize="$1"
              textTransform="uppercase"
              letterSpacing={3.4}
              color="$mutedForeground"
            >
              Current plan
            </Text>
            {/* Responsive display size: 64px on a phone overflows / dwarfs the
                card; scale up to the editorial size at md+. lineHeight is kept
                >= fontSize on mobile so the glyph never spills past the card. */}
            <H1
              fontSize={44}
              lineHeight={46}
              letterSpacing={-1}
              color="$color"
              $md={{ fontSize: 64, lineHeight: 60, letterSpacing: -1.3 }}
              style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
            >
              {planName}
            </H1>
          </YStack>

          <XStack
            flexWrap="wrap"
            gap="$5"
            borderTopWidth={1}
            borderColor="$borderColor"
            pt="$5"
          >
            <MetaCell
              label="Billing"
              value={
                isFree
                  ? "No charges"
                  : sub?.pricingModel === "seat_based"
                    ? "Per seat"
                    : "Flat rate"
              }
            />
            <MetaCell
              label="Seats"
              value={seats ? `${seats.used} of ${seats.total}` : "1 of 1"}
            />
            <MetaCell
              label="Account"
              value={state.data.email ?? state.data.name ?? "you"}
              ellipsis
            />
          </XStack>

          <XStack flexWrap="wrap" gap="$3" pt="$2">
            {/* Client-side nav via TanStack's useNavigate — no page refresh. */}
            <Button
              onPress={() => void navigate({ to: changePlanHref })}
              iconAfter={<ArrowUpRight size={16} strokeWidth={2} />}
            >
              {isFree ? "Upgrade your plan" : "Change plan"}
            </Button>

            {canManage && !isFree && org && (
              <Button
                intent="outline"
                disabled={portalPending}
                iconAfter={<ExternalLink size={14} strokeWidth={2} />}
                onPress={() => {
                  billingPortal
                    .mutateAsync({
                      orgId: org.id,
                      returnUrl: `${window.location.origin}/app/settings/billing`,
                    })
                    .then(({ url }) => {
                      openURL(url);
                    })
                    .catch((err) =>
                      // eslint-disable-next-line no-console
                      console.error("[meridian] portal failed:", err),
                    );
                }}
              >
                {portalPending ? "Opening…" : "Manage payment"}
              </Button>
            )}
          </XStack>

          {!canManage && !isFree && (
            <Text
              borderLeftWidth={2}
              borderColor="$borderColor"
              pl="$4"
              fontSize="$1"
              color="$mutedForeground"
            >
              Only owners and admins can change the plan or update payment
              details. Ask an admin in your organization for changes.
            </Text>
          )}
        </YStack>

        {/* Right: orbital illustration framed like a printer's plate */}
        <View
          position="relative"
          display="none"
          $md={{ display: "flex", grow: 1 }}
        >
          <View position="relative" mx="auto" width="100%" maxW={320}>
            {/* aspect-square via padding-bottom trick is hard without a token;
                the inner absolute layers fill an explicit square frame. */}
            <View style={{ aspectRatio: 1 }}>
              <View
                position="absolute"
                t={0}
                r={0}
                b={0}
                l={0}
                rounded={28}
                bg="$background"
                opacity={0.6}
                borderWidth={1}
                borderColor="$borderColor"
              />
              <View position="absolute" t={0} r={0} b={0} l={0} p="$6">
                <OrbitIllustration tier={tier} />
              </View>
              {/* corner ticks */}
              {(["tl", "tr", "bl", "br"] as const).map((c) => (
                <CornerTick key={c} corner={c} />
              ))}
            </View>
          </View>
          <Text mt="$4" fontSize="$1" color="$mutedForeground" text="center">
            Your active features
          </Text>
        </View>
      </XStack>
    </View>
  );
}

function StatusPill({ status }: { status: string }) {
  // emerald/amber/rose intents map onto the kit's success/warning/destructive
  // muted-tint tokens; the dot inherits the same intent color.
  const tone =
    status === "active"
      ? ({ bg: "$successMuted", color: "$success" } as const)
      : status === "trialing"
        ? ({ bg: "$warningMuted", color: "$warning" } as const)
        : status === "past_due"
          ? ({ bg: "$destructiveMuted", color: "$destructive" } as const)
          : ({ bg: "$muted", color: "$mutedForeground" } as const);
  const label =
    status === "active"
      ? "Active"
      : status === "trialing"
        ? "Free trial"
        : status === "past_due"
          ? "Payment due"
          : status;
  return (
    <XStack
      items="center"
      gap="$1.5"
      rounded={9999}
      px="$3"
      py="$1"
      bg={tone.bg}
    >
      <View width={6} height={6} rounded={9999} bg={tone.color} />
      <Text fontSize="$1" fontWeight="500" color={tone.color}>
        {label}
      </Text>
    </XStack>
  );
}

function MetaCell({
  label,
  value,
  ellipsis,
}: {
  label: string;
  value: string;
  ellipsis?: boolean;
}) {
  return (
    <YStack flex={1} minW={120} gap="$1">
      <Text
        fontFamily="$mono"
        fontSize={10}
        textTransform="uppercase"
        letterSpacing={2.4}
        color="$mutedForeground"
      >
        {label}
      </Text>
      <Text
        fontSize="$3"
        fontWeight="500"
        color="$color"
        numberOfLines={ellipsis ? 1 : undefined}
      >
        {value}
      </Text>
    </YStack>
  );
}

function CornerTick({ corner }: { corner: "tl" | "tr" | "bl" | "br" }) {
  // Small L-shaped registration ticks at each corner. The two visible edges
  // depend on which corner, drawn as faint borders on a tiny square.
  const edges = {
    tl: { borderLeftWidth: 1, borderTopWidth: 1 },
    tr: { borderRightWidth: 1, borderTopWidth: 1 },
    bl: { borderLeftWidth: 1, borderBottomWidth: 1 },
    br: { borderRightWidth: 1, borderBottomWidth: 1 },
  } as const;
  const pos = {
    tl: { t: 7 as const, l: 7 as const },
    tr: { t: 7 as const, r: 7 as const },
    bl: { b: 7 as const, l: 7 as const },
    br: { b: 7 as const, r: 7 as const },
  } as const;
  return (
    <View
      position="absolute"
      width={12}
      height={12}
      borderColor="$borderColor"
      {...pos[corner]}
      {...edges[corner]}
    />
  );
}

function HeroSkeleton() {
  return (
    <View
      render="section"
      rounded={32}
      borderWidth={1}
      borderColor="$borderColor"
      bg="$card"
      p="$7"
    >
      <Skeleton height={8} width={128} rounded={9999} />
      <Skeleton mt="$6" height={64} width="66%" rounded={16} />
      <XStack mt="$8" gap="$4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} flex={1} height={40} rounded={12} />
        ))}
      </XStack>
    </View>
  );
}
