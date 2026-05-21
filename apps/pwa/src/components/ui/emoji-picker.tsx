import { lazy, Suspense, useState } from "react";
import { useTheme } from "next-themes";
import { Theme, EmojiStyle } from "emoji-picker-react";
import type { EmojiClickData } from "emoji-picker-react";
import { Popover } from "@stageholder/ui";

// In Vite SPA there's no SSR, so `next/dynamic({ ssr: false })` is just
// React.lazy + Suspense. Same bundle-split outcome: emoji-picker only
// loads when the popover opens.
const Picker = lazy(() => import("emoji-picker-react"));

interface EmojiPickerProps {
  value?: string;
  onChange: (emoji: string) => void;
  placeholder?: string;
}

export function EmojiPicker({
  value,
  onChange,
  placeholder = "Pick an icon...",
}: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  function handleSelect(emojiData: EmojiClickData) {
    onChange(emojiData.emoji);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen} placement="bottom-start">
      <Popover.Trigger asChild>
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-lg hover:bg-accent"
        >
          {value || "😀"}
        </button>
      </Popover.Trigger>
      <Popover.Content
        className="z-[200] w-fit overflow-hidden border-none p-0 shadow-xl"
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <Suspense
          fallback={
            <div className="flex h-[400px] w-[350px] items-center justify-center text-xs text-muted-foreground">
              Loading…
            </div>
          }
        >
          <Picker
            onEmojiClick={handleSelect}
            theme={isDark ? Theme.DARK : Theme.LIGHT}
            emojiStyle={EmojiStyle.APPLE}
            searchPlaceholder="Search emoji..."
            autoFocusSearch={false}
            lazyLoadEmojis={true}
            width={350}
            height={400}
            style={
              {
                "--epr-bg-color": "var(--popover)",
                "--epr-category-label-bg-color": "var(--popover)",
                "--epr-text-color": "var(--popover-foreground)",
                "--epr-category-label-text-color": "var(--muted-foreground)",
                "--epr-category-icon-active-color": "var(--primary)",
                "--epr-highlight-color": "var(--primary)",
                "--epr-hover-bg-color": "var(--accent)",
                "--epr-focus-bg-color": "var(--accent)",
                "--epr-search-input-bg-color": "var(--secondary)",
                "--epr-search-input-bg-color-active": "var(--secondary)",
                "--epr-search-input-text-color": "var(--foreground)",
                "--epr-search-input-placeholder-color":
                  "var(--muted-foreground)",
                "--epr-search-border-color": "var(--border)",
                "--epr-search-border-color-active": "var(--ring)",
                "--epr-search-input-border-radius": "var(--radius)",
                "--epr-picker-border-color": "transparent",
                "--epr-picker-border-radius": "var(--radius)",
                "--epr-skin-tone-picker-menu-color": "var(--secondary)",
                "--epr-dark-bg-color": "var(--popover)",
                "--epr-dark-category-label-bg-color": "var(--popover)",
                "--epr-dark-text-color": "var(--popover-foreground)",
                "--epr-dark-hover-bg-color": "var(--accent)",
                "--epr-dark-focus-bg-color": "var(--accent)",
                "--epr-dark-search-input-bg-color": "var(--secondary)",
                "--epr-dark-search-input-bg-color-active": "var(--secondary)",
                "--epr-dark-picker-border-color": "transparent",
                "--epr-dark-category-icon-active-color": "var(--primary)",
                "--epr-dark-highlight-color": "var(--primary)",
                "--epr-dark-skin-tone-picker-menu-color": "var(--secondary)",
                border: "none",
              } as React.CSSProperties
            }
          />
        </Suspense>
      </Popover.Content>
    </Popover>
  );
}
