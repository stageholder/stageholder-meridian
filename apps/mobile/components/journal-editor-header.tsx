// apps/mobile/components/journal-editor-header.tsx
//
// Native stack header for the journal editor screens (new + entry detail):
//   - title with the autosave state underneath ("Saving…" / "Saved" /
//     "Not saved") — the shared JournalEditor never rendered `saveStatus` on
//     native, so writers had no idea whether their text was persisted;
//   - "Done" that WAITS for the save before leaving, and on failure keeps the
//     writer on the screen with Retry / Discard instead of silently dropping
//     the text;
//   - an optional "More" menu (delete / discard).

import { Text, YStack } from "@stageholder/ui";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { KeyboardController } from "react-native-keyboard-controller";

import {
  HeaderActions,
  type HeaderMenuAction,
} from "@/components/header-actions";
import type { SaveStatus } from "@/lib/use-autosave";

const STATUS_LABEL: Record<SaveStatus, string | null> = {
  idle: null,
  saving: "Saving…",
  saved: "Saved",
  error: "Not saved",
};

export function JournalEditorHeader({
  title,
  status,
  flush,
  menu,
}: {
  title: string;
  status: SaveStatus;
  flush: () => Promise<boolean>;
  menu?: HeaderMenuAction[];
}) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  const leave = () => {
    // The editor is a WebView: RN's Keyboard.dismiss() can't close its
    // keyboard, which then stayed up over the list after leaving.
    void KeyboardController.dismiss();
    if (router.canGoBack()) router.back();
    else router.replace("/journal");
  };

  async function done() {
    setLeaving(true);
    try {
      if (await flush()) {
        leave();
        return;
      }
      Alert.alert(
        "Couldn't save your entry",
        "Your latest changes haven't reached the server. Check your connection and try again.",
        [
          { text: "Keep editing", style: "cancel" },
          {
            text: "Leave without saving",
            style: "destructive",
            onPress: leave,
          },
          { text: "Try again", onPress: () => void done() },
        ],
      );
    } finally {
      setLeaving(false);
    }
  }

  const statusLabel = STATUS_LABEL[status];

  return (
    <HeaderActions
      headerTitle={() => (
        <YStack items="center">
          <Text fontSize="$4" fontWeight="600" color="$color">
            {title}
          </Text>
          {statusLabel ? (
            <Text
              fontSize="$1"
              color={status === "error" ? "$destructive" : "$mutedForeground"}
            >
              {statusLabel}
            </Text>
          ) : null}
        </YStack>
      )}
      primary={{
        label: "Done",
        onPress: () => void done(),
        disabled: leaving,
      }}
      menu={menu}
    />
  );
}
