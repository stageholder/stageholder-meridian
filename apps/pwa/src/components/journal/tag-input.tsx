import { useState, type KeyboardEvent } from "react";
import { X, Tag } from "lucide-react";
import { Input, Label, Text, View, XStack } from "@stageholder/ui";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  /** Render as a small inline pill trigger instead of full bordered input */
  inline?: boolean;
}

export function TagInput({ tags, onChange, inline }: TagInputProps) {
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag]);
    }
    setInput("");
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    }
    if (e.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]!);
    }
    if (e.key === "Escape") {
      setIsOpen(false);
      if (input.trim()) addTag(input);
    }
  }

  if (inline) {
    if (!isOpen) {
      return (
        <XStack
          onPress={() => setIsOpen(true)}
          items="center"
          gap="$1"
          rounded={9999}
          borderWidth={1}
          borderStyle="dashed"
          borderColor="$borderColor"
          px="$2"
          py="$0.5"
          cursor="pointer"
          transition="quick"
          hoverStyle={{ borderColor: "$mutedForeground" }}
          role="button"
        >
          <Text color="$mutedForeground" lineHeight={0}>
            <Tag size={10} />
          </Text>
          <Text fontSize="$1" color="$mutedForeground">
            Tag
          </Text>
        </XStack>
      );
    }

    return (
      <Input
        value={input}
        onChangeText={setInput}
        {...({ onKeyDown: handleKeyDown } as object)}
        onBlur={() => {
          if (input.trim()) addTag(input);
          setIsOpen(false);
        }}
        autoFocus
        placeholder="Add tag..."
        size="$2"
        width={80}
        rounded={9999}
      />
    );
  }

  return (
    <View>
      <Label>Tags</Label>
      <XStack
        mt="$1"
        flexWrap="wrap"
        items="center"
        gap="$1.5"
        rounded="$lg"
        borderWidth={1}
        borderColor="$borderColor"
        bg="$background"
        px="$3"
        py="$2"
      >
        {tags.map((tag) => (
          <XStack
            key={tag}
            items="center"
            gap="$1"
            rounded={9999}
            bg="$accent"
            px="$2"
            py="$0.5"
          >
            <Text fontSize="$1" color="$accentForeground">
              {tag}
            </Text>
            <View
              onPress={() => removeTag(tag)}
              cursor="pointer"
              role="button"
              aria-label={`Remove ${tag}`}
            >
              <Text
                color="$mutedForeground"
                lineHeight={0}
                hoverStyle={{ color: "$color" }}
              >
                <X size={12} />
              </Text>
            </View>
          </XStack>
        ))}
        <Input
          flex={1}
          minW={80}
          value={input}
          onChangeText={setInput}
          {...({ onKeyDown: handleKeyDown } as object)}
          onBlur={() => {
            if (input.trim()) addTag(input);
          }}
          placeholder={tags.length === 0 ? "Add tags..." : ""}
          fontSize="$3"
          color="$color"
          bg="transparent"
          borderWidth={0}
          px={0}
          py={0}
          focusVisibleStyle={{ outlineWidth: 0 }}
        />
      </XStack>
    </View>
  );
}
