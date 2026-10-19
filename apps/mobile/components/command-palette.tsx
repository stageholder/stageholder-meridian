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
import { BookOpen } from "@tamagui/lucide-icons-2/icons/BookOpen";
import { CalendarDays } from "@tamagui/lucide-icons-2/icons/CalendarDays";
import { CheckSquare } from "@tamagui/lucide-icons-2/icons/CheckSquare";
import { Home } from "@tamagui/lucide-icons-2/icons/Home";
import { Moon } from "@tamagui/lucide-icons-2/icons/Moon";
import { Plus } from "@tamagui/lucide-icons-2/icons/Plus";
import { Settings } from "@tamagui/lucide-icons-2/icons/Settings";
import { Sparkles } from "@tamagui/lucide-icons-2/icons/Sparkles";
import { Sun } from "@tamagui/lucide-icons-2/icons/Sun";
import { Target } from "@tamagui/lucide-icons-2/icons/Target";
import { useRouter } from "expo-router";

import { CreateHabitDialog } from "@/components/create-habit-dialog";
import { CreateTodoDialog } from "@/components/create-todo-dialog";
import { useAppTheme } from "@/lib/platform/theme";
import { useMountOnOpen } from "@/lib/hooks/use-mount-on-open";

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
  // The create sheets mount only once asked to open. Rendering them alongside
  // the menu put two FormSheet shells into the palette's own open commit, and
  // on native the sheet cannot start sliding until that commit has laid out
  // (measured 2026-10-18: a FormSheet with sibling sheets in its open commit
  // sat on a dimmed screen for 1–3.7 s before sliding; the kit's rule since
  // 0.4.0-alpha.2 is "the open commit mounts only what draws the frame").
  // The palette closes before a create sheet opens, so nothing is lost.
  const todoHost = useMountOnOpen(createTodoOpen);
  const habitHost = useMountOnOpen(createHabitOpen);

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
      {todoHost ? (
        <CreateTodoDialog
          open={createTodoOpen}
          onOpenChange={setCreateTodoOpen}
        />
      ) : null}
      {habitHost ? (
        <CreateHabitDialog
          open={createHabitOpen}
          onOpenChange={setCreateHabitOpen}
        />
      ) : null}
    </>
  );
}
