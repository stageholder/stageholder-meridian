import { Text, View, XStack } from "@stageholder/ui";

const moods = [
  { value: 1, label: "Terrible", emoji: "\u{1F622}" },
  { value: 2, label: "Bad", emoji: "\u{1F641}" },
  { value: 3, label: "Okay", emoji: "\u{1F610}" },
  { value: 4, label: "Good", emoji: "\u{1F642}" },
  { value: 5, label: "Great", emoji: "\u{1F604}" },
];

interface MoodPickerProps {
  value?: number;
  onChange: (mood: number) => void;
}

export function MoodPicker({ value, onChange }: MoodPickerProps) {
  return (
    <XStack items="center" gap="$2">
      {moods.map((mood) => {
        const selected = value === mood.value;
        return (
          <View
            key={mood.value}
            onPress={() => onChange(mood.value)}
            cursor="pointer"
            height={40}
            width={40}
            items="center"
            justify="center"
            rounded="$lg"
            borderWidth={2}
            transition="quick"
            borderColor={selected ? "$primary" : "transparent"}
            bg={selected ? "$primaryMuted" : "transparent"}
            hoverStyle={selected ? undefined : { bg: "$accent" }}
            title={mood.label}
            role="button"
            aria-label={mood.label}
          >
            <Text fontSize="$7">{mood.emoji}</Text>
          </View>
        );
      })}
    </XStack>
  );
}

export function MoodDisplay({ mood }: { mood?: number }) {
  if (!mood) return null;
  const moodData = moods.find((m) => m.value === mood);
  if (!moodData) return null;

  return (
    <Text fontSize="$6" title={moodData.label}>
      {moodData.emoji}
    </Text>
  );
}
