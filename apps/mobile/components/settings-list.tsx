// apps/mobile/components/settings-list.tsx
//
// Grouped-list primitives for Settings — the iOS Settings / Android
// preference-screen idiom: a muted section caption, then a rounded group of
// full-width rows (label · value · chevron), each row one 48pt+ press target
// with pressed-state feedback.

import { Separator, Text, XStack, YStack } from "@stageholder/ui";
import { ChevronRight } from "@tamagui/lucide-icons-2/icons/ChevronRight";
import { ExternalLink } from "@tamagui/lucide-icons-2/icons/ExternalLink";
import { Children, Fragment, isValidElement, type ReactNode } from "react";

export function SettingsGroup({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: string;
  children: ReactNode;
}) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <YStack gap="$1.5">
      {title ? (
        <Text
          px="$4"
          fontSize="$2"
          fontWeight="600"
          color="$mutedForeground"
          textTransform="uppercase"
          letterSpacing={0.5}
        >
          {title}
        </Text>
      ) : null}
      <YStack
        bg="$card"
        rounded="$5"
        overflow="hidden"
        borderWidth={1}
        borderColor="$borderColor"
      >
        {rows.map((row, i) => (
          <Fragment key={row.key ?? i}>
            {i > 0 ? <Separator ml="$4" /> : null}
            {row}
          </Fragment>
        ))}
      </YStack>
      {footer ? (
        <Text px="$4" fontSize="$1" color="$mutedForeground">
          {footer}
        </Text>
      ) : null}
    </YStack>
  );
}

export function SettingsRow({
  label,
  value,
  icon,
  onPress,
  external = false,
  destructive = false,
  disabled = false,
  trailing,
  testID,
}: {
  label: string;
  value?: string;
  icon?: ReactNode;
  onPress?: () => void;
  /** Opens outside the app (browser) — shows ↗ instead of a chevron. */
  external?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  trailing?: ReactNode;
  testID?: string;
}) {
  const interactive = !!onPress && !disabled;
  return (
    <XStack
      testID={testID}
      role={interactive ? "button" : undefined}
      aria-label={label}
      items="center"
      gap="$3"
      px="$4"
      minH={50}
      py="$2.5"
      opacity={disabled ? 0.5 : 1}
      pressStyle={interactive ? { bg: "$muted" } : undefined}
      onPress={interactive ? onPress : undefined}
    >
      {icon}
      <Text
        flex={1}
        fontSize="$4"
        color={destructive ? "$destructive" : "$color"}
        numberOfLines={1}
      >
        {label}
      </Text>
      {value ? (
        <Text
          fontSize="$4"
          color="$mutedForeground"
          numberOfLines={1}
          maxW="55%"
        >
          {value}
        </Text>
      ) : null}
      {trailing}
      {interactive && !trailing ? (
        external ? (
          <ExternalLink size={16} color="$mutedForeground" />
        ) : destructive ? null : (
          <ChevronRight size={18} color="$mutedForeground" />
        )
      ) : null}
    </XStack>
  );
}
