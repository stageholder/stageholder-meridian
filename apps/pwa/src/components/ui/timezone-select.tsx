import { useState, useMemo } from "react";
import { ChevronDownIcon } from "lucide-react";
import { Input, Popover, Text, View, XStack, YStack } from "@stageholder/ui";

interface TimezoneSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

// Kept as a bespoke Popover (not the kit Combobox): the trigger shows the
// selected value as a button (not a typeahead input), and the API contract
// is `onValueChange(tz)` — both consumers (settings/onboarding) rely on it.
// Only the layout is converted to primitives.
export function TimezoneSelect({
  value,
  onValueChange,
  className,
}: TimezoneSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const timezones = useMemo(() => Intl.supportedValuesOf("timeZone"), []);

  const filtered = useMemo(() => {
    if (!search) return timezones;
    const q = search.toLowerCase();
    return timezones.filter((tz) => tz.toLowerCase().includes(q));
  }, [timezones, search]);

  return (
    <Popover open={open} onOpenChange={setOpen} placement="bottom-start">
      <Popover.Trigger asChild>
        <XStack
          tag="button"
          height={36}
          width="100%"
          items="center"
          justify="space-between"
          gap="$2"
          rounded="$md"
          borderWidth={1}
          borderColor="$borderColor"
          bg="transparent"
          px="$3"
          py="$2"
          focusStyle={{ borderColor: "$outlineColor" }}
          className={className}
        >
          <Text
            flex={1}
            text="left"
            numberOfLines={1}
            fontSize="$3"
            color={value ? "$color" : "$mutedForeground"}
          >
            {value || "Select timezone..."}
          </Text>
          <Text shrink={0} opacity={0.5} lineHeight={0} color="$color">
            <ChevronDownIcon size={16} />
          </Text>
        </XStack>
      </Popover.Trigger>
      {/* Override the kit Content's default padding; match trigger width via
          Tamagui's popper anchor-width CSS var (minWidth is the native fallback). */}
      <Popover.Content
        p={0}
        {...({
          minWidth: 220,
          style: { width: "var(--tamagui-popper-anchor-width)" },
        } as object)}
      >
        <View borderBottomWidth={1} borderColor="$borderColor" px="$3" py="$2">
          {/* Chromeless search field: transparent bg + no border so it reads
              as inline text inside the bordered header (matches the original).
              onChange extraction mirrors the kit Combobox (onChangeText is
              unreliable on web in this Tamagui version). */}
          <Input
            value={search}
            placeholder="Search timezone..."
            width="100%"
            bg="transparent"
            borderWidth={0}
            rounded={0}
            px={0}
            height="auto"
            fontSize="$3"
            color="$color"
            autoFocus
            onChange={(e) => {
              const text =
                (
                  e as {
                    target?: { value?: string };
                    nativeEvent?: { text?: string };
                  }
                ).target?.value ??
                (
                  e as {
                    target?: { value?: string };
                    nativeEvent?: { text?: string };
                  }
                ).nativeEvent?.text ??
                "";
              setSearch(text);
            }}
          />
        </View>
        <Popover.ScrollView maxH={240}>
          <YStack p="$1">
            {filtered.length === 0 ? (
              <Text
                px="$2"
                py="$4"
                text="center"
                fontSize="$3"
                color="$mutedForeground"
              >
                No timezone found.
              </Text>
            ) : (
              filtered.map((tz) => (
                <XStack
                  key={tz}
                  tag="button"
                  width="100%"
                  cursor="pointer"
                  items="center"
                  rounded="$sm"
                  px="$2"
                  py="$1.5"
                  bg={value === tz ? "$accent" : "transparent"}
                  hoverStyle={{ bg: "$accent" }}
                  onPress={() => {
                    onValueChange(tz);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Text
                    fontSize="$3"
                    fontWeight={value === tz ? "500" : "400"}
                    color={value === tz ? "$accentForeground" : "$color"}
                  >
                    {tz}
                  </Text>
                </XStack>
              ))
            )}
          </YStack>
        </Popover.ScrollView>
      </Popover.Content>
    </Popover>
  );
}
