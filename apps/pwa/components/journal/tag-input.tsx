"use client";

import { useState, type KeyboardEvent } from "react";
import { X, Tag } from "lucide-react";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  /** Render as a small inline pill trigger instead of full bordered input */
  inline?: boolean;
}

export function TagInput({ tags, onChange, inline }: TagInputProps) {
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag]);
    }
    setInput("");
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    }
    if (e.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]!);
    }
    if (e.key === "Escape") {
      setIsOpen(false);
      if (input.trim()) addTag(input);
    }
  }

  if (inline) {
    if (!isOpen) {
      return (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
        >
          <Tag className="size-2.5" />
          Tag
        </button>
      );
    }

    return (
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (input.trim()) addTag(input);
          setIsOpen(false);
        }}
        autoFocus
        placeholder="Add tag..."
        className="w-20 rounded-full border border-border bg-background px-2 py-0.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
      />
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-foreground">Tags</label>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${tag}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (input.trim()) addTag(input);
          }}
          placeholder={tags.length === 0 ? "Add tags..." : ""}
          className="min-w-[80px] flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>
    </div>
  );
}
