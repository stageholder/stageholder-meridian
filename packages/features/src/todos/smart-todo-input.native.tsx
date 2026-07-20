// SmartTodoInput (NATIVE) — the React Native counterpart of the web overlay
// composer. RN can't style spans inside an editable field, so there are no
// inline pills or caret menus; instead the same `parseSmartTodo` drives a
// removable **preview-chip row** under a plain kit Input. The public contract
// (props, `onParse`, `onSubmit`) is identical to the web file, so a host —
// notably the shared `TodoForm` — uses `<SmartTodoInput>` with no per-platform
// branching. Type a natural-language date / `!p1` / `#work` and the chips light
// up; on submit the host strips the tokens from the title via the same parser.
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ReactNode,
} from "react";
import { Calendar, Flag, Inbox } from "@tamagui/lucide-icons-2";
import { Input, Text, View, XStack, YStack } from "@stageholder/ui";
import {
  parseSmartTodo,
  type SmartParseResult,
  type SmartTokenKind,
} from "@repo/core/todos/smart-parse";
import { resolveSmartLocale } from "@repo/core/todos/date-parse";
import type {
  SmartTodoInputHandle,
  SmartTodoInputProps,
} from "./smart-todo-input.types";

// Native tints are plain hex-with-alpha (no CSS vars on RN). Dates use the todo
// red; priority/list use their own swatch — same language as the web pills.
const TODO_RED = "#ef4444";
const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
};
function tint(hex?: string): string {
  return hex && /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}26` : "#8888881f";
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
    placeholder,
    autoFocus,
    parse = true,
    showChips = true,
    onParse,
  },
  ref,
) {
  const inputRef = useRef<{ focus?: () => void } | null>(null);
  useImperativeHandle(
    ref,
    () => ({ focus: () => inputRef.current?.focus?.() }),
    [],
  );

  const result: SmartParseResult = parse
    ? parseSmartTodo(value, {
        lists,
        now: now ?? new Date(),
        locale: locale ?? resolveSmartLocale(),
      })
    : { title: value, tokens: [] };

  const onParseRef = useRef(onParse);
  onParseRef.current = onParse;
  useEffect(() => {
    if (parse) onParseRef.current?.(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, parse]);

  function removeKind(kind: SmartTokenKind) {
    const ranges = result.tokens.filter((t) => t.kind === kind);
    if (!ranges.length) return;
    let next = value;
    for (const t of [...ranges].sort((a, b) => b.start - a.start)) {
      next = next.slice(0, t.start) + next.slice(t.end);
    }
    onValueChange(next.replace(/\s{2,}/g, " ").trim());
  }
  const labelFor = (kind: SmartTokenKind) =>
    result.tokens.find((t) => t.kind === kind)?.label ?? "";
  const activeList = lists.find((l) => l.id === result.listId);

  return (
    <YStack gap="$2">
      <Input
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ref={inputRef as any}
        value={value}
        onChangeText={onValueChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onSubmitEditing={() => onSubmit?.(result)}
      />
      {showChips && result.tokens.length > 0 ? (
        <XStack flexWrap="wrap" items="center" gap="$1.5">
          {result.doDate ? (
            <Chip
              tint={tint(TODO_RED)}
              icon={<Calendar size={11} color={TODO_RED} />}
              label={labelFor("do")}
              onRemove={() => removeKind("do")}
            />
          ) : null}
          {result.dueDate ? (
            <Chip
              tint={tint(TODO_RED)}
              icon={<Flag size={11} color={TODO_RED} />}
              label={`Deadline · ${labelFor("due")}`}
              onRemove={() => removeKind("due")}
            />
          ) : null}
          {result.priority ? (
            <Chip
              tint={tint(PRIORITY_COLOR[result.priority])}
              icon={<Flag size={11} color={PRIORITY_COLOR[result.priority]} />}
              label={labelFor("priority")}
              onRemove={() => removeKind("priority")}
            />
          ) : null}
          {result.listId ? (
            <Chip
              tint={tint(activeList?.color)}
              icon={
                activeList?.isDefault ? (
                  <Inbox size={11} color="$mutedForeground" />
                ) : (
                  <View
                    width={8}
                    height={8}
                    rounded={9999}
                    style={{ backgroundColor: activeList?.color || "#6b7280" }}
                  />
                )
              }
              label={labelFor("list")}
              onRemove={() => removeKind("list")}
            />
          ) : null}
        </XStack>
      ) : null}
    </YStack>
  );
});

function Chip({
  tint,
  icon,
  label,
  onRemove,
}: {
  tint: string;
  icon?: ReactNode;
  label: string;
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
        color="$mutedForeground"
        fontSize="$2"
        lineHeight={0}
        onPress={onRemove}
        aria-label={`Remove ${label}`}
      >
        ×
      </Text>
    </XStack>
  );
}
