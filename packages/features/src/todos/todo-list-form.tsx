import { useState } from "react";
import { Form } from "tamagui";
import {
  Button,
  Input,
  Label,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";

/**
 * The cross-platform shape of the create/edit-list form values. The host
 * maps these to its create or update mutation as appropriate.
 */
export interface TodoListFormValues {
  name: string;
  color: string;
}

/** Default seed for a brand-new list (create flow). */
export const TODO_LIST_FORM_DEFAULTS: TodoListFormValues = {
  name: "",
  color: "#3b82f6",
};

/**
 * The palette mirrors the create-list dialog's original swatch set.
 * Exported so hosts (or future consumers) can render the same options
 * outside the dialog (e.g. in a list-customization sheet on mobile).
 */
export const TODO_LIST_COLOR_OPTIONS = [
  { value: "#ef4444", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#eab308", label: "Yellow" },
  { value: "#22c55e", label: "Green" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
  { value: "#6b7280", label: "Gray" },
];

export interface TodoListFormProps {
  /** Initial values to seed the form with. */
  initial: TodoListFormValues;
  /** Submit-button text in the resting state ("Create", "Save"). */
  submitLabel: string;
  /** Submit-button text while the host's mutation is in-flight. */
  submittingLabel: string;
  /** Disables the submit button + shows the inline spinner. */
  isSubmitting?: boolean;
  /** Fired on form submit when the name is non-empty. */
  onSubmit: (values: TodoListFormValues) => void | Promise<void>;
  /** Fired on Cancel press. */
  onCancel: () => void;
}

/**
 * Cross-platform create/edit list form — shared by the PWA's create-list
 * dialog (and the future mobile equivalent). Pure presentational +
 * controlled fields; the host owns the surrounding chrome (Dialog,
 * Sheet, full-screen page) and the create/update mutation. Follows the
 * same template as `HabitForm`: re-mount via `key` for reset semantics.
 */
export function TodoListForm({
  initial,
  submitLabel,
  submittingLabel,
  isSubmitting,
  onSubmit,
  onCancel,
}: TodoListFormProps) {
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color);

  function handleSubmit() {
    if (!name.trim()) return;
    void onSubmit({ name: name.trim(), color });
  }

  return (
    <Form onSubmit={handleSubmit} width="100%">
      <YStack gap="$4">
        <YStack gap="$1">
          <Label htmlFor="todo-list-form-name">Name</Label>
          <Input
            id="todo-list-form-name"
            value={name}
            onChangeText={setName}
            placeholder="My List"
            autoFocus
          />
        </YStack>

        <YStack gap="$2">
          <Text fontSize="$3" fontWeight="500" color="$color">
            Color
          </Text>
          <XStack gap="$2">
            {TODO_LIST_COLOR_OPTIONS.map((opt) => (
              <View
                key={opt.value}
                onPress={() => setColor(opt.value)}
                cursor="pointer"
                width={28}
                height={28}
                rounded={9999}
                borderWidth={2}
                transition="quick"
                borderColor={color === opt.value ? "$color" : "transparent"}
                scale={color === opt.value ? 1.1 : 1}
                style={{ backgroundColor: opt.value }}
                aria-label={opt.label}
                aria-pressed={color === opt.value}
                role="button"
              />
            ))}
          </XStack>
        </YStack>

        <XStack justify="flex-end" gap="$3" pt="$2">
          <Button intent="outline" type="button" onPress={onCancel}>
            Cancel
          </Button>
          <Form.Trigger asChild>
            <Button
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
