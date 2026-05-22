import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { format } from "date-fns";
import { Sun, CalendarClock, Inbox, CheckCircle2, Plus } from "lucide-react";
import { Separator, Text, View, XStack, YStack } from "@stageholder/ui";
import { useAllTodos, useTodoLists } from "@/lib/api/todos";
import { CreateListDialog } from "./create-list-dialog";
import type { Todo, TodoList } from "@repo/core/types";

interface TodoListSidebarProps {
  onNavigate?: () => void;
}

const linkStyle = { textDecoration: "none" } as const;

// One nav row: leading icon (inherits the row's color), label, optional
// trailing count. Active vs idle drives bg/color; the lucide icon follows
// the row color via currentColor.
function NavRow({
  active,
  icon,
  label,
  count,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <XStack
      items="center"
      gap="$2.5"
      rounded="$md"
      px="$2.5"
      py="$2"
      transition="quick"
      bg={active ? "$accent" : "transparent"}
      color={active ? "$color" : "$mutedForeground"}
      hoverStyle={active ? undefined : { bg: "$accent", color: "$color" }}
    >
      <View shrink={0} items="center" justify="center" width={18} height={18}>
        {icon}
      </View>
      <Text
        flex={1}
        fontSize="$3"
        fontWeight={active ? "600" : "500"}
        numberOfLines={1}
      >
        {label}
      </Text>
      {count && count > 0 ? (
        <Text
          fontSize="$1"
          color="$mutedForeground"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {count}
        </Text>
      ) : null}
    </XStack>
  );
}

export function TodoListSidebar({ onNavigate }: TodoListSidebarProps = {}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: lists, isLoading } = useTodoLists();
  const { data: allTodos } = useAllTodos();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const basePath = "/todos";

  // ── Live counts ──────────────────────────────────────────────────────────
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const pending = (allTodos ?? []).filter((t: Todo) => t.status !== "done");

  const isDueByToday = (t: Todo) => {
    const due = t.dueDate?.split("T")[0];
    const doDate = t.doDate?.split("T")[0];
    return (!!due && due <= todayStr) || (!!doDate && doDate <= todayStr);
  };
  const isFuture = (t: Todo) => {
    const due = t.dueDate?.split("T")[0];
    const doDate = t.doDate?.split("T")[0];
    return (!!due && due > todayStr) || (!!doDate && doDate > todayStr);
  };

  const todayCount = pending.filter(isDueByToday).length;
  const upcomingCount = pending.filter(
    (t) => !isDueByToday(t) && isFuture(t),
  ).length;
  const inboxCount = pending.length;

  const listCounts = new Map<string, number>();
  for (const t of pending) {
    listCounts.set(t.listId, (listCounts.get(t.listId) ?? 0) + 1);
  }

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
        <Text fontSize="$4" fontWeight="700" color="$color">
          Todos
        </Text>
      </View>

      <YStack tag="nav" flex={1} gap="$0.5" overflowY={"auto" as never} p="$2">
        {isLoading && (
          <Text px="$3" py="$2" fontSize="$1" color="$mutedForeground">
            Loading…
          </Text>
        )}

        <Link to={basePath} onClick={onNavigate} style={linkStyle}>
          <NavRow
            active={pathname === basePath}
            icon={<Sun size={18} />}
            label="Today"
            count={todayCount}
          />
        </Link>

        <Link
          to={`${basePath}/upcoming`}
          onClick={onNavigate}
          style={linkStyle}
        >
          <NavRow
            active={pathname === `${basePath}/upcoming`}
            icon={<CalendarClock size={18} />}
            label="Upcoming"
            count={upcomingCount}
          />
        </Link>

        <Link to={`${basePath}/inbox`} onClick={onNavigate} style={linkStyle}>
          <NavRow
            active={pathname === `${basePath}/inbox`}
            icon={<Inbox size={18} />}
            label="Inbox"
            count={inboxCount}
          />
        </Link>

        <Link
          to={`${basePath}/completed`}
          onClick={onNavigate}
          style={linkStyle}
        >
          <NavRow
            active={pathname === `${basePath}/completed`}
            icon={<CheckCircle2 size={18} />}
            label="Completed"
          />
        </Link>

        <Separator mx="$2" my="$2" />

        <XStack items="center" justify="space-between" px="$2.5" py="$1.5">
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
            width={22}
            height={22}
            items="center"
            justify="center"
            rounded="$sm"
            color="$mutedForeground"
            cursor="pointer"
            transition="quick"
            hoverStyle={{ bg: "$accent", color: "$color" }}
            aria-label="Create list"
            role="button"
          >
            <Plus size={15} />
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
              <NavRow
                active={pathname === `${basePath}/${list.id}`}
                icon={
                  <View
                    width={10}
                    height={10}
                    rounded={9999}
                    style={{ backgroundColor: list.color || "#6b7280" }}
                  />
                }
                label={list.name}
                count={listCounts.get(list.id)}
              />
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
