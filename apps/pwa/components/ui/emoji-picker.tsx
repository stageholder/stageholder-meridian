"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { Theme, EmojiStyle } from "emoji-picker-react";
import type { EmojiClickData } from "emoji-picker-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const Picker = dynamic(() => import("emoji-picker-react"), { ssr: false });

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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-lg hover:bg-accent"
        >
          {value || "😀"}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[200] w-fit overflow-hidden border-none p-0 shadow-xl"
        align="start"
        sideOffset={8}
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
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
              "--epr-search-input-placeholder-color": "var(--muted-foreground)",
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
      </PopoverContent>
    </Popover>
  );
}
