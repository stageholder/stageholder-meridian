import { useState } from "react";
import { useCreateTodoList } from "@/lib/api/todos";
import { toast } from "sonner";
import {
  Button,
  Input,
  Label,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";

const colorOptions = [
  { value: "#ef4444", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#eab308", label: "Yellow" },
  { value: "#22c55e", label: "Green" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
  { value: "#6b7280", label: "Gray" },
];

interface CreateListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateListDialog({
  open,
  onOpenChange,
}: CreateListDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const createList = useCreateTodoList();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    createList.mutate(
      { name: name.trim(), color },
      {
        onSuccess: () => {
          toast.success("List created");
          setName("");
          setColor("#3b82f6");
          onOpenChange(false);
        },
        onError: () => {
          toast.error("Failed to create list");
        },
      },
    );
  }

  if (!open) return null;

  return (
    <View
      position={"fixed" as never}
      t={0}
      b={0}
      l={0}
      r={0}
      z={50}
      items="center"
      justify="center"
    >
      <View
        position={"fixed" as never}
        t={0}
        b={0}
        l={0}
        r={0}
        // load-bearing modal dimming — translucent black, no token equivalent
        bg="rgba(0,0,0,0.5)"
        onPress={() => onOpenChange(false)}
      />
      <YStack
        position="relative"
        z={50}
        width="100%"
        maxW={384}
        rounded="$6"
        borderWidth={1}
        borderColor="$borderColor"
        bg="$card"
        p="$6"
        gap="$4"
        boxShadow="0 16px 48px rgba(0,0,0,0.45)"
      >
        <Text fontSize="$6" fontWeight="600" color="$color">
          New List
        </Text>
        <form onSubmit={handleSubmit}>
          <YStack gap="$4">
            <YStack gap="$1">
              <Label htmlFor="list-name">Name</Label>
              <Input
                id="list-name"
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
                {colorOptions.map((opt) => (
                  <View
                    key={opt.value}
                    onPress={() => setColor(opt.value)}
                    width={28}
                    height={28}
                    rounded={9999}
                    borderWidth={2}
                    transition="quick"
                    borderColor={color === opt.value ? "$color" : "transparent"}
                    scale={color === opt.value ? 1.1 : 1}
                    style={{ backgroundColor: opt.value }}
                    aria-label={opt.label}
                    role="button"
                  />
                ))}
              </XStack>
            </YStack>

            <XStack justify="flex-end" gap="$3" pt="$2">
              <Button
                intent="outline"
                type="button"
                onPress={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!name.trim() || createList.isPending}
                loading={createList.isPending}
                loadingText="Creating…"
              >
                Create
              </Button>
            </XStack>
          </YStack>
        </form>
      </YStack>
    </View>
  );
}
