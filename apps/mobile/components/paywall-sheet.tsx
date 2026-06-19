// apps/mobile/components/paywall-sheet.tsx
//
// Native paywall — the store-distribution counterpart of the PWA's
// MeridianPaywallModal (apps/pwa/src/components/billing/meridian-paywall-modal).
//
// Gating is SERVER-DRIVEN: the Meridian API returns 402 `{ code:"limit_reached",
// feature, limit }` on over-cap create calls. The API client interceptor
// (lib/api/client.ts) turns that into a `ClientEvents.paywall` DeviceEvent.
// `PaywallHost` listens for it and slides up this sheet with an informed
// "you hit your <feature> limit" message + a route to the store paywall
// (/upgrade), instead of the bare "request failed" toast the mutation would
// otherwise surface.
//
// Mount ONCE inside the Tamagui/Toast provider tree (app/_layout.tsx) — kit
// Sheets portal to the Tamagui root host, so it must sit below TamaguiProvider
// and below StageholderProvider (it reads `useOrg` for the admin gate).

import { useEffect, useState } from "react";
import { DeviceEventEmitter } from "react-native";
import {
  Button,
  Separator,
  Sheet,
  Text,
  XStack,
  YStack,
} from "@stageholder/ui";
import { useOrg } from "@stageholder/sdk/react-native";
import { useRouter } from "expo-router";

import { ClientEvents } from "@/lib/api/client";
import { canManageBilling } from "@/lib/api/hub";

/** The 402 `limit_reached` payload the API client forwards. */
interface PaywallReason {
  feature: string;
  limit: number;
}

type Pillar = "todos" | "habits" | "journal" | null;

/**
 * Map a Meridian feature slug to its product pillar. Mirrors the PWA modal's
 * `pillarForFeature`; source slugs live in the API's entitlement helper.
 */
function pillarForFeature(feature: string): Pillar {
  if (feature === "max_habits") return "habits";
  if (feature === "max_todo_lists" || feature === "max_active_todos")
    return "todos";
  if (feature.startsWith("max_journal")) return "journal";
  return null;
}

function prettyPillar(pillar: Pillar): string {
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

/** Human, pluralized noun for the limit copy ("5 habits", "3 to-do lists"). */
function featureLabel(feature: string): string {
  switch (feature) {
    case "max_habits":
      return "habits";
    case "max_todo_lists":
      return "to-do lists";
    case "max_active_todos":
      return "active to-dos";
    default:
      if (feature.startsWith("max_journal")) return "journal entries";
      return "items";
  }
}

const PLAN_NAME = "Unlimited";

/**
 * Listens for the API client's 402 paywall event and renders the native
 * paywall sheet. Self-contained: holds its own open/reason state so it needs
 * no props — just mount it once in the provider tree.
 */
export function PaywallHost() {
  const router = useRouter();
  const { org } = useOrg();
  const canManage = canManageBilling(org?.role);

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<PaywallReason | null>(null);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      ClientEvents.paywall,
      (detail: PaywallReason) => {
        setReason(detail);
        setOpen(true);
      },
    );
    return () => sub.remove();
  }, []);

  if (!reason) return null;

  const pillar = pillarForFeature(reason.feature);
  const label = featureLabel(reason.feature);

  const goToUpgrade = () => {
    setOpen(false);
    router.push("/upgrade");
  };

  return (
    <Sheet
      modal
      open={open}
      onOpenChange={setOpen}
      dismissOnSnapToBottom
      snapPointsMode="fit"
      // Required on the Sheet root for driven sheets — without it the frame
      // never slides on-screen (overlay-only). See the kit alpha.31 sheet rules.
      transition="medium"
    >
      <Sheet.Overlay />
      {/* pt 0 — kit grabber is the frame's first child with its own margins. */}
      <Sheet.Frame pt={0} pb="$6" px="$4" gap="$4">
        {/* Top strip — "Plan limit reached" + pillar badge */}
        <XStack
          items="center"
          justify="space-between"
          gap="$3"
          pt="$2"
          pb="$3"
          borderBottomWidth={1}
          borderColor="$borderColor"
        >
          <Text fontSize="$2" fontWeight="500" color="$mutedForeground">
            Plan limit reached
          </Text>
          {pillar ? (
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
              <Text fontSize="$1" fontWeight="500" color="$color">
                {prettyPillar(pillar)}
              </Text>
            </XStack>
          ) : null}
        </XStack>

        {/* Title + body */}
        <YStack gap="$2">
          <Text fontSize="$7" fontWeight="700" color="$color">
            You&rsquo;ve hit your {label} limit
          </Text>
          <Text fontSize="$3" color="$mutedForeground">
            Your Free plan includes {reason.limit} {label}. Upgrade to{" "}
            {PLAN_NAME} for unlimited {label} and no usage caps.
          </Text>
        </YStack>

        {/* Ledger — current plan / usage / recommended */}
        <XStack
          flexWrap="wrap"
          gap="$4"
          borderTopWidth={1}
          borderColor="$borderColor"
          pt="$3"
        >
          <LedgerCell label="Current plan" value="Free" />
          <LedgerCell
            label="Used"
            value={`${reason.limit} of ${reason.limit}`}
            mono
          />
          <LedgerCell label="Recommended" value={PLAN_NAME} />
        </XStack>

        {/* CTAs — one primary, one quiet exit (matches the PWA modal). */}
        {!canManage ? (
          <Text
            borderLeftWidth={2}
            borderColor="$borderColor"
            pl="$3"
            fontSize="$2"
            color="$mutedForeground"
          >
            Only owners and admins can change the plan. Ask an admin in your
            organization to upgrade.
          </Text>
        ) : null}
        <YStack gap="$2" pt="$1">
          {canManage ? (
            <Button intent="primary" onPress={goToUpgrade}>
              Upgrade your plan
            </Button>
          ) : null}
          <Button intent="ghost" onPress={() => setOpen(false)}>
            Maybe later
          </Button>
        </YStack>
      </Sheet.Frame>
    </Sheet>
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
    <YStack flex={1} minW={110} gap="$1">
      <Text fontSize="$1" fontWeight="500" color="$mutedForeground">
        {label}
      </Text>
      <Text
        fontSize="$5"
        fontWeight="600"
        color="$color"
        fontFamily={mono ? "$mono" : undefined}
      >
        {value}
      </Text>
    </YStack>
  );
}
