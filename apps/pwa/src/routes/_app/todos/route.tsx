import { useState } from "react";
import { Outlet, createFileRoute } from "@tanstack/react-router";
import { ListFilter } from "lucide-react";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { TodoListSidebar } from "@/components/todos/todo-list-sidebar";
import { Drawer, Text, View, XStack, YStack } from "@stageholder/ui";

export const Route = createFileRoute("/_app/todos")({
  component: TodosLayout,
});

function TodosLayout() {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <XStack height="100%">
      {/* Desktop sidebar */}
      {isDesktop && (
        <View
          height="100%"
          width={256}
          shrink={0}
          borderRightWidth={1}
          borderColor="$borderColor"
        >
          <TodoListSidebar />
        </View>
      )}

      {/* Mobile sheet sidebar */}
      {!isDesktop && (
        <Drawer open={sheetOpen} onOpenChange={setSheetOpen}>
          <Drawer.Portal>
            <Drawer.Overlay />
            <Drawer.Content side="left" width={256} p={0}>
              <Drawer.Title className="sr-only">Todo Lists</Drawer.Title>
              <TodoListSidebar onNavigate={() => setSheetOpen(false)} />
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer>
      )}

      {/* Main content */}
      <YStack flex={1} minH={0}>
        {/* Mobile sidebar trigger */}
        {!isDesktop && (
          <XStack
            height={40}
            shrink={0}
            items="center"
            borderBottomWidth={1}
            borderColor="$borderColor"
            px="$4"
          >
            <XStack
              tag="button"
              items="center"
              gap="$2"
              fontSize="$3"
              color="$mutedForeground"
              transition="quick"
              hoverStyle={{ color: "$color" }}
              onPress={() => setSheetOpen(true)}
            >
              <ListFilter size={16} />
              <Text>Lists</Text>
            </XStack>
          </XStack>
        )}
        <Outlet />
      </YStack>
    </XStack>
  );
}
