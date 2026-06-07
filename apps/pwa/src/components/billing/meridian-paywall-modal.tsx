import {
  Button,
  Dialog,
  H2,
  Paragraph,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { useCanManageBilling } from "@stageholder/sdk/spa";
import type { PaywallReason } from "@stageholder/sdk/core";
import { ArrowUpRight } from "lucide-react";
import { LimitOrbit } from "./limit-orbit";
// This modal renders from <PaywallListener> in App.tsx, OUTSIDE <RouterProvider>,
// so the useNavigate() hook has no router context. Navigate via the router
// singleton instead — same client-side nav, no React-context dependency.
import { router } from "@/router";

const PRICING_HREF = "/settings/billing/upgrade";

export interface MeridianPaywallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Bind to `usePaywall().reason` from the SDK. `null` → renders nothing. */
  reason: PaywallReason | null;
}

/**
 * Meridian's bespoke paywall dialog. Built on the kit `Dialog` — does NOT
 * call into the SDK's `<PaywallModal>`. The state machine (open/close/reason)
 * still flows from SDK's `usePaywall()`; only the presentation is owned by
 * Meridian.
 *
 * The kit `Dialog.Overlay`/`Dialog.Content` already animate enter/exit via
 * their `transition`/`enterStyle`/`exitStyle`, so the old Radix
 * `data-[state]:animate-*` classes are gone. Reads consistently with the
 * billing dashboard and the upgrade page: editorial gutter mark, Bricolage
 * display headline with italic emphasis, mono ledger, paper-grain backdrop,
 * orbital diagram. The diagram is a diagnostic variant — it lights up the
 * gated pillar (todos / habits / journal) so the user instantly sees which
 * boundary they hit.
 */
export function MeridianPaywallModal({
  open,
  onOpenChange,
  reason,
}: MeridianPaywallModalProps) {
  const { canManage } = useCanManageBilling();
  if (!reason) return null;

  const close = () => onOpenChange(false);
  const featureLabel = reason.featureLabel ?? reason.feature;
  const planName =
    reason.suggestedPlanName ?? reason.suggestedPlan ?? "Unlimited";
  const pillar = pillarForFeature(reason.feature);
  // The upgrade route carries query params so it can pre-highlight the gated
  // feature / suggested plan. Build a typed search object for client-side nav.
  const upgradeSearch: Record<string, string> = {
    feature: reason.feature,
    ...(reason.suggestedPlan ? { plan: reason.suggestedPlan } : {}),
  };

  // Close the modal, then client-side nav to the upgrade page.
  const goToUpgrade = () => {
    close();
    void router.navigate({ to: PRICING_HREF, search: upgradeSearch });
  };

  return (
    // disableRemoveScroll: the kit's modal scroll-lock sets overflow:hidden +
    // scrollbar-gutter:stable on <html>, but this PWA scrolls in an inner
    // container (app-shell's <main>), so the lock just reserves a phantom
    // gutter and shifts the background when the dialog opens. The full-screen
    // scrim already blocks background interaction, so the lock is redundant.
    <Dialog open={open} onOpenChange={onOpenChange} disableRemoveScroll>
      <Dialog.Portal>
        {/* Frosted backdrop (was Tailwind backdrop-blur-md) — load-bearing for
            the editorial modal; the kit overlay supplies the base tint +
            enter/exit animation. backdrop-filter is web-only CSS, so it rides
            the style hatch. */}
        <Dialog.Overlay
          style={
            {
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            } as object
          }
        />
        <Dialog.Content
          // Override the kit's default 480 max-width / padding for the wide
          // two-column paywall. The kit's transition + enter/exit still run.
          maxW={672}
          width="100%"
          p={0}
          overflow="hidden"
          rounded={32}
        >
          {/* allowlist: billing-paper — paper-grain texture keyframe scoped to
              the modal (no token equivalent). */}
          <View position="relative" className="billing-paper">
            <View px="$7" pt="$7" pb="$8" $sm={{ px: "$9", py: "$9" }}>
              {/* Top strip */}
              <XStack
                mb="$7"
                flexWrap="wrap"
                items="center"
                justify="space-between"
                gap="$3"
                borderBottomWidth={1}
                borderColor="$borderColor"
                pb="$5"
              >
                <Text fontSize="$1" fontWeight="500" color="$mutedForeground">
                  Plan limit reached
                </Text>
                <PillarBadge pillar={pillar} />
              </XStack>

              {/* Two-column body — text + ledger on the left, orbital diagram
                  on the right. The CTAs DON'T live in this grid; they sit
                  below it spanning the full modal width so the primary button
                  is the most obvious target on the page. */}
              <XStack
                flexDirection="column"
                gap="$8"
                $sm={{ flexDirection: "row", gap: "$9" }}
              >
                {/* Text + ledger column */}
                <YStack flex={1} gap="$7" $sm={{ grow: 1.3 }}>
                  <YStack gap="$4">
                    <Text
                      fontSize="$3"
                      fontWeight="600"
                      color="$mutedForeground"
                    >
                      {reason.currentLimit !== undefined
                        ? "You hit a usage limit"
                        : "Upgrade required"}
                    </Text>
                    <Dialog.Title asChild>
                      <H2
                        fontSize={36}
                        lineHeight={36 * 1.02}
                        letterSpacing={-0.36}
                        color="$color"
                        style={{
                          fontFamily: "var(--font-display)",
                          fontWeight: 600,
                        }}
                      >
                        You&rsquo;ve hit your{" "}
                        <Text fontStyle="italic" fontWeight="500">
                          {featureLabel}
                        </Text>{" "}
                        limit.
                      </H2>
                    </Dialog.Title>
                    <Dialog.Description asChild>
                      <Paragraph
                        maxW={448}
                        fontSize="$3"
                        color="$mutedForeground"
                      >
                        {reason.customMessage ??
                          buildBody(
                            featureLabel,
                            planName,
                            reason.currentLimit,
                          )}
                      </Paragraph>
                    </Dialog.Description>
                  </YStack>

                  {/* Mobile-only inline diagram — sits between body and ledger
                      on small screens so the user gets visual context without
                      the desktop side-by-side. */}
                  <View $sm={{ display: "none" }}>
                    <View
                      position="relative"
                      mx="auto"
                      width="100%"
                      maxW={180}
                      style={{ aspectRatio: 1 }}
                    >
                      <View
                        position="absolute"
                        t={0}
                        r={0}
                        b={0}
                        l={0}
                        rounded={20}
                        bg="$background"
                        opacity={0.6}
                        borderWidth={1}
                        borderColor="$borderColor"
                      />
                      <View position="absolute" t={0} r={0} b={0} l={0} p="$3">
                        <LimitOrbit highlight={pillar} />
                      </View>
                    </View>
                  </View>

                  {/* Plain key/value ledger. Labels are short, values are
                      instantly scannable. */}
                  <XStack
                    flexWrap="wrap"
                    gap="$4"
                    borderTopWidth={1}
                    borderColor="$borderColor"
                    pt="$5"
                  >
                    <LedgerCell label="Current plan" value="Free" />
                    <LedgerCell
                      label="Used"
                      value={
                        reason.currentLimit !== undefined
                          ? `${reason.currentLimit} of ${reason.currentLimit}`
                          : "—"
                      }
                      mono
                    />
                    <LedgerCell label="Feature" value={prettyPillar(pillar)} />
                    <LedgerCell label="Recommended" value={planName} />
                  </XStack>
                </YStack>

                {/* Diagram column (desktop only) */}
                <View
                  render="aside"
                  display="none"
                  $sm={{ display: "flex", grow: 1 }}
                >
                  <View
                    position="relative"
                    mx="auto"
                    width="100%"
                    maxW={280}
                    style={{ aspectRatio: 1 }}
                  >
                    <View
                      position="absolute"
                      t={0}
                      r={0}
                      b={0}
                      l={0}
                      rounded={24}
                      bg="$background"
                      opacity={0.6}
                      borderWidth={1}
                      borderColor="$borderColor"
                    />
                    <View position="absolute" t={0} r={0} b={0} l={0} p="$5">
                      <LimitOrbit highlight={pillar} />
                    </View>
                    {(["tl", "tr", "bl", "br"] as const).map((c) => (
                      <CornerTick key={c} corner={c} />
                    ))}
                  </View>
                  <Paragraph
                    mt="$4"
                    fontSize="$1"
                    color="$mutedForeground"
                    text="center"
                  >
                    Your{" "}
                    <Text fontWeight="500" color="$color">
                      {prettyPillar(pillar).toLowerCase()}
                    </Text>{" "}
                    ring is full
                  </Paragraph>
                </View>
              </XStack>

              {/* Non-admin notice — full modal width below the body. */}
              {!canManage && (
                <View
                  role="note"
                  mt="$8"
                  rounded={16}
                  borderWidth={1}
                  borderStyle="dashed"
                  borderColor="$borderColor"
                  bg="$muted"
                  p="$4"
                >
                  <Paragraph fontSize="$2" color="$mutedForeground">
                    Only owners and admins can change the plan. Ask an admin on
                    your organization to upgrade.
                  </Paragraph>
                </View>
              )}

              {/* Full-width CTAs — pulled out of the grid so the primary
                  button spans the entire modal. Industry-standard
                  upgrade-prompt layout (Linear, Notion, Stripe): one
                  unmistakable primary action, one quiet text-link exit. */}
              <YStack mt="$8" gap="$3">
                {canManage ? (
                  // Client-side nav via the router singleton (this modal renders
                  // outside RouterProvider) — the upgrade route carries query
                  // params (feature / suggested plan).
                  <Button
                    width="100%"
                    onPress={goToUpgrade}
                    iconAfter={<ArrowUpRight size={14} strokeWidth={2} />}
                  >
                    Upgrade your plan
                  </Button>
                ) : null}
                <Dialog.Close asChild>
                  <Button intent="ghost" width="100%">
                    Maybe later
                  </Button>
                </Dialog.Close>
              </YStack>
            </View>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function PillarBadge({
  pillar,
}: {
  pillar: "todos" | "habits" | "journal" | null;
}) {
  if (!pillar) return null;

  // The pillar accent is a viz CSS var (--ring-todo/habit/journal) with no
  // kit token — applied via the style escape hatch on the dot.
  const tone =
    pillar === "todos"
      ? "var(--color-ring-todo, var(--ring-todo))"
      : pillar === "habits"
        ? "var(--color-ring-habit, var(--ring-habit))"
        : "var(--color-ring-journal, var(--ring-journal))";

  return (
    <XStack
      items="center"
      gap="$2"
      rounded={9999}
      borderWidth={1}
      borderColor="$borderColor"
      bg="$background"
      px="$3"
      py="$1"
    >
      <View
        aria-hidden
        width={6}
        height={6}
        rounded={9999}
        style={{ backgroundColor: tone }}
      />
      <Text fontSize="$1" fontWeight="500" color="$color">
        {prettyPillar(pillar)}
      </Text>
    </XStack>
  );
}

function LedgerCell({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <YStack flex={1} minW={120} gap="$1">
      <Text fontSize="$1" fontWeight="500" color="$mutedForeground">
        {label}
      </Text>
      <Text
        fontSize="$4"
        fontWeight="600"
        color="$color"
        fontFamily={mono ? "$mono" : undefined}
      >
        {value}
      </Text>
    </YStack>
  );
}

function CornerTick({ corner }: { corner: "tl" | "tr" | "bl" | "br" }) {
  // Small L-shaped registration ticks at each corner — the two visible edges
  // depend on which corner.
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
      aria-hidden
      position="absolute"
      width={12}
      height={12}
      borderColor="$borderColor"
      {...pos[corner]}
      {...edges[corner]}
    />
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Map a Meridian feature slug to one of the three product pillars.
 * Source slugs are defined in `apps/api/src/common/helpers/entitlement.ts`
 * (`MeridianFeatureSlug`). New gated features should slot into the
 * matching pillar so the orbital diagram stays diagnostic.
 *
 * Returns `null` for unknown slugs — the modal still renders, just with
 * an all-ghost orbit (no highlighted ring).
 */
function pillarForFeature(
  feature: string,
): "todos" | "habits" | "journal" | null {
  if (feature === "max_habits") return "habits";
  if (feature === "max_todo_lists" || feature === "max_active_todos")
    return "todos";
  if (feature.startsWith("max_journal")) return "journal";
  return null;
}

function prettyPillar(pillar: "todos" | "habits" | "journal" | null): string {
  switch (pillar) {
    case "todos":
      return "Todos";
    case "habits":
      return "Habits";
    case "journal":
      return "Journal";
    default:
      return "Other";
  }
}

function buildBody(
  featureLabel: string,
  planName: string,
  currentLimit: number | undefined,
): string {
  if (typeof currentLimit === "number") {
    return `Your Free plan includes ${currentLimit} ${featureLabel}. Upgrade to ${planName} for unlimited ${featureLabel} and no usage caps.`;
  }
  return `This feature is available on the ${planName} plan. Upgrade to unlock it.`;
}
