"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
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
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandSeparator,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortId: string;
  onOpenShortcuts: () => void;
  onCreateTodo: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  shortId,
  onOpenShortcuts,
  onCreateTodo,
}: CommandPaletteProps) {
  const router = useRouter();
  const { setTheme, theme } = useTheme();

  function runAction(fn: () => void) {
    onOpenChange(false);
    fn();
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem
            keywords={["home", "overview"]}
            onSelect={() =>
              runAction(() => router.push(`/${shortId}/dashboard`))
            }
          >
            <Home className="size-4" />
            Dashboard
            <CommandShortcut>G D</CommandShortcut>
          </CommandItem>
          <CommandItem
            keywords={["schedule", "events"]}
            onSelect={() =>
              runAction(() => router.push(`/${shortId}/calendar`))
            }
          >
            <CalendarDays className="size-4" />
            Calendar
            <CommandShortcut>G C</CommandShortcut>
          </CommandItem>
          <CommandItem
            keywords={["tasks", "checklist"]}
            onSelect={() => runAction(() => router.push(`/${shortId}/todos`))}
          >
            <CheckSquare className="size-4" />
            Todos
            <CommandShortcut>G T</CommandShortcut>
          </CommandItem>
          <CommandItem
            keywords={["routines", "tracker"]}
            onSelect={() => runAction(() => router.push(`/${shortId}/habits`))}
          >
            <Target className="size-4" />
            Habits
            <CommandShortcut>G H</CommandShortcut>
          </CommandItem>
          <CommandItem
            keywords={["diary", "notes"]}
            onSelect={() => runAction(() => router.push(`/${shortId}/journal`))}
          >
            <BookOpen className="size-4" />
            Journal
            <CommandShortcut>G J</CommandShortcut>
          </CommandItem>
          <CommandItem
            keywords={["preferences", "config"]}
            onSelect={() =>
              runAction(() => router.push(`/${shortId}/settings`))
            }
          >
            <Settings className="size-4" />
            Settings
            <CommandShortcut>G S</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem
            keywords={["add task", "create task", "new task"]}
            onSelect={() =>
              runAction(() => {
                const onTodosPage = window.location.pathname.includes(
                  `/${shortId}/todos`,
                );
                if (onTodosPage) {
                  window.dispatchEvent(
                    new CustomEvent("meridian:quick-add-todo"),
                  );
                } else {
                  router.push(`/${shortId}/todos`);
                  setTimeout(() => {
                    window.dispatchEvent(
                      new CustomEvent("meridian:quick-add-todo"),
                    );
                  }, 300);
                }
              })
            }
          >
            <Plus className="size-4" />
            New Todo
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem
            keywords={["create task detail", "full todo"]}
            onSelect={() => runAction(onCreateTodo)}
          >
            <FileEdit className="size-4" />
            New Todo (detail)
            <CommandShortcut>⇧ N</CommandShortcut>
          </CommandItem>
          <CommandItem
            keywords={["diary entry", "write"]}
            onSelect={() => runAction(() => router.push(`/${shortId}/journal`))}
          >
            <BookOpen className="size-4" />
            New Journal Entry
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="General">
          <CommandItem
            keywords={["keys", "hotkeys", "bindings"]}
            onSelect={() => runAction(onOpenShortcuts)}
          >
            <Keyboard className="size-4" />
            Keyboard Shortcuts
            <CommandShortcut>?</CommandShortcut>
          </CommandItem>
          <CommandItem
            keywords={["dark mode", "light mode", "appearance"]}
            onSelect={() =>
              runAction(() => setTheme(theme === "dark" ? "light" : "dark"))
            }
          >
            {theme === "dark" ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
            Toggle Theme
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
