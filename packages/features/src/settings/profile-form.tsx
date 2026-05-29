import { useEffect, useState } from "react";
import { Button, Input, Label, Text, XStack, YStack } from "@stageholder/ui";
// Form isn't re-exported by the kit yet; pull it from the shared tamagui dep.
import { Form } from "tamagui";
import { TimezoneSelect } from "./timezone-select";

export interface ProfileFormProps {
  /** Initial display name from the host's profile fetch (may arrive async). */
  initialName?: string;
  /** Initial timezone (IANA). Empty string when the user hasn't set one. */
  initialTimezone?: string;
  /** True while the host's initial profile fetch is in flight. */
  isLoading?: boolean;
  /**
   * Save the profile to the host's source of truth (e.g. `mutateAsync`).
   * Resolves on success; throws on failure. The view surfaces inline
   * status text (`Saved` / `Save failed. {message}`) from the outcome.
   */
  onSubmit: (data: { displayName: string; timezone: string }) => Promise<void>;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Display name + timezone form for the settings page. Pure presentational —
 * the host fetches the current profile via its SDK and supplies a single
 * `onSubmit` callback wired to the corresponding update mutation.
 *
 * Uses Tamagui `Form` for cross-platform Enter-to-submit (the previous
 * `<form onSubmit>` was web-only). `TimezoneSelect` from the sibling
 * `./timezone-select` so both consumers wire the same kit-`Select` + IANA
 * list.
 */
export function ProfileForm({
  initialName,
  initialTimezone,
  isLoading,
  onSubmit,
}: ProfileFormProps) {
  const [name, setName] = useState<string>(initialName ?? "");
  const [timezone, setTimezone] = useState<string>(initialTimezone ?? "");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [hydrated, setHydrated] = useState<boolean>(!!initialName);

  // Hydrate once when the host's data lands. Won't overwrite the user's
  // typing if they started editing mid-load.
  useEffect(() => {
    if (hydrated || !initialName) return;
    setName(initialName);
    if (initialTimezone) setTimezone(initialTimezone);
    setHydrated(true);
  }, [initialName, initialTimezone, hydrated]);

  async function save() {
    setStatus("saving");
    setErrorMsg("");
    try {
      await onSubmit({ displayName: name, timezone });
      setStatus("saved");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
    }
  }

  if (isLoading) {
    return (
      <Text fontSize="$3" color="$mutedForeground">
        Loading profile…
      </Text>
    );
  }

  return (
    <Form onSubmit={() => void save()} gap="$6">
      <YStack gap="$2">
        <Label htmlFor="profile-name">Display name</Label>
        <Input id="profile-name" value={name} onChangeText={setName} />
      </YStack>

      <YStack gap="$2">
        <Label htmlFor="profile-timezone">Timezone</Label>
        <TimezoneSelect value={timezone} onValueChange={setTimezone} />
      </YStack>

      <XStack items="center" gap="$3">
        <Form.Trigger asChild>
          <Button
            disabled={status === "saving"}
            loading={status === "saving"}
            loadingText="Saving…"
          >
            Save changes
          </Button>
        </Form.Trigger>
        {status === "error" ? (
          <Text fontSize="$1" color="$destructive">
            Save failed. {errorMsg}
          </Text>
        ) : null}
        {status === "saved" ? (
          <Text fontSize="$1" color="$mutedForeground">
            Saved
          </Text>
        ) : null}
      </XStack>
    </Form>
  );
}
