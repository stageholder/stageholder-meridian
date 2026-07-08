import { useState } from "react";
import { Form, useMedia } from "tamagui";
import {
  Button,
  Input,
  Label,
  MediaGlyph,
  MediaPicker,
  MediaPickerSheet,
  Popover,
  Text,
  View,
  XStack,
  YStack,
  type MediaValue,
} from "@stageholder/ui";
import { encodeMediaIcon, parseMediaIcon } from "./icon-value";

/** Cross-platform create/edit-group form values. */
export interface HabitGroupFormValues {
  name: string;
  color: string;
  icon?: string;
}

/** Default seed for a brand-new group (create flow). */
export const HABIT_GROUP_FORM_DEFAULTS: HabitGroupFormValues = {
  name: "",
  color: "#3b82f6",
  icon: undefined,
};

/** Swatch palette — mirrors the todo-list form so the two read identically. */
export const HABIT_GROUP_COLOR_OPTIONS = [
  { value: "#ef4444", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#eab308", label: "Yellow" },
  { value: "#22c55e", label: "Green" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
  { value: "#6b7280", label: "Gray" },
];

export interface HabitGroupFormProps {
  initial: HabitGroupFormValues;
  submitLabel: string;
  submittingLabel: string;
  isSubmitting?: boolean;
  onSubmit: (values: HabitGroupFormValues) => void | Promise<void>;
  onCancel: () => void;
}

/**
 * Cross-platform create/edit group form — shared by the PWA dialog and the
 * mobile sheet. Pure presentational + controlled; the host owns the chrome
 * and the create/update mutation. Re-mount via `key` for reset semantics.
 *
 * The icon picker is the kit media system (emoji + lucide icon), mirroring
 * habit-form.tsx: an anchored `MediaPicker` Popover at md+ (desktop dialog),
 * and the modal `MediaPickerSheet` below md (mobile FormSheet). A Popover
 * opened inside a Sheet renders behind it — MediaPickerSheet stacks at
 * zIndex 1e5 and clears that correctly. Values persist as a compact string
 * (see icon-value.ts) and render through `MediaGlyph`.
 */
export function HabitGroupForm({
  initial,
  submitLabel,
  submittingLabel,
  isSubmitting,
  onSubmit,
  onCancel,
}: HabitGroupFormProps) {
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color);
  const [icon, setIcon] = useState(initial.icon ?? "");
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  // <md the form lives in a bottom Sheet; Popovers render behind Sheets.
  // Switch to MediaPickerSheet (modal Sheet) below md, anchored Popover at md+.
  const media = useMedia();

  // MediaPicker emits a MediaValue (emoji | icon | image) or null on Remove;
  // encode it into the string `icon` column. `null` clears back to the color
  // dot. The Popover path is manually closed here; MediaPickerSheet self-closes.
  const handlePickIcon = (value: MediaValue | null) => {
    setIcon(encodeMediaIcon(value) ?? "");
    setIconPickerOpen(false);
  };

  // Shared trigger box — passes onPress only on the Sheet path (the Popover
  // asChild path must NOT have a manual onPress; the slot supplies it and a
  // duplicate handler fights the controlled-state toggle — see project memory).
  // Empty state shows the group's color DOT — the SAME resting glyph the sidebar
  // renders for an icon-less group, so "what you pick" reads identically to
  // "what you'll see" (no more smiley-vs-dot mismatch).
  const renderIconTrigger = (onPress?: () => void) => (
    <View
      role="button"
      aria-label={icon ? "Change icon" : "Pick an icon"}
      cursor="pointer"
      height={40}
      width={40}
      shrink={0}
      items="center"
      justify="center"
      rounded="$lg"
      borderWidth={1}
      borderColor="$borderColor"
      bg="$background"
      hoverStyle={{ bg: "$accent" }}
      {...(onPress ? { onPress } : {})}
    >
      <MediaGlyph
        value={parseMediaIcon(icon)}
        size={22}
        color={color}
        fallback={
          <View
            width={18}
            height={18}
            rounded={9999}
            style={{ backgroundColor: color }}
          />
        }
      />
    </View>
  );

  function handleSubmit() {
    if (!name.trim()) return;
    void onSubmit({ name: name.trim(), color, icon: icon || undefined });
  }

  return (
    <Form onSubmit={handleSubmit} width="100%">
      <YStack gap="$4">
        {/* Icon + Name row — mirrors habit-form.tsx's XStack layout. */}
        <XStack gap="$2">
          <YStack>
            <Text fontSize="$3" fontWeight="500" color="$color">
              Icon
            </Text>
            <View mt="$1">
              {media.md ? (
                // Desktop: anchored Popover. No manual z — kit Popover renders
                // above the Dialog at its own default z (matches habit-form.tsx).
                <Popover
                  open={iconPickerOpen}
                  onOpenChange={setIconPickerOpen}
                  placement="bottom-start"
                >
                  <Popover.Trigger asChild>
                    {renderIconTrigger()}
                  </Popover.Trigger>
                  <Popover.Content
                    width="auto"
                    p={0}
                    borderWidth={0}
                    overflow="hidden"
                    style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}
                  >
                    <MediaPicker
                      width={360}
                      height={440}
                      tabs={["emoji", "icon"]}
                      value={parseMediaIcon(icon)}
                      onChange={handlePickIcon}
                    />
                  </Popover.Content>
                </Popover>
              ) : (
                // Mobile: modal Sheet (zIndex 1e5) stacks above the FormSheet.
                <>
                  {renderIconTrigger(() => setIconPickerOpen(true))}
                  <MediaPickerSheet
                    open={iconPickerOpen}
                    onClose={() => setIconPickerOpen(false)}
                    tabs={["emoji", "icon"]}
                    value={parseMediaIcon(icon)}
                    onChange={handlePickIcon}
                  />
                </>
              )}
            </View>
          </YStack>

          <YStack flex={1}>
            <Label htmlFor="habit-group-form-name">Name</Label>
            <Input
              id="habit-group-form-name"
              mt="$1"
              value={name}
              onChangeText={setName}
              placeholder="My Group"
              autoFocus
            />
          </YStack>
        </XStack>

        <YStack gap="$2">
          <Text fontSize="$3" fontWeight="500" color="$color">
            Color
          </Text>
          <XStack gap="$2">
            {/* Destructure to a bare `swatch` — the color must NOT reach the
                JSX `style` as a `.value` MEMBER (worklets babel false-positive). */}
            {HABIT_GROUP_COLOR_OPTIONS.map(({ value: swatch, label }) => (
              <View
                key={swatch}
                onPress={() => setColor(swatch)}
                cursor="pointer"
                width={28}
                height={28}
                rounded={9999}
                borderWidth={2}
                transition="quick"
                borderColor={color === swatch ? "$color" : "transparent"}
                scale={color === swatch ? 1.1 : 1}
                style={{ backgroundColor: swatch }}
                aria-label={label}
                aria-pressed={color === swatch}
                role="button"
              />
            ))}
          </XStack>
        </YStack>

        <XStack gap="$3" pt="$2" $md={{ justify: "flex-end" }}>
          <Button
            intent="outline"
            type="button"
            flex={1}
            $md={{ flexBasis: "auto", grow: 0 }}
            onPress={onCancel}
          >
            Cancel
          </Button>
          <Form.Trigger asChild>
            <Button
              flex={1}
              $md={{ flexBasis: "auto", grow: 0 }}
              disabled={!name.trim() || isSubmitting}
              loading={isSubmitting}
              loadingText={submittingLabel}
            >
              {submitLabel}
            </Button>
          </Form.Trigger>
        </XStack>
      </YStack>
    </Form>
  );
}
