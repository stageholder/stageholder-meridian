import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "@tamagui/lucide-icons-2";
import { Text, XStack, YStack } from "@stageholder/ui";

/**
 * Collapsible "Completed" / "Done" group for the calendar day-agenda — a
 * chevron + uppercase label + count header that expands to reveal its
 * children. Shared by the PWA and native agendas (pure Tamagui v2, so it
 * renders + animates identically on both). Renders nothing when `count` is 0.
 *
 * Starts collapsed by default (`defaultOpen` to override) — finished items are
 * tucked away so the agenda leads with what's still pending.
 */
export function CollapsibleGroup({
  label,
  count,
  defaultOpen = false,
  children,
}: {
  label: string;
  count: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;
  return (
    <YStack gap="$1">
      <XStack
        onPress={() => setOpen((v) => !v)}
        cursor="pointer"
        items="center"
        gap="$1.5"
        rounded="$md"
        py="$1"
        transition="quick"
        hoverStyle={{ bg: "$accent" }}
        pressStyle={{ opacity: 0.7 }}
        role="button"
        aria-expanded={open}
      >
        <Text color="$mutedForeground" lineHeight={0}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </Text>
        <Text
          fontSize="$1"
          fontWeight="600"
          color="$mutedForeground"
          textTransform="uppercase"
          letterSpacing={0.5}
        >
          {label}
        </Text>
        <Text fontSize="$1" color="$mutedForeground">
          {count}
        </Text>
      </XStack>
      {open ? <YStack gap="$2">{children}</YStack> : null}
    </YStack>
  );
}
