import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAppTheme } from "@/lib/platform/theme";
import {
  Home,
  CalendarDays,
  CheckSquare,
  Target,
  BookOpen,
  Settings,
  Plus,
  FileEdit,
  Keyboard,
  Moon,
  Sun,
} from "lucide-react";
import { CommandMenu, type CommandItem } from "@stageholder/ui";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenShortcuts: () => void;
  onCreateTodo: () => void;
}

/**
 * Trigger a "quick add todo" event on the todos page, navigating there
 * first if needed. Replaces the inline closure in the old cmdk version.
 */
function triggerQuickAddTodo(navigate: ReturnType<typeof useNavigate>) {
  const onTodosPage =
    window.location.pathname === "/todos" ||
    window.location.pathname.startsWith("/todos/");
  if (onTodosPage) {
    window.dispatchEvent(new CustomEvent("meridian:quick-add-todo"));
  } else {
    navigate({ to: "/todos" });
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("meridian:quick-add-todo"));
    }, 300);
  }
}

export function CommandPalette({
  open,
  onOpenChange,
  onOpenShortcuts,
  onCreateTodo,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const { setTheme, theme } = useAppTheme();

  // Build the item list inside useMemo so it re-derives when `theme`
  // changes (the Toggle Theme item's icon flips between Sun/Moon and
  // its onSelect target flips accordingly).
  const items = useMemo<CommandItem[]>(
    () => [
      // ─── Navigation ─────────────────────────────────────────────
      {
        id: "nav-dashboard",
        group: "Navigation",
        label: "Dashboard",
        icon: <Home size={16} />,
        keywords: ["home", "overview"],
        shortcut: "G D",
        onSelect: () => navigate({ to: "/" }),
      },
      {
        id: "nav-calendar",
        group: "Navigation",
        label: "Calendar",
        icon: <CalendarDays size={16} />,
        keywords: ["schedule", "events"],
        shortcut: "G C",
        onSelect: () => navigate({ to: "/calendar" }),
      },
      {
        id: "nav-todos",
        group: "Navigation",
        label: "Todos",
        icon: <CheckSquare size={16} />,
        keywords: ["tasks", "checklist"],
        shortcut: "G T",
        onSelect: () => navigate({ to: "/todos" }),
      },
      {
        id: "nav-habits",
        group: "Navigation",
        label: "Habits",
        icon: <Target size={16} />,
        keywords: ["routines", "tracker"],
        shortcut: "G H",
        onSelect: () => navigate({ to: "/habits" }),
      },
      {
        id: "nav-journal",
        group: "Navigation",
        label: "Journal",
        icon: <BookOpen size={16} />,
        keywords: ["diary", "notes"],
        shortcut: "G J",
        onSelect: () => navigate({ to: "/journal" }),
      },
      {
        id: "nav-settings",
        group: "Navigation",
        label: "Settings",
        icon: <Settings size={16} />,
        keywords: ["preferences", "config"],
        shortcut: "G S",
        onSelect: () => navigate({ to: "/settings" }),
      },

      // ─── Actions ────────────────────────────────────────────────
      {
        id: "action-new-todo",
        group: "Actions",
        label: "New Todo",
        icon: <Plus size={16} />,
        keywords: ["add task", "create task", "new task"],
        shortcut: "N",
        onSelect: () => triggerQuickAddTodo(navigate),
      },
      {
        id: "action-new-todo-detail",
        group: "Actions",
        label: "New Todo (detail)",
        icon: <FileEdit size={16} />,
        keywords: ["create task detail", "full todo"],
        shortcut: "⇧ N",
        onSelect: onCreateTodo,
      },
      {
        id: "action-new-journal",
        group: "Actions",
        label: "New Journal Entry",
        icon: <BookOpen size={16} />,
        keywords: ["diary entry", "write"],
        onSelect: () => navigate({ to: "/journal" }),
      },

      // ─── General ────────────────────────────────────────────────
      {
        id: "general-shortcuts",
        group: "General",
        label: "Keyboard Shortcuts",
        icon: <Keyboard size={16} />,
        keywords: ["keys", "hotkeys", "bindings"],
        shortcut: "?",
        onSelect: onOpenShortcuts,
      },
      {
        id: "general-theme",
        group: "General",
        label: "Toggle Theme",
        // Icon flips with current theme. Memo dep on `theme` ensures
        // the items array re-derives when the user changes mode.
        icon: theme === "dark" ? <Sun size={16} /> : <Moon size={16} />,
        keywords: ["dark mode", "light mode", "appearance"],
        onSelect: () => setTheme(theme === "dark" ? "light" : "dark"),
      },
    ],
    [navigate, theme, setTheme, onCreateTodo, onOpenShortcuts],
  );

  return (
    <CommandMenu
      open={open}
      onOpenChange={onOpenChange}
      items={items}
      placeholder="Type a command or search..."
    />
  );
}
