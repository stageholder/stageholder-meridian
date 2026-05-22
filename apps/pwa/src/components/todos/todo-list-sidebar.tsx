import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Separator, Text, View, XStack, YStack } from "@stageholder/ui";
import { useTodoLists } from "@/lib/api/todos";
import { CreateListDialog } from "./create-list-dialog";
import type { TodoList } from "@repo/core/types";

interface TodoListSidebarProps {
  onNavigate?: () => void;
}

// TanStack <Link> isn't a Tamagui primitive, so styling lives on a wrapped
// XStack. Each row shares this layout; active vs idle drives bg/color.
function NavRow({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <XStack
      items="center"
      gap="$2"
      rounded="$md"
      px="$3"
      py="$2"
      transition="quick"
      bg={active ? "$accent" : "transparent"}
      color={active ? "$accentForeground" : "$mutedForeground"}
      hoverStyle={active ? undefined : { bg: "$accent", color: "$color" }}
    >
      {children}
    </XStack>
  );
}

const linkStyle = { textDecoration: "none" } as const;

export function TodoListSidebar({ onNavigate }: TodoListSidebarProps = {}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: lists, isLoading } = useTodoLists();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const basePath = "/todos";

  const sortedLists = lists
    ? [...lists].sort((a, b) =>
        a.isDefault === b.isDefault ? 0 : a.isDefault ? -1 : 1,
      )
    : [];

  return (
    <YStack height="100%" width="100%" bg="$card">
      <View
        position={"sticky" as never}
        t={0}
        z={10}
        borderBottomWidth={1}
        borderColor="$borderColor"
        bg="$card"
        px="$4"
        py="$3"
      >
        <Text fontSize="$3" fontWeight="600" color="$color">
          Todos
        </Text>
      </View>

      <YStack tag="nav" flex={1} gap="$0.5" overflowY={"auto" as never} p="$2">
        {isLoading && (
          <Text px="$3" py="$2" fontSize="$1" color="$mutedForeground">
            Loading...
          </Text>
        )}

        {/* Today */}
        <Link to={basePath} onClick={onNavigate} style={linkStyle}>
          <NavRow active={pathname === basePath}>
            <Text color="$warning">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="m4.93 4.93 1.41 1.41" />
                <path d="m17.66 17.66 1.41 1.41" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="m6.34 17.66-1.41 1.41" />
                <path d="m19.07 4.93-1.41 1.41" />
              </svg>
            </Text>
            <Text fontSize="$3" fontWeight="500">
              Today
            </Text>
          </NavRow>
        </Link>

        {/* Upcoming */}
        <Link
          to={`${basePath}/upcoming`}
          onClick={onNavigate}
          style={linkStyle}
        >
          <NavRow active={pathname === `${basePath}/upcoming`}>
            <Text color="$info">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 2v4" />
                <path d="M16 2v4" />
                <rect width="18" height="18" x="3" y="4" rx="2" />
                <path d="M3 10h18" />
                <path d="m14 14 2 2 4-4" />
              </svg>
            </Text>
            <Text fontSize="$3" fontWeight="500">
              Upcoming
            </Text>
          </NavRow>
        </Link>

        {/* Inbox */}
        <Link to={`${basePath}/inbox`} onClick={onNavigate} style={linkStyle}>
          <NavRow active={pathname === `${basePath}/inbox`}>
            <Text color="$primary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
              </svg>
            </Text>
            <Text fontSize="$3" fontWeight="500">
              Inbox
            </Text>
          </NavRow>
        </Link>

        {/* Completed */}
        <Link
          to={`${basePath}/completed`}
          onClick={onNavigate}
          style={linkStyle}
        >
          <NavRow active={pathname === `${basePath}/completed`}>
            <Text color="$success">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </Text>
            <Text fontSize="$3" fontWeight="500">
              Completed
            </Text>
          </NavRow>
        </Link>

        <Separator mx="$3" my="$1.5" />

        <XStack items="center" justify="space-between" px="$3" py="$1.5">
          <Text
            fontSize="$1"
            fontWeight="600"
            letterSpacing={0.5}
            color="$mutedForeground"
            textTransform="uppercase"
          >
            Lists
          </Text>
          <View
            onPress={() => {
              setShowCreateDialog(true);
              onNavigate?.();
            }}
            width={20}
            height={20}
            items="center"
            justify="center"
            rounded="$sm"
            color="$mutedForeground"
            cursor="pointer"
            hoverStyle={{ bg: "$accent", color: "$color" }}
            aria-label="Create list"
            role="button"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
          </View>
        </XStack>

        {sortedLists
          .filter((list: TodoList) => !list.isDefault)
          .map((list: TodoList) => (
            <Link
              key={list.id}
              to="/todos/$listId"
              params={{ listId: list.id }}
              onClick={onNavigate}
              style={linkStyle}
            >
              <NavRow active={pathname === `${basePath}/${list.id}`}>
                <XStack
                  width={16}
                  height={16}
                  shrink={0}
                  items="center"
                  justify="center"
                >
                  <View
                    width={12}
                    height={12}
                    rounded={9999}
                    style={{ backgroundColor: list.color || "#6b7280" }}
                  />
                </XStack>
                <Text fontSize="$3" fontWeight="500">
                  {list.name}
                </Text>
              </NavRow>
            </Link>
          ))}
      </YStack>

      <CreateListDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </YStack>
  );
}
