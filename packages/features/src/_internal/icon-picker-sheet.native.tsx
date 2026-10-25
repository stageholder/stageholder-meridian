// packages/features/src/_internal/icon-picker-sheet.native.tsx  (NATIVE)
//
// The icon/emoji picker's sheet — a thin app-owned shell around the kit's
// inline `MediaPicker` (the heavy part stays the kit's: emoji grid, search,
// categories, skin tones, icon registry + colour swatches). Replaces the kit
// `MediaPickerSheet`, whose fixed 560 px frame knows nothing about the
// keyboard: focusing its own search field put the keys over the grid and
// left one row of emoji visible (device feedback 2026-10-25).
//
// Here the frame is `fit`-sized with the app's keyboard spacer last, so the
// sheet rises with the keyboard, and the picker's height shrinks to the
// space above the keys so the whole sheet still fits the screen.

import { useWindowDimensions } from "react-native";
import { useKeyboardState } from "react-native-keyboard-controller";
import { X } from "@tamagui/lucide-icons-2/icons/X";
import { Sheet, Text, View, XStack } from "@stageholder/ui";
import {
  MediaPicker,
  type MediaTab,
  type MediaValue,
} from "@stageholder/ui/pickers";

import { KeyboardSpacer } from "./composer-sheet.native";
import { useAndroidBackClose } from "./use-android-back-close";

/** Picker height with no keyboard (the kit sheet's 560 minus its chrome). */
const PICKER_HEIGHT = 500;
/** Sheet chrome above the picker (grabber + title row) plus bottom padding. */
const CHROME = 110;
const MIN_PICKER_HEIGHT = 240;

export interface IconPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  tabs?: MediaTab[];
  value: MediaValue | null;
  /** Pick-to-apply: a pick (or Remove = null) applies and closes. */
  onChange: (value: MediaValue | null) => void;
}

export function IconPickerSheet({
  open,
  onOpenChange,
  title = "Pick an icon",
  tabs,
  value,
  onChange,
}: IconPickerSheetProps) {
  useAndroidBackClose(open, () => onOpenChange(false));
  const { height: screen } = useWindowDimensions();
  // Keyboard-controller's own tracking (fresh: the picker's search field is
  // what raises this keyboard). One re-render per show/hide.
  const keyboard = useKeyboardState((s) => (s.isVisible ? s.height : 0));
  const pickerHeight =
    keyboard > 0
      ? Math.max(
          MIN_PICKER_HEIGHT,
          Math.min(PICKER_HEIGHT, screen - keyboard - CHROME),
        )
      : PICKER_HEIGHT;

  return (
    <Sheet
      modal
      open={open}
      onOpenChange={onOpenChange}
      transition="medium"
      snapPointsMode="fit"
      dismissOnSnapToBottom
      disableRemoveScroll
      mountChildren="open"
    >
      <Sheet.Overlay />
      <Sheet.Frame px="$3" pt={0} pb="$3" gap={0}>
        <XStack items="center" justify="center" position="relative" py="$2">
          <Text fontSize="$4" fontWeight="600" color="$color">
            {title}
          </Text>
          <View
            role="button"
            aria-label="Close picker"
            position="absolute"
            r={0}
            width={30}
            height={30}
            rounded={9999}
            items="center"
            justify="center"
            hitSlop={8}
            pressStyle={{ bg: "$muted" }}
            onPress={() => onOpenChange(false)}
          >
            <X size={17} color="$mutedForeground" />
          </View>
        </XStack>
        <MediaPicker
          bare
          {...(tabs ? { tabs } : {})}
          value={value}
          onChange={(next) => {
            onChange(next);
            onOpenChange(false);
          }}
          width="100%"
          height={pickerHeight}
        />
        {/* Rises above the keyboard the picker's own search field raises. */}
        <KeyboardSpacer chrome={12} />
      </Sheet.Frame>
    </Sheet>
  );
}
