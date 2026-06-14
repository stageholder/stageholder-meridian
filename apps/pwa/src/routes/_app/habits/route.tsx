import { useState } from "react";
import { Outlet, createFileRoute } from "@tanstack/react-router";
import { ListFilter } from "lucide-react";
import { HabitsSidebar } from "@/components/habits/habits-sidebar";
import {
  Button,
  Drawer,
  Hide,
  Show,
  View,
  VisuallyHidden,
  XStack,
  YStack,
} from "@stageholder/ui";

export const Route = createFileRoute("/_app/habits")({
  component: HabitsLayout,
});

/**
 * Habits layout — mirrors the todos layout (`_app/todos/route.tsx`): a desktop
 * secondary sidebar (groups + All habits + Archived) beside the routed content,
 * and a left Drawer on mobile triggered from a "Groups" bar. The index, the
 * per-group view, and the archived view all render through `<Outlet/>`.
 */
function HabitsLayout() {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <XStack height="100%">
      {/* Desktop sidebar */}
      <Show above="md">
        <View
          height="100%"
          width={256}
          shrink={0}
          borderRightWidth={1}
          borderColor="$borderColor"
        >
          <HabitsSidebar />
        </View>
      </Show>

      {/* Mobile drawer sidebar */}
      <Hide above="md">
        <Drawer open={sheetOpen} onOpenChange={setSheetOpen}>
          <Drawer.Portal>
            <Drawer.Overlay />
            <Drawer.Content side="left" width={256} p={0}>
              <VisuallyHidden>
                <Drawer.Title>Habit Groups</Drawer.Title>
              </VisuallyHidden>
              <HabitsSidebar onNavigate={() => setSheetOpen(false)} />
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer>
      </Hide>

      {/* Main content */}
      <YStack flex={1} minH={0}>
        {/* Mobile sidebar trigger */}
        <Hide above="md">
          <XStack
            height={40}
            shrink={0}
            items="center"
            borderBottomWidth={1}
            borderColor="$borderColor"
            px="$4"
          >
            <Button
              intent="ghost"
              size="sm"
              icon={<ListFilter size={16} />}
              onPress={() => setSheetOpen(true)}
            >
              Groups
            </Button>
          </XStack>
        </Hide>
        <Outlet />
      </YStack>
    </XStack>
  );
}
