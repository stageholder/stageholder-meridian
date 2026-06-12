// NATIVE timezone picker — trigger + DRIVEN modal Sheet, replacing the web
// sibling's Combobox. The Combobox's Adapt→Sheet path uses `fit` snap mode,
// which with a 75+ row list grows past the full screen (the "covers the
// whole app" bug); the native sheet rules want a CONSTANT px sheet with a
// ScrollView inside (the CalendarSheet/EmojiPickerSheet pattern).
//
// Anatomy: bordered trigger row (value or placeholder + chevron) → modal
// Sheet at a fixed 560px with title, a search field, and the scrollable
// zone list. Tapping a row selects + closes. Search matches separator-free
// too ("new york" → America/New_York).

import { useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "@tamagui/lucide-icons-2";
import { Input, Sheet, Text, View, XStack, YStack } from "@stageholder/ui";
import { getTimezones } from "./timezone-data";

export interface TimezoneSelectProps {
  value: string;
  onValueChange: (value: string) => void;
}

const SHEET_HEIGHT = 560;

export function TimezoneSelect({ value, onValueChange }: TimezoneSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const zones = useMemo(() => getTimezones(value), [value]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return zones;
    return zones.filter(
      (tz) =>
        tz.toLowerCase().includes(q) ||
        tz.replace(/[_/]/g, " ").toLowerCase().includes(q),
    );
  }, [zones, query]);

  function select(tz: string) {
    onValueChange(tz);
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      {/* Trigger — Select-style bordered row. */}
      <XStack
        role="button"
        aria-label="Select timezone"
        items="center"
        justify="space-between"
        gap="$2"
        borderWidth={1}
        borderColor="$borderColor"
        bg="$background"
        rounded="$3"
        px="$3"
        height={44}
        pressStyle={{ bg: "$accent" }}
        onPress={() => setOpen(true)}
      >
        <Text
          flex={1}
          minW={0}
          numberOfLines={1}
          fontSize="$3"
          color={value ? "$color" : "$mutedForeground"}
        >
          {value || "Select timezone..."}
        </Text>
        <ChevronDown size={16} color="$mutedForeground" />
      </XStack>

      {/* Nested-sheet config mirrors the kit's EmojiPickerSheet EXACTLY —
          the device-proven sheet-from-inside-a-FormSheet precedent:
          `transition` on the root (opts the slide into the driver; without
          it the frame never animates on-screen), CONSTANT px snap (never
          percent/fit with a long list), disableRemoveScroll, and the
          scrollable list inside a flex container. */}
      <Sheet
        modal
        transition="medium"
        open={open}
        onOpenChange={(next: boolean) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
        snapPointsMode="constant"
        snapPoints={[SHEET_HEIGHT]}
        dismissOnSnapToBottom
        disableRemoveScroll
      >
        <Sheet.Overlay />
        <Sheet.Frame pt={0}>
          <YStack gap="$3" pb="$4" flex={1}>
            <Text fontSize="$5" fontWeight="600" color="$color">
              Timezone
            </Text>

            <XStack
              items="center"
              gap="$2"
              borderWidth={1}
              borderColor="$borderColor"
              rounded="$3"
              px="$2.5"
            >
              <Search size={14} color="$mutedForeground" />
              <Input
                flex={1}
                size="sm"
                value={query}
                onChangeText={setQuery}
                placeholder="Search timezones…"
                autoCapitalize="none"
                autoCorrect={false}
                // Bare inline field — the row provides the chrome.
                borderWidth={0}
                bg="transparent"
                px={0}
                focusVisibleStyle={{ outlineWidth: 0 }}
              />
            </XStack>

            {/* keyboardShouldPersistTaps so a row tap lands while the
                search keyboard is up. */}
            <View flex={1}>
              <Sheet.ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <YStack pb="$4">
                  {filtered.length === 0 ? (
                    <Text fontSize="$2" color="$mutedForeground" py="$3">
                      No timezones match “{query.trim()}”.
                    </Text>
                  ) : (
                    filtered.map((tz) => {
                      const selected = tz === value;
                      return (
                        <XStack
                          key={tz}
                          items="center"
                          justify="space-between"
                          gap="$2"
                          py="$2.5"
                          px="$2"
                          rounded="$3"
                          bg={selected ? "$accent" : "transparent"}
                          pressStyle={{ bg: "$muted" }}
                          onPress={() => select(tz)}
                        >
                          <Text
                            flex={1}
                            minW={0}
                            numberOfLines={1}
                            fontSize="$3"
                            fontWeight={selected ? "600" : "400"}
                            color="$color"
                          >
                            {tz}
                          </Text>
                          {selected ? (
                            <Check size={14} color="$primary" />
                          ) : null}
                        </XStack>
                      );
                    })
                  )}
                </YStack>
              </Sheet.ScrollView>
            </View>
          </YStack>
        </Sheet.Frame>
      </Sheet>
    </>
  );
}
