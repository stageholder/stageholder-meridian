// Section header for todo / habit / journal lists — ONE look everywhere
// (Todos tab, calendar day agenda, PWA agenda): uppercase label · count, a
// hairline to the right. Pass `onToggle` to make it a collapsible header
// (chevron, pressable, `open` drives the chevron). Pure Tamagui, so it
// renders the same on web and native.

import { ChevronDown } from "@tamagui/lucide-icons-2/icons/ChevronDown";
import { ChevronRight } from "@tamagui/lucide-icons-2/icons/ChevronRight";
import { Separator, Text, View, XStack } from "@stageholder/ui";

export interface SectionHeaderProps {
  label: string;
  count?: number;
  /** Overdue-style red label. */
  destructive?: boolean;
  /** Collapsible: current state (chevron down = open). */
  open?: boolean;
  /** Collapsible: tap handler. Omit for a static header. */
  onToggle?: () => void;
}

export function SectionHeader({
  label,
  count,
  destructive,
  open,
  onToggle,
}: SectionHeaderProps) {
  const color = destructive ? "$destructive" : "$mutedForeground";
  const collapsible = !!onToggle;
  return (
    <XStack
      items="center"
      gap="$2"
      px="$2.5"
      pt="$3"
      pb="$2"
      {...(collapsible
        ? {
            onPress: onToggle,
            cursor: "pointer" as const,
            pressStyle: { opacity: 0.7 },
            role: "button" as const,
            "aria-expanded": !!open,
            "aria-label": `${open ? "Collapse" : "Expand"} ${label}`,
          }
        : {})}
    >
      {collapsible ? (
        <Text color={color} lineHeight={0}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </Text>
      ) : null}
      <Text
        fontSize="$1"
        fontWeight="600"
        color={color}
        letterSpacing={0.6}
        textTransform="uppercase"
      >
        {count == null ? label : `${label} · ${count}`}
      </Text>
      <View flex={1}>
        <Separator />
      </View>
    </XStack>
  );
}
