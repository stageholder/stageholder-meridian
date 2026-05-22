import { useState } from "react";
import { usePendingCount, useFailedMutations } from "@repo/offline/hooks";
import { useNetworkStatus } from "@repo/offline/network";
import {
  dismissMutation,
  dismissAllFailed,
  flush,
} from "@repo/offline/sync/mutation-queue";
import apiClient from "@/lib/api-client";
import { tryGetCurrentUserSub } from "@/lib/current-user-sub";
import { Button, Text, View, XStack, YStack } from "@stageholder/ui";

export function OfflineIndicator() {
  const isOnline = useNetworkStatus();
  const pendingCount = usePendingCount();
  const failedMutations = useFailedMutations();
  const [showPopover, setShowPopover] = useState(false);

  const failedCount = failedMutations.length;

  if (isOnline && pendingCount === 0) {
    return null;
  }

  const handleRetry = async () => {
    try {
      await flush(apiClient, tryGetCurrentUserSub() ?? undefined);
    } catch {
      // Errors handled by the queue itself
    }
  };

  const handleDismiss = async (id: number) => {
    await dismissMutation(id);
  };

  const handleDismissAll = async () => {
    await dismissAllFailed();
  };

  if (!isOnline) {
    return (
      <View position="relative">
        <XStack
          items="center"
          gap="$1.5"
          rounded={9999}
          bg="$warningMuted"
          px="$2.5"
          py="$1"
          onPress={() => failedCount > 0 && setShowPopover(!showPopover)}
        >
          <View height={8} width={8} rounded={9999} bg="$warning" />
          <Text fontSize="$1" fontWeight="500" color="$warning">
            Offline
          </Text>
          {pendingCount > 0 && (
            // allowlist: tabular-nums (figure alignment, no token equivalent)
            <Text
              ml="$1"
              fontSize="$1"
              fontWeight="500"
              color="$warning"
              className="tabular-nums"
            >
              ({pendingCount})
            </Text>
          )}
        </XStack>
        {showPopover && failedCount > 0 && (
          <FailedMutationsPopover
            failedMutations={failedMutations}
            onDismiss={handleDismiss}
            onDismissAll={handleDismissAll}
            onRetry={handleRetry}
            onClose={() => setShowPopover(false)}
          />
        )}
      </View>
    );
  }

  // Online but has pending mutations
  return (
    <View position="relative">
      <XStack
        items="center"
        gap="$1.5"
        rounded={9999}
        bg="$primaryMuted"
        px="$2.5"
        py="$1"
        onPress={() => failedCount > 0 && setShowPopover(!showPopover)}
      >
        {/* allowlist: animate-pulse keyframe (globals.css) */}
        <View
          height={8}
          width={8}
          rounded={9999}
          bg="$primary"
          className="animate-pulse"
        />
        <Text fontSize="$1" fontWeight="500" color="$primary">
          {failedCount > 0 ? "Failed" : "Syncing"}
        </Text>
        {/* allowlist: tabular-nums (figure alignment, no token equivalent) */}
        <Text
          fontSize="$1"
          fontWeight="500"
          color="$primary"
          className="tabular-nums"
        >
          ({pendingCount})
        </Text>
      </XStack>
      {showPopover && failedCount > 0 && (
        <FailedMutationsPopover
          failedMutations={failedMutations}
          onDismiss={handleDismiss}
          onDismissAll={handleDismissAll}
          onRetry={handleRetry}
          onClose={() => setShowPopover(false)}
        />
      )}
    </View>
  );
}

function FailedMutationsPopover({
  failedMutations,
  onDismiss,
  onDismissAll,
  onRetry,
  onClose,
}: {
  failedMutations: { id?: number; entityType: string; operation: string }[];
  onDismiss: (id: number) => void;
  onDismissAll: () => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <YStack
      position="absolute"
      r={0}
      t="100%"
      z={50}
      mt="$2"
      width={288}
      rounded="$lg"
      borderWidth={1}
      borderColor="$borderColor"
      bg="$popover"
      p="$3"
      elevation={8}
    >
      <XStack mb="$2" items="center" justify="space-between">
        <Text fontSize="$3" fontWeight="500" color="$popoverForeground">
          Failed Mutations ({failedMutations.length})
        </Text>
        <Text
          fontSize="$1"
          color="$mutedForeground"
          hoverStyle={{ color: "$color" }}
          onPress={onClose}
        >
          Close
        </Text>
      </XStack>
      <YStack maxH={192} gap="$1" overflow="scroll">
        {failedMutations.map((m) => (
          <XStack
            key={m.id}
            items="center"
            justify="space-between"
            rounded="$1"
            bg="$muted"
            px="$2"
            py="$1"
          >
            <Text fontSize="$1" color="$color">
              {m.operation} {m.entityType}
            </Text>
            <Text
              fontSize="$1"
              color="$destructive"
              hoverStyle={{ color: "$destructiveHover" }}
              onPress={() => m.id && onDismiss(m.id)}
            >
              Dismiss
            </Text>
          </XStack>
        ))}
      </YStack>
      <XStack mt="$2" gap="$2">
        <Button size="sm" flex={1} onPress={onRetry}>
          Retry All
        </Button>
        <Button size="sm" intent="secondary" flex={1} onPress={onDismissAll}>
          Dismiss All
        </Button>
      </XStack>
    </YStack>
  );
}
