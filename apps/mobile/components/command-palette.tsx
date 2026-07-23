// apps/mobile/components/command-palette.tsx
//
// Native mirror of the PWA's CommandPalette (apps/pwa/src/components/shared/
// command-palette.tsx) — the last open parity item from the production-
// hardening rounds. Same kit `CommandMenu`, same groups (Navigation /
// Actions / General); on a phone the kit adapts the palette to a bottom
// Sheet (search field + thumb-sized rows — see the kit docs-expo demo).
//
// Touch differences from the PWA, by design:
//   - No ⌘K (useCommandMenuShortcut is web-only): the host renders a Search
//     trigger button (Today's header) and passes open/onOpenChange.
//   - No `shortcut` chips on rows — there's no keyboard to press them on.
//   - "New Todo / New Habit" open THIS component's own create sheets (the
//     PWA dispatches a quick-add event to its todos page; mobile's create
//     surfaces are self-contained dialogs, so the palette hosts its own).
//   - "Keyboard Shortcuts" is omitted (web-only concept).

import { useMemo, useState } from "react";
import { CommandMenu, type CommandItem } from "@stageholder/ui";
import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  Home,
  Moon,
  Plus,
  Settings,
  Sparkles,
  Sun,
  Target,
} from "@tamagui/lucide-icons-2";
import { useRouter } from "expo-router";

import { CreateHabitDialog } from "@/components/create-habit-dialog";
import { CreateTodoDialog } from "@/components/create-todo-dialog";
import { useAppTheme } from "@/lib/platform/theme";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useAppTheme();

  // Create sheets hosted here so "New Todo/Habit" work from anywhere the
  // palette is mounted — the palette closes first, then the sheet slides up.
  const [createTodoOpen, setCreateTodoOpen] = useState(false);
  const [createHabitOpen, setCreateHabitOpen] = useState(false);

  const items = useMemo<CommandItem[]>(
    () => [
      // ─── Navigation ─────────────────────────────────────────────
      {
        id: "nav-today",
        group: "Navigation",
        label: "Today",
        icon: <Home size={16} />,
        keywords: ["home", "dashboard", "overview"],
        onSelect: () => router.navigate("/"),
      },
      {
        id: "nav-todos",
        group: "Navigation",
        label: "Todos",
        icon: <CheckSquare size={16} />,
        keywords: ["tasks", "checklist"],
        onSelect: () => router.navigate("/todos"),
      },
      {
        id: "nav-habits",
        group: "Navigation",
        label: "Habits",
        icon: <Target size={16} />,
        keywords: ["routines", "tracker"],
        onSelect: () => router.navigate("/habits"),
      },
      {
        id: "nav-journal",
        group: "Navigation",
        label: "Journal",
        icon: <BookOpen size={16} />,
        keywords: ["diary", "notes"],
        onSelect: () => router.navigate("/journal"),
      },
      {
        id: "nav-calendar",
        group: "Navigation",
        label: "Calendar",
        icon: <CalendarDays size={16} />,
        keywords: ["schedule", "events", "month"],
        onSelect: () => router.push("/calendar"),
      },
      {
        id: "nav-journey",
        group: "Navigation",
        label: "Journey",
        icon: <Sparkles size={16} />,
        keywords: ["light", "level", "tier", "progress"],
        onSelect: () => router.push("/journey"),
      },
      {
        id: "nav-settings",
        group: "Navigation",
        label: "Settings",
        icon: <Settings size={16} />,
        keywords: ["preferences", "config", "account"],
        onSelect: () => router.navigate("/settings"),
      },

      // ─── Actions ────────────────────────────────────────────────
      {
        id: "action-new-todo",
        group: "Actions",
        label: "New Todo",
        icon: <Plus size={16} />,
        keywords: ["add task", "create task", "new task"],
        onSelect: () => setCreateTodoOpen(true),
      },
      {
        id: "action-new-habit",
        group: "Actions",
        label: "New Habit",
        icon: <Plus size={16} />,
        keywords: ["add habit", "create habit", "routine"],
        onSelect: () => setCreateHabitOpen(true),
      },
      {
        id: "action-new-journal",
        group: "Actions",
        label: "New Journal Entry",
        icon: <BookOpen size={16} />,
        keywords: ["diary entry", "write"],
        onSelect: () => router.push("/journal/new"),
      },

      // ─── General ────────────────────────────────────────────────
      {
        id: "general-theme",
        group: "General",
        label: "Toggle Theme",
        // Icon flips with the current mode (memo dep on resolvedTheme).
        icon: resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />,
        keywords: ["dark mode", "light mode", "appearance"],
        onSelect: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
      },
    ],
    [router, resolvedTheme, setTheme],
  );

  return (
    <>
      <CommandMenu
        open={open}
        onOpenChange={onOpenChange}
        items={items}
        placeholder="Search commands…"
      />
      <CreateTodoDialog
        open={createTodoOpen}
        onOpenChange={setCreateTodoOpen}
      />
      <CreateHabitDialog
        open={createHabitOpen}
        onOpenChange={setCreateHabitOpen}
      />
    </>
  );
}
