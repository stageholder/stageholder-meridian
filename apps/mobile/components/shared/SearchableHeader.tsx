// apps/mobile/components/shared/SearchableHeader.tsx
//
// Header row that swaps a title+subtitle for an inline search input when
// the magnifier is tapped. Used by Todos and Habits — wherever a long
// list benefits from text filtering without a full route change.
//
// Search query lives upstream so the screen can filter its data. We
// surface a callback for the query and one for "is search open" so the
// screen can adjust empty-state copy ("no matches" vs "no items").

import {
  H3,
  Input,
  Paragraph,
  Text,
  View,
  XStack,
  YStack,
  useHaptic,
} from "@stageholder/ui";
import { useEffect, useRef } from "react";
import { Pressable, type TextInput } from "react-native";

export type SearchableHeaderProps = {
  title: string;
  subtitle: string;
  query: string;
  onQueryChange: (q: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeholder?: string;
};

export function SearchableHeader({
  title,
  subtitle,
  query,
  onQueryChange,
  open,
  onOpenChange,
  placeholder = "Search…",
}: SearchableHeaderProps) {
  const haptic = useHaptic();
  const inputRef = useRef<TextInput>(null);

  // Autofocus when transitioning to open. RN's TextInput needs an
  // imperative .focus() — autoFocus prop is unreliable across the
  // mount-then-show pattern we use here.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]);

  function openSearch() {
    haptic.selection();
    onOpenChange(true);
  }
  function closeSearch() {
    haptic.selection();
    onQueryChange("");
    onOpenChange(false);
  }

  if (open) {
    return (
      <XStack
        items="center"
        gap="$2"
        px="$3"
        py="$2"
        rounded="$3"
        bg="$color2"
        borderWidth={1}
        borderColor="$color7"
      >
        <Text fontSize={16} color="$color11">
          ⌕
        </Text>
        <Input
          ref={inputRef as never}
          value={query}
          onChangeText={onQueryChange}
          placeholder={placeholder}
          flex={1}
          unstyled
          fontSize="$3"
          color="$color12"
          placeholderTextColor="$color10"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        <Pressable onPress={closeSearch} accessibilityRole="button">
          <View
            width={28}
            height={28}
            rounded={14}
            items="center"
            justify="center"
            bg="$color4"
          >
            <Text fontSize={13} color="$color12" fontWeight="700">
              ✕
            </Text>
          </View>
        </Pressable>
      </XStack>
    );
  }

  return (
    <XStack items="end" justify="space-between" gap="$2">
      <YStack flex={1} gap="$1">
        <Paragraph
          fontFamily="$mono"
          fontSize={11}
          letterSpacing={2}
          textTransform="uppercase"
          color="$color11"
          fontWeight="600"
        >
          {subtitle}
        </Paragraph>
        <H3 color="$color12">{title}</H3>
      </YStack>
      <Pressable onPress={openSearch} accessibilityRole="button">
        <View
          width={40}
          height={40}
          rounded={20}
          items="center"
          justify="center"
          bg="$color2"
          borderWidth={1}
          borderColor="$color6"
          pressStyle={{ bg: "$color4" }}
        >
          <Text fontSize={18} color="$color11">
            ⌕
          </Text>
        </View>
      </Pressable>
    </XStack>
  );
}
