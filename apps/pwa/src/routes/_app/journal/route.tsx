import {
  Outlet,
  createFileRoute,
  useLocation,
  useParams,
} from "@tanstack/react-router";
import { JournalSidebar } from "@/components/journal/journal-sidebar";
import { EncryptionGate } from "@/components/encryption/encryption-gate";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { View, XStack, YStack } from "@stageholder/ui";

export const Route = createFileRoute("/_app/journal")({
  component: JournalLayout,
});

function JournalLayout() {
  const { pathname } = useLocation();
  // Read `id` non-strictly — only the $id child route provides it.
  const params = useParams({ strict: false }) as { id?: string };
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const isChildRoute = pathname !== "/journal" && pathname !== "/journal/";

  const activeId = params.id;

  return (
    <EncryptionGate>
      <XStack height="100%">
        {/* Left column: sidebar */}
        {(isDesktop || !isChildRoute) && (
          <View
            width="100%"
            shrink={0}
            borderRightWidth={1}
            borderColor="$borderColor"
            $md={{ width: 320 }}
            $lg={{ width: 384 }}
          >
            <JournalSidebar activeId={activeId} />
          </View>
        )}

        {/* Right column: children */}
        {(isDesktop || isChildRoute) && (
          <YStack flex={1} overflow="hidden">
            <Outlet />
          </YStack>
        )}
      </XStack>
    </EncryptionGate>
  );
}
