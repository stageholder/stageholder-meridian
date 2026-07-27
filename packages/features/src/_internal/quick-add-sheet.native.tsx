// packages/features/src/_internal/quick-add-sheet.native.tsx  (NATIVE)
//
// Compact "quick-add" shell for the native create flows (todo + habit).
// Wraps the kit FormSheet for its keyboard-stretch handling, but renders a
// MINIMAL body: a primary field + a horizontally-scrolling pill row with a
// pinned accent send button. Todoist-style quick capture — one thing to type,
// everything else a pill. Reset is by state (the host owns it); no
// LazyBody / skeleton / epoch keys / mountChildren juggling here.
import type { ReactNode } from "react";
import { ArrowUp, Check } from "@tamagui/lucide-icons-2";
import {
  FormSheet,
  IconButton,
  Pill,
  Sheet,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";

export interface QuickAddSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Category accent (todo-orange / habit-color) — resolved hex on native. */
  accentColor: string;
  /** Fires the create. Does NOT auto-close — the host closes on success. */
  onSubmit: () => void;
  submitting?: boolean;
  submitDisabled?: boolean;
  /** Primary field slot (smart title / icon+name) + any inline-expanded Note. */
  field: ReactNode;
  /** Pill row content (Select pills, QuickDatePicker, QuickAddPill…). */
  pills: ReactNode;
}

export function QuickAddSheet({
  open,
  onOpenChange,
  title,
  accentColor,
  onSubmit,
  submitting,
  submitDisabled,
  field,
  pills,
}: QuickAddSheetProps) {
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      // No title/header — the field's placeholder carries the prompt. The create
      // action is a send button pinned bottom-right (iOS compose style). Reset is
      // by state in the host. `pb` restores the breathing room the hidden footer
      // removed.
      hideFooter
    >
      <YStack gap="$3" pb="$6">
        {/* Primary field — the placeholder is the only prompt now. */}
        {field}

        {/* Pills + create button on ONE row, vertically centered. The pills
            scroll horizontally in the remaining width (minWidth 0 lets the
            flex child shrink so the ScrollView is bounded); the accent send
            button is pinned at the right, aligned with the pills. IconButton
            renders its glyph as CHILDREN (it has no `icon` prop). */}
        <XStack items="center" gap="$2">
          <View flex={1} minWidth={0}>
            <FormSheet.HorizontalScroll>{pills}</FormSheet.HorizontalScroll>
          </View>
          <IconButton
            circular
            size="lg"
            aria-label={`Create ${title}`}
            borderWidth={0}
            style={{ backgroundColor: accentColor }}
            pressStyle={
              { backgroundColor: accentColor, opacity: 0.82 } as never
            }
            disabled={submitDisabled || submitting}
            loading={submitting}
            onPress={onSubmit}
          >
            <ArrowUp size={20} color={"#ffffff" as never} />
          </IconButton>
        </XStack>
      </YStack>
    </FormSheet>
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
  return (
    <Sheet
      modal
      open={open}
      onOpenChange={onOpenChange}
      snapPointsMode="fit"
      dismissOnSnapToBottom
      transition="medium"
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
      </Sheet.Frame>
    </Sheet>
  );
}
