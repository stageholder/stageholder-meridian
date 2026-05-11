// apps/mobile/components/journal/DateStrip.tsx
//
// Horizontal previous/next date stepper at the top of the journal screen.
// Tap the center label to jump back to today. Tapping the chevrons walks
// one day at a time.

import {
  Paragraph,
  Text,
  View,
  XStack,
  YStack,
  useHaptic,
} from "@stageholder/ui";

import { localDateKey as dateKey, fromDateKey } from "@/lib/streak";

export type DateStripProps = {
  value: string;
  onChange: (key: string) => void;
};

export function DateStrip({ value, onChange }: DateStripProps) {
  const haptic = useHaptic();
  const date = fromDateKey(value);
  const isToday = value === dateKey();

  function shift(days: number) {
    haptic.selection();
    const d = fromDateKey(value);
    d.setDate(d.getDate() + days);
    onChange(dateKey(d));
  }

  function jumpToday() {
    if (isToday) return;
    haptic.impact("light");
    onChange(dateKey());
  }

  const fmt = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const fullFmt = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <XStack
      items="center"
      justify="space-between"
      px="$2"
      py="$2"
      rounded="$3"
      bg="$color2"
      borderWidth={1}
      borderColor="$color6"
    >
      <ChevronButton onPress={() => shift(-1)} glyph="‹" />
      <YStack flex={1} items="center" cursor="pointer" onPress={jumpToday}>
        <Paragraph
          fontFamily="$mono"
          fontSize={10}
          letterSpacing={1.6}
          textTransform="uppercase"
          color="$color11"
          fontWeight="600"
        >
          {isToday ? "Today" : fmt.format(date)}
        </Paragraph>
        <Text fontSize="$3" color="$color12" fontWeight="600">
          {fullFmt.format(date)}
        </Text>
      </YStack>
      <ChevronButton onPress={() => shift(1)} glyph="›" />
    </XStack>
  );
}

function ChevronButton({
  onPress,
  glyph,
}: {
  onPress: () => void;
  glyph: string;
}) {
  return (
    <View
      width={36}
      height={36}
      rounded="$2"
      items="center"
      justify="center"
      cursor="pointer"
      hoverStyle={{ bg: "$color4" }}
      pressStyle={{ bg: "$color5" }}
      onPress={onPress}
    >
      <Text fontSize="$5" color="$color12">
        {glyph}
      </Text>
    </View>
  );
}
