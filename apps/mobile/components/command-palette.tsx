// apps/mobile/components/command-palette.tsx
//
// Native mirror of the PWA's CommandPalette (apps/pwa/src/components/shared/
// command-palette.tsx) — the last open parity item from the production-
// hardening rounds. Same groups (Navigation / Actions / General), same
// label / description / keyword filter as the kit `CommandMenu`.
//
// WHY THIS HOSTS ITS OWN SHEET instead of rendering the kit `CommandMenu`
// (2026-10-20): on phones the kit palette is a Dialog that `Adapt`s to a
// plain Sheet with NO keyboard handling — the software keyboard simply drew
// over the results list (the sheet never lifted), and the search field's
// `autoFocus` raised the keyboard while the sheet was still sliding. The kit
// `FormSheet.native` solves both (an animated bottom spacer = live keyboard
// height stretches the `fit` sheet above the keyboard, engaged only after the
// open settles), but its Cancel/Save chrome doesn't fit a palette. So this
// file drives a kit `Sheet` itself and copies FormSheet's spacer pattern,
// while the rows / group labels / search wrap stay the kit's own styled
// `CommandMenu.*` parts — the look is identical to the kit palette.
//
// Touch differences from the PWA, by design:
//   - No ⌘K (useCommandMenuShortcut is web-only): the host renders a Search
//     trigger button (Today's header) and passes open/onOpenChange.
//   - No `shortcut` chips on rows — there's no keyboard to press them on.
//   - "New Todo / New Habit" open THIS component's own create sheets (the
//     PWA dispatches a quick-add event to its todos page; mobile's create
//     surfaces are self-contained dialogs, so the palette hosts its own).
//   - "Keyboard Shortcuts" is omitted (web-only concept).

import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, type TextInput } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import {
  CommandMenu,
  Input,
  Sheet,
  Text,
  XStack,
  YStack,
  type CommandItem,
} from "@stageholder/ui";
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

/** Results list height — same as the kit `CommandMenu.List` (320). */
const LIST_HEIGHT = 320;

/**
 * The frame's own chrome below the list (its bottom padding). The keyboard
 * spacer is trimmed by this so the last row sits a small, proper distance
 * above the keyboard instead of floating (FormSheet's FRAME_BOTTOM_CHROME
 * idea, sized for this frame's `pb`).
 */
const FRAME_BOTTOM_CHROME = 8;

/** Filter mirrors the kit CommandMenu: label / description / keyword substring. */
function matches(item: CommandItem, q: string): boolean {
  if (item.label.toLowerCase().includes(q)) return true;
  if (item.description?.toLowerCase().includes(q)) return true;
  return item.keywords?.some((k) => k.toLowerCase().includes(q)) ?? false;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useAppTheme();

  const [query, setQuery] = useState("");
  const inputRef = useRef<TextInput | null>(null);

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

  // Keyboard height as a Reanimated SHARED VALUE (UI thread, frame-by-frame),
  // driving an animated bottom spacer so the `fit` sheet grows above the
  // keyboard in sync with the keyboard's own animation — FormSheet.native's
  // stretch technique, not `moveOnKeyboardChange` (translating the whole
  // sheet can get stuck mid-animation; a spacer can't: keyboard 0 → spacer 0).
  // abs() because the library reports the value negative on some platforms.
  // Engaged only after the open SETTLES: before that the frame hasn't been
  // positioned yet, and growing it early left a whole sheet hidden behind the
  // keyboard for ~2 s (meridian quick-add, 2026-10-18).
  const { height: kbHeight } = useReanimatedKeyboardAnimation();
  const settledSV = useSharedValue(0);
  const spacerStyle = useAnimatedStyle(() => {
    const h = Math.abs(kbHeight.value);
    return {
      height:
        settledSV.value && h > 0 ? Math.max(0, h - FRAME_BOTTOM_CHROME) : 0,
    };
  });

  // Closing resets the search and re-arms the settle gate for the next open.
  // The body unmounts with the sheet (`mountChildren="open"` below), so the
  // search field cannot keep or regain focus once the sheet is gone; the
  // explicit blur + dismiss cover the close commit itself.
  useEffect(() => {
    if (!open) {
      setQuery("");
      settledSV.value = 0;
      inputRef.current?.blur();
      Keyboard.dismiss();
    }
  }, [open, settledSV]);
  // The kit calls the settle callback for the OPEN spring only, but a sheet
  // dragged down and released can re-settle — focusing the field then raised
  // a keyboard over the page with no sheet under it ("keyboard opens out of
  // nowhere after swiping the search down", device feedback 2026-10-25).
  // Read `open` through a ref: the kit keeps the callback it was given.
  const openRef = useRef(open);
  openRef.current = open;

  // Row tap: hand the keyboard off BEFORE the action runs. "New Todo" opens
  // the quick-add whose title is a WebView editor that focuses itself once
  // its bridge is ready; with the palette's keyboard still dismissing at that
  // moment the WebView focus was swallowed and the sheet opened unfocused
  // (2026-10-20). Dismissing first lets the create sheet's own
  // focus-after-settle raise a clean keyboard (habit name / todo editor).
  function runItem(it: CommandItem) {
    Keyboard.dismiss();
    it.onSelect();
    onOpenChange(false);
  }

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

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? items.filter((it) => matches(it, q)) : items;
    const map = new Map<string, CommandItem[]>();
    for (const it of filtered) {
      const key = it.group ?? "__default__";
      const list = map.get(key) ?? [];
      list.push(it);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [items, query]);

  return (
    <>
      <Sheet
        modal
        open={open}
        onOpenChange={onOpenChange}
        transition="medium"
        dismissOnSnapToBottom
        snapPointsMode="fit"
        // Body mounted per open, unmounted at close: a search field that
        // stayed mounted behind a closed sheet could be focused by the swipe
        // that closed it (the touch-up lands on the field) and raise the
        // keyboard over the page. Twelve rows — the mount is cheap.
        mountChildren="open"
        onSettled={() => {
          if (!openRef.current) return;
          settledSV.value = 1;
          // Focus AFTER the slide lands (not `autoFocus` on mount) so the
          // keyboard rises once the sheet is in place rather than mid-slide.
          inputRef.current?.focus();
        }}
      >
        {/* Backdrop FADE: since @tamagui/sheet 2.0 the overlay is a presence
            child mounted only while open, so without a transition + enter/exit
            opacity the dim POPS in and vanishes ("dim blinks", 2026-10-20).
            The kit's Sheet.Overlay gains these defaults in its next release;
            until that ships, every app-hosted overlay sets them itself. */}
        <Sheet.Overlay
          transition="medium"
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
        />
        {/* pt 0 — the kit grabber is the frame's first child with its own
            spacing (FormSheet convention); px/gap 0 so the search wrap and
            rows use the kit palette's own insets. */}
        <Sheet.Frame pt={0} px={0} pb={FRAME_BOTTOM_CHROME} gap={0}>
          <CommandMenu.SearchWrap>
            <Input
              ref={inputRef as never}
              value={query}
              onChangeText={setQuery}
              placeholder="Search commands…"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              bg="transparent"
              borderWidth={0}
              flex={1}
            />
          </CommandMenu.SearchWrap>
          {/* keyboardShouldPersistTaps so a row tap lands while the search
              keyboard is up (one tap, not "dismiss keyboard, then tap"). */}
          <Sheet.ScrollView
            height={LIST_HEIGHT}
            keyboardShouldPersistTaps="handled"
          >
            <YStack py="$2" px="$2">
              {grouped.length === 0 ? (
                <CommandMenu.Empty>No matching commands.</CommandMenu.Empty>
              ) : (
                grouped.map(([groupKey, list]) => (
                  <YStack key={groupKey} gap={2}>
                    {groupKey !== "__default__" ? (
                      <CommandMenu.GroupLabel>
                        {groupKey}
                      </CommandMenu.GroupLabel>
                    ) : null}
                    {list.map((it) => (
                      <CommandMenu.Item key={it.id} onPress={() => runItem(it)}>
                        {it.icon ? (
                          <XStack items="center" justify="center">
                            {it.icon}
                          </XStack>
                        ) : null}
                        <YStack flex={1}>
                          <Text fontSize="$3" color="$color">
                            {it.label}
                          </Text>
                          {it.description ? (
                            <Text fontSize="$1" color="$mutedForeground">
                              {it.description}
                            </Text>
                          ) : null}
                        </YStack>
                      </CommandMenu.Item>
                    ))}
                  </YStack>
                ))
              )}
            </YStack>
          </Sheet.ScrollView>
          {/* Keyboard spacer — grows the fit-sized frame above the keyboard. */}
          <Animated.View style={spacerStyle} />
        </Sheet.Frame>
      </Sheet>
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
