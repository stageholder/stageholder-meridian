// apps/mobile/components/form-sheet-skeleton.tsx
//
// Fallback for `Sheet.LazyBody` in the form sheets (alpha.121 open
// choreography): the sheet slides up immediately showing this silhouette,
// and the real form cross-fades in when the open spring settles. Field-row
// shaped so the swap reads as "form loading", not a layout jump.

import { Skeleton, YStack } from "@stageholder/ui";

export function FormSheetSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <YStack gap="$4" py="$2">
      {Array.from({ length: rows }, (_, i) => (
        <YStack key={i} gap="$2">
          <Skeleton width={90} height={14} rounded="$2" />
          <Skeleton width="100%" height={40} rounded="$4" />
        </YStack>
      ))}
    </YStack>
  );
}
