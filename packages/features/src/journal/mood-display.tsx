import { Text } from "@stageholder/ui";
import { MOOD_DEFAULT_OPTIONS } from "@stageholder/ui";

export interface MoodDisplayProps {
  /** 1–5 mood value from the kit's `MOOD_DEFAULT_OPTIONS` scale. */
  mood?: number;
}

/**
 * Read-only emoji rendering of a journal entry's mood. Returns `null`
 * when no mood is set so callers can render it unconditionally without
 * adding their own guard.
 *
 * Reuses the kit's `MOOD_DEFAULT_OPTIONS` (the same scale `<MoodPicker>`
 * defaults to) so the display emoji always matches what the user saw
 * when they picked the mood. For the interactive picker, import
 * `MoodPicker` directly from `@stageholder/ui`.
 */
export function MoodDisplay({ mood }: MoodDisplayProps) {
  if (!mood) return null;
  const option = MOOD_DEFAULT_OPTIONS.find((m) => m.value === mood);
  if (!option) return null;

  return (
    // DOM `title` tooltip attr isn't in the kit Text prop type (web-only,
    // passed through at runtime) — rides a spread cast.
    <Text fontSize="$6" {...({ title: option.label } as object)}>
      {option.emoji}
    </Text>
  );
}
