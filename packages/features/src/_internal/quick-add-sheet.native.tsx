// packages/features/src/_internal/quick-add-sheet.native.tsx  (NATIVE)
//
// Compact "quick-add" BODY for the native create flows (todo + habit): a
// primary field + a horizontally-scrolling pill row with a pinned accent send
// button. Todoist-style quick capture — one thing to type, everything else a
// pill. The hosts render it inside the app-owned ComposerSheet (kit Sheet + a
// keyboard spacer); the sheet's `open` policy unmounts this body at close, so
// the state components that render it start fresh on every open.
import type { ReactNode } from "react";

import { useAndroidBackClose } from "./use-android-back-close";
import { ArrowUp } from "@tamagui/lucide-icons-2/icons/ArrowUp";
import { Check } from "@tamagui/lucide-icons-2/icons/Check";
import {
  FormSheet,
  Spinner,
  Pill,
  Sheet,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { KeyboardSpacer } from "./composer-sheet.native";

export interface QuickAddBodyProps {
  title: string;
  /** Category accent (todo-orange / habit-color) — resolved hex on native. */
  accentColor: string;
  /** Fires the create. Does NOT auto-close — the host closes on success. */
  onSubmit: () => void;
  submitting?: boolean;
  submitDisabled?: boolean;
  /** Primary field slot (smart title / icon+name) + any inline-expanded Note. */
  field: ReactNode;
  /** Pill row content (QuickAddPill, DatePill…). */
  pills: ReactNode;
  /**
   * Picker sheets, rendered INSIDE the composer sheet (not as siblings):
   * Tamagui gives a sheet nested in another sheet `parentSheet.zIndex + 1`,
   * so they stack above this frame by contract. As siblings they relied on
   * portal insertion order and rendered BEHIND the create sheet — the pills
   * looked dead and the calendar peeked out half-hidden (2026-10-21).
   */
  children?: ReactNode;
}

export function QuickAddBody({
  title,
  accentColor,
  onSubmit,
  submitting,
  submitDisabled,
  field,
  pills,
  children,
}: QuickAddBodyProps) {
  return (
    <>
      <YStack gap="$2">
        {/* Primary field — the placeholder is the only prompt now. */}
        {field}

        {/* Pills + create button on ONE row, vertically centered. The pills
            scroll horizontally in the remaining width (minWidth 0 lets the
            flex child shrink so the ScrollView is bounded); the accent send
            button is pinned at the right, aligned with the pills. */}
        <XStack items="center" gap="$2">
          <View flex={1} minWidth={0}>
            {/* `always`: the row is a ScrollView under an OPEN keyboard, and
                RN's ScrollView swallows the first tap on a non-input child to
                dismiss the keyboard (default `never`) — every pill looked
                dead: priority stuck on Low, Note never opened (2026-10-21). */}
            <FormSheet.HorizontalScroll keyboardShouldPersistTaps="always">
              {pills}
            </FormSheet.HorizontalScroll>
          </View>
          {/* Tamagui-pressable View, NOT the kit IconButton: the kit's RN
              Pressable got no touches inside this portaled sheet on Android
              (the send button was dead — nothing could be created). Tamagui
              press events work there (verified on device). */}
          <View
            role="button"
            aria-label={`Create ${title}`}
            aria-disabled={submitDisabled || submitting}
            width={48}
            height={48}
            rounded={9999}
            items="center"
            justify="center"
            opacity={submitDisabled ? 0.45 : 1}
            style={{ backgroundColor: accentColor }}
            pressStyle={{ opacity: 0.82, scale: 0.94 }}
            transition="quick"
            focusStyle={{ outlineWidth: 0 }}
            focusVisibleStyle={{ outlineWidth: 0 }}
            onPress={() => {
              if (!submitDisabled && !submitting) onSubmit();
            }}
          >
            {submitting ? (
              <Spinner size="small" color={"#ffffff" as never} />
            ) : (
              <ArrowUp size={20} color={"#ffffff" as never} />
            )}
          </View>
        </XStack>
      </YStack>
      {children}
    </>
  );
}

export interface QuickAddPillProps {
  icon?: ReactNode;
  label: string;
  onPress: () => void;
}

/**
 * The ONE pill used for EVERY chip in the quick-add row — the kit `Pill`
 * component, nothing hand-rolled. Every pill (Priority/List/Group menus, the
 * date pills via `DatePicker trigger`, Note/Color) renders through this, so
 * they are all the exact same size by construction. No per-component height
 * juggling.
 */
export function QuickAddPill({ icon, label, onPress }: QuickAddPillProps) {
  return (
    // Always the kit Pill's OUTLINE style (transparent bg + border) — the label
    // + leading dot/icon convey the value, so no heavy filled/`selected` state.
    <Pill size="sm" icon={icon} onPress={onPress}>
      {label}
    </Pill>
  );
}
export interface PillPickerOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

/**
 * A nested option sheet a `QuickAddPill` opens (Priority / List / Group). A
 * plain modal `Sheet` rendered as a SIBLING of the create sheet — Tamagui's
 * ParentSheetContext stacks it above automatically (the kit docs-expo
 * "picker-inside-a-form" NestedDemo pattern; no manual zIndex). NOT
 * DropdownMenu, whose Adapt→Sheet mis-renders nested in a FormSheet on native.
 */
export function PillPickerSheet({
  open,
  onOpenChange,
  title,
  options,
  value,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  options: PillPickerOption[];
  value: string;
  onSelect: (value: string) => void;
}) {
  useAndroidBackClose(open, () => onOpenChange(false));
  return (
    <Sheet
      modal
      open={open}
      onOpenChange={onOpenChange}
      snapPointsMode="fit"
      dismissOnSnapToBottom
      transition="medium"
      // Root mounted while closed (`open` policy): a nested sheet whose root
      // mounts in the same commit it opens sometimes showed its overlay but
      // never its frame (second "⋯" open, 2026-10-25) — the kit's lazy root
      // isn't reliable for sheets nested in another sheet. Children still
      // unmount at close, so a closed picker costs only its root.
      mountChildren="open"
    >
      <Sheet.Overlay />
      <Sheet.Frame pt={0} pb="$6" px="$4" gap="$1">
        <Text fontSize="$5" fontWeight="600" color="$color" pb="$2">
          {title}
        </Text>
        {options.map((o) => (
          <XStack
            key={o.value}
            role="button"
            aria-label={o.label}
            onPress={() => {
              onSelect(o.value);
              onOpenChange(false);
            }}
            items="center"
            gap="$3"
            py="$2.5"
            px="$2"
            rounded="$3"
            bg={o.value === value ? "$secondary" : "transparent"}
            pressStyle={{ bg: "$secondary" }}
          >
            {o.icon}
            <Text fontSize="$4" color="$color" flex={1} numberOfLines={1}>
              {o.label}
            </Text>
            {o.value === value ? <Check size={16} color="$primary" /> : null}
          </XStack>
        ))}
        {/* Rises above a keyboard the host leaves up (see KeyboardSpacer). */}
        <KeyboardSpacer />
      </Sheet.Frame>
    </Sheet>
  );
}
