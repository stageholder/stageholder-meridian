// SmartTodoInput (WEB) — Todoist-style parse-as-you-type quick-add field.
//
// Renders an editable single-/multi-line field where recognized phrases (dates,
// !priority, #list) are highlighted IN PLACE as tinted pills, and `!`/`#` open a
// caret-anchored picker. All parsing lives in `@repo/core/todos/smart-parse`
// (shared with mobile) — this file is purely the WEB presentation of it.
//
// Technique: a transparent-background <textarea> sits on top of a "backdrop"
// <div> that mirrors the exact same text (with identical font metrics) and
// paints a rounded tinted background behind each token range. The backdrop text
// is transparent, so what you see is the textarea's real, editable text over the
// backdrop's highlight boxes. Pills use box-shadow (not padding) to gain visual
// breathing room WITHOUT changing character advance, so the highlight stays
// pixel-aligned with the text above it.
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { Calendar, Flag, Inbox } from "@tamagui/lucide-icons-2";
import { Text, View, XStack } from "@stageholder/ui";
import {
  parseSmartTodo,
  type SmartParseResult,
  type SmartToken,
  type SmartTokenKind,
} from "@repo/core/todos/smart-parse";
import { resolveSmartLocale } from "@repo/core/todos/date-parse";
import type {
  SmartListOption,
  SmartTodoInputHandle,
  SmartTodoInputProps,
} from "./smart-todo-input.types";

// Priority swatches + tint helpers for the preview BADGE chips (the recognized
// date/priority/list tokens render as removable rounded chips below the field —
// the tag-input / combobox pattern).
const DATE_TINT = "var(--ring-todo-track)";
const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
};
const MUTED_TINT = "color-mix(in srgb, currentColor 12%, transparent)";

/** 6-digit hex → ~20% alpha tint; anything else → a neutral tint. */
function hexTint(hex?: string): string {
  return hex && /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}33` : MUTED_TINT;
}

// Text metrics for the textarea.
const FIELD_METRICS: CSSProperties = {
  margin: 0,
  padding: "10px 0",
  border: 0,
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "inherit",
  fontSize: 17,
  fontWeight: 500,
  lineHeight: "24px",
  letterSpacing: "normal",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  overflowWrap: "break-word",
};

// Labels are the app's semantic names (matching the Priority Select + chips);
// the `!pN` code rides along as a muted hint so the shortcut stays discoverable.
const PRIORITY_OPTIONS = [
  { token: "!p1", label: "Urgent", value: "urgent", color: "#ef4444" },
  { token: "!p2", label: "High", value: "high", color: "#f97316" },
  { token: "!p3", label: "Medium", value: "medium", color: "#eab308" },
  { token: "!p4", label: "Low", value: "low", color: "#3b82f6" },
] as const;

interface ActiveTrigger {
  char: "!" | "#";
  /** Index of the trigger char in `value`. */
  start: number;
  /** The query typed after the trigger (may be empty). */
  query: string;
}

/** Detect an in-progress `!`/`#` trigger immediately left of the caret. */
function detectTrigger(value: string, caret: number): ActiveTrigger | null {
  const upto = value.slice(0, caret);
  // Trigger char must start the token: at string start or after whitespace.
  const m = /(^|\s)([!#])(\S*)$/.exec(upto);
  if (!m) return null;
  const char = m[2] as "!" | "#";
  const query = m[3] ?? "";
  const start = caret - query.length - 1;
  return { char, start, query };
}

export const SmartTodoInput = forwardRef<
  SmartTodoInputHandle,
  SmartTodoInputProps
>(function SmartTodoInput(
  {
    value,
    onValueChange,
    lists,
    now,
    locale,
    onSubmit,
    onCancel,
    placeholder,
    autoFocus,
    parse = true,
    showChips = true,
    onParse,
  },
  ref,
) {
  // Auto-detect the device language once (English stays active alongside it).
  const loc = useMemo(() => locale ?? resolveSmartLocale(), [locale]);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [trigger, setTrigger] = useState<ActiveTrigger | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [focused, setFocused] = useState(false);

  useImperativeHandle(ref, () => ({ focus: () => taRef.current?.focus() }), []);

  const nowValue = now ?? new Date();
  const result = useMemo(
    () =>
      parse
        ? parseSmartTodo(value, { lists, now: nowValue, locale: loc })
        : ({ title: value, tokens: [] } as SmartParseResult),
    // nowValue changes every render if not memoized upstream; key on its day so
    // "today/tomorrow" stay stable without re-parsing on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value, lists, parse, loc],
  );

  // Let a host form sync its own controls (date/priority/list) to what the user
  // typed — fires on every parse change without re-subscribing on identity.
  const onParseRef = useRef(onParse);
  onParseRef.current = onParse;
  useEffect(() => {
    if (parse) onParseRef.current?.(result);
  }, [result, parse]);

  // Menu items for the active trigger.
  const menuItems = useMemo(() => {
    if (!trigger) return [];
    if (trigger.char === "!") {
      const q = trigger.query.toLowerCase();
      return PRIORITY_OPTIONS.filter(
        (p) => !q || p.value.startsWith(q) || p.token.slice(1).startsWith(q),
      ).map((p) => ({
        key: p.token,
        label: p.label,
        color: p.color as string | undefined,
        isDefault: false,
        hint: p.token.slice(1).toUpperCase() as string | undefined, // "P1"
        // Insert the WORD form (`!high`) rather than the code (`!p2`) so the
        // highlighted pill reads as a real word. Typing `!p2` still works — the
        // parser accepts both — but the picker prefers the readable form.
        insert: `!${p.value}`,
      }));
    }
    const q = trigger.query.toLowerCase();
    return lists
      .filter((l) => !q || l.name.toLowerCase().includes(q))
      .slice(0, 8)
      .map((l) => ({
        key: l.id,
        label: l.name,
        color: l.color,
        isDefault: !!l.isDefault,
        hint: undefined as string | undefined,
        // Insert the first word of the name — the parser resolves it back to the
        // full list by prefix, so a multi-word list stays a single-token pill.
        insert: `#${l.name.split(/\s+/)[0]}`,
      }));
  }, [trigger, lists]);

  function syncTrigger(nextValue: string, caret: number) {
    if (!parse) return; // plain-input mode has no `!`/`#` menus
    const t = detectTrigger(nextValue, caret);
    setTrigger(t);
    setActiveIndex(0);
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    onValueChange(next);
    syncTrigger(next, e.target.selectionStart ?? next.length);
  }

  function applyMenuItem(insert: string) {
    if (!trigger) return;
    const caret = taRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, trigger.start);
    const after = value.slice(caret);
    const needsSpace = after.length === 0 || !after.startsWith(" ");
    const inserted = insert + (needsSpace ? " " : "");
    const next = before + inserted + after;
    onValueChange(next);
    setTrigger(null);
    const nextCaret = before.length + inserted.length;
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(nextCaret, nextCaret);
    });
  }

  function removeTokensOfKind(kind: SmartTokenKind) {
    const ranges = result.tokens.filter((t) => t.kind === kind);
    if (!ranges.length) return;
    // Remove right-to-left so earlier indices stay valid.
    let next = value;
    for (const t of [...ranges].sort((a, b) => b.start - a.start)) {
      next = next.slice(0, t.start) + next.slice(t.end);
    }
    onValueChange(next.replace(/\s{2,}/g, " ").trim());
    requestAnimationFrame(() => taRef.current?.focus());
  }

  function handleKeyDown(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (trigger && menuItems.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % menuItems.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + menuItems.length) % menuItems.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const item = menuItems[activeIndex];
        if (item) applyMenuItem(item.insert);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setTrigger(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.(result);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel?.();
    }
  }

  return (
    <View width="100%">
      {/* FIELD — position:relative so the textarea overlays the backdrop ONLY
          (the preview chips live OUTSIDE this, below the underline). */}
      <View
        position="relative"
        borderBottomWidth={1}
        borderColor={focused ? "$primary" : "$borderColor"}
        transition="quick"
      >
        {/* Plain editable field. Recognized tokens show as removable rounded
            BADGE chips below (tag-input / combobox pattern) — no in-field
            highlight, so this is byte-simple and identical to native. */}
        <textarea
          ref={taRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onKeyUp={(e) => {
            // Menu-navigation keys don't change the trigger query — re-syncing on
            // their key-up would reset the highlighted item back to the top (the
            // "ArrowDown always jumps to top" bug). Let keydown own them.
            if (
              trigger &&
              (e.key === "ArrowDown" ||
                e.key === "ArrowUp" ||
                e.key === "Enter" ||
                e.key === "Tab")
            ) {
              return;
            }
            const ta = e.target as HTMLTextAreaElement;
            syncTrigger(ta.value, ta.selectionStart ?? 0);
          }}
          onClick={(e) =>
            syncTrigger(
              (e.target as HTMLTextAreaElement).value,
              (e.target as HTMLTextAreaElement).selectionStart ?? 0,
            )
          }
          rows={1}
          placeholder={placeholder}
          autoFocus={autoFocus}
          spellCheck
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            ...FIELD_METRICS,
            display: "block",
            width: "100%",
            resize: "none",
            outline: "none",
            background: "transparent",
            color: "inherit",
            caretColor: "var(--ring-todo)",
          }}
        />

        {/* `!` / `#` picker — anchored just under the field. */}
        {trigger && menuItems.length > 0 ? (
          <View
            position="absolute"
            mt="$1.5"
            z={50}
            width={240}
            rounded="$lg"
            borderWidth={1}
            borderColor="$borderColor"
            bg="$card"
            py="$1"
            {...({
              style: {
                top: "100%",
                left: 0,
                // Hug the content; scroll ONLY if the list is long (no empty
                // scrollbar tracks / reserved gutter when it fits).
                maxHeight: 280,
                overflowY: "auto",
                boxShadow: "0 10px 30px rgba(0,0,0,0.16)",
              },
            } as object)}
          >
            <Text
              px="$2.5"
              py="$1"
              fontSize="$1"
              fontWeight="600"
              color="$mutedForeground"
            >
              {trigger.char === "!" ? "Priority" : "List"}
            </Text>
            {menuItems.map((item, i) => (
              <XStack
                key={item.key}
                items="center"
                gap="$2.5"
                mx="$1"
                px="$2"
                py="$1.5"
                rounded="$md"
                cursor="pointer"
                bg={i === activeIndex ? "$secondary" : "transparent"}
                hoverStyle={{ bg: "$secondary" }}
                onPress={() => applyMenuItem(item.insert)}
                // Keep focus on the textarea (don't let the press steal it).
                {...({
                  onMouseDown: (e: MouseEvent) => e.preventDefault(),
                } as object)}
              >
                {trigger.char === "!" ? (
                  // Priority — its own swatch (matches the app's priority
                  // flags). Raw hex rides `as never` past the token-only type.
                  <Flag size={14} color={item.color as never} />
                ) : item.isDefault ? (
                  // Default list — the Inbox glyph (muted), app standard.
                  <Inbox size={14} color="$mutedForeground" />
                ) : (
                  // Custom list — its own colour dot, matching the sidebar.
                  <View
                    width={9}
                    height={9}
                    rounded={9999}
                    style={{ backgroundColor: item.color || "#6b7280" }}
                  />
                )}
                <Text fontSize="$3" color="$color" flex={1}>
                  {item.label}
                </Text>
                {item.hint ? (
                  <Text fontSize="$1" fontWeight="600" color="$mutedForeground">
                    {item.hint}
                  </Text>
                ) : null}
              </XStack>
            ))}
          </View>
        ) : null}
        {/* Recognized tokens → removable BADGE chips INSIDE the field
            (tag-input / multi-select look), matching native. Suppressed when
            the host renders its own controls (`showChips={false}`). */}
        {showChips && result.tokens.length > 0 ? (
          <XStack flexWrap="wrap" items="center" gap="$1.5" mt="$2">
            {result.doDate ? (
              <PreviewChip
                tint={DATE_TINT}
                icon={
                  <Calendar size={11} color={"var(--ring-todo)" as never} />
                }
                label={labelFor(result.tokens, "do")}
                onRemove={() => removeTokensOfKind("do")}
              />
            ) : null}
            {result.dueDate ? (
              <PreviewChip
                tint={DATE_TINT}
                icon={<Flag size={11} color={"var(--ring-todo)" as never} />}
                label={`Deadline · ${labelFor(result.tokens, "due")}`}
                onRemove={() => removeTokensOfKind("due")}
              />
            ) : null}
            {result.priority ? (
              <PreviewChip
                tint={hexTint(PRIORITY_COLOR[result.priority])}
                icon={
                  <Flag
                    size={11}
                    color={PRIORITY_COLOR[result.priority] as never}
                  />
                }
                label={labelFor(result.tokens, "priority")}
                onRemove={() => removeTokensOfKind("priority")}
              />
            ) : null}
            {result.listId ? (
              <PreviewChip
                tint={hexTint(lists.find((l) => l.id === result.listId)?.color)}
                icon={
                  lists.find((l) => l.id === result.listId)?.isDefault ? (
                    <Inbox size={11} color="$mutedForeground" />
                  ) : (
                    <View
                      width={8}
                      height={8}
                      rounded={9999}
                      style={{
                        backgroundColor:
                          lists.find((l) => l.id === result.listId)?.color ||
                          "#6b7280",
                      }}
                    />
                  )
                }
                label={labelFor(result.tokens, "list")}
                onRemove={() => removeTokensOfKind("list")}
              />
            ) : null}
          </XStack>
        ) : null}
      </View>
    </View>
  );
});

function labelFor(tokens: SmartToken[], kind: SmartTokenKind): string {
  return tokens.find((t) => t.kind === kind)?.label ?? "";
}

function PreviewChip({
  tint,
  label,
  icon,
  onRemove,
}: {
  tint: string;
  label: string;
  icon?: ReactNode;
  onRemove: () => void;
}) {
  return (
    <XStack
      items="center"
      gap="$1"
      pl="$2"
      pr="$1.5"
      py="$0.5"
      rounded={999}
      style={{ backgroundColor: tint }}
    >
      {icon}
      <Text fontSize="$1" fontWeight="600" color="$color">
        {label}
      </Text>
      <Text
        cursor="pointer"
        color="$mutedForeground"
        fontSize="$2"
        lineHeight={0}
        onPress={onRemove}
        aria-label={`Remove ${label}`}
        hoverStyle={{ color: "$color" }}
      >
        ×
      </Text>
    </XStack>
  );
}
