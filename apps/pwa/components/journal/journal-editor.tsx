"use client";

import { useState, useCallback, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { countWords } from "@repo/core/utils/text";
import { useUserLight } from "@/lib/api/light";
import { useJournals } from "@/lib/api/journals";
import { cn } from "@/lib/utils";
import type { SaveStatus } from "@/lib/hooks/use-autosave";

interface JournalEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  date?: string;
  excludeJournalId?: string;
  saveStatus?: SaveStatus;
}

export function JournalEditor({
  content,
  onChange,
  placeholder,
  autoFocus,
  date,
  excludeJournalId,
  saveStatus,
}: JournalEditorProps) {
  const { data: userLight } = useUserLight();
  const target = userLight?.journalTargetDailyWords ?? 75;
  const [wordCount, setWordCount] = useState(() => countWords(content));

  // Fetch all entries for the same day to compute cumulative word count
  const { data: dailyEntries } = useJournals(
    date ? { startDate: date, endDate: date } : undefined,
  );

  const otherWordsToday = useMemo(() => {
    if (!dailyEntries) return 0;
    return dailyEntries
      .filter((entry) => entry.id !== excludeJournalId)
      .reduce((sum, entry) => sum + entry.wordCount, 0);
  }, [dailyEntries, excludeJournalId]);

  const totalWords = wordCount + otherWordsToday;

  const handleUpdate = useCallback(
    (html: string) => {
      setWordCount(countWords(html));
      onChange(html);
    },
    [onChange],
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: placeholder || "Write your thoughts...",
      }),
    ],
    content,
    autofocus: autoFocus ? "end" : false,
    onUpdate: ({ editor: e }) => {
      handleUpdate(e.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-h-[300px] focus:outline-none",
      },
    },
  });

  if (!editor) {
    return null;
  }

  const pct = Math.min(100, (totalWords / target) * 100);
  const metTarget = totalWords >= target;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-1 border-b border-border/50 pb-2 mb-0 px-4">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`rounded p-1.5 text-sm ${
            editor.isActive("bold")
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
          aria-label="Bold"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`rounded p-1.5 text-sm ${
            editor.isActive("italic")
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
          aria-label="Italic"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="19" x2="10" y1="4" y2="4" />
            <line x1="14" x2="5" y1="20" y2="20" />
            <line x1="15" x2="9" y1="4" y2="20" />
          </svg>
        </button>
        <div className="mx-1 h-5 w-px bg-border/50" />
        <button
          type="button"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={`rounded p-1.5 text-sm ${
            editor.isActive("heading", { level: 2 })
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
          aria-label="Heading"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12h8" />
            <path d="M4 18V6" />
            <path d="M12 18V6" />
            <path d="M17 12l3-2v8" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`rounded p-1.5 text-sm ${
            editor.isActive("bulletList")
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
          aria-label="Bullet list"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="8" x2="21" y1="6" y2="6" />
            <line x1="8" x2="21" y1="12" y2="12" />
            <line x1="8" x2="21" y1="18" y2="18" />
            <line x1="3" x2="3.01" y1="6" y2="6" />
            <line x1="3" x2="3.01" y1="12" y2="12" />
            <line x1="3" x2="3.01" y1="18" y2="18" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`rounded p-1.5 text-sm ${
            editor.isActive("blockquote")
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
          aria-label="Blockquote"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 6H3" />
            <path d="M21 12H8" />
            <path d="M21 18H8" />
            <path d="M3 12v6" />
          </svg>
        </button>

        {/* Save status — right-aligned in toolbar */}
        {saveStatus && (
          <span
            className={cn(
              "ml-auto text-xs",
              saveStatus === "saving" && "text-muted-foreground",
              saveStatus === "saved" && "text-muted-foreground",
              saveStatus === "error" && "text-destructive",
              saveStatus === "idle" && "text-transparent",
            )}
          >
            {saveStatus === "saving" && "Saving..."}
            {saveStatus === "saved" && "Saved"}
            {saveStatus === "error" && "Save failed"}
          </span>
        )}
      </div>

      {/* Scrollable editor content */}
      <div className="flex-1 overflow-y-auto px-4 pt-4">
        <EditorContent editor={editor} />
      </div>

      {/* Fixed word count bar at bottom */}
      <div className="shrink-0 border-t border-border/50 bg-background px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                metTarget
                  ? "bg-[var(--ring-journal)]"
                  : "bg-[var(--ring-journal)]/60",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span
            className={cn(
              "shrink-0 text-xs tabular-nums",
              metTarget
                ? "font-medium text-[var(--ring-journal)]"
                : "text-muted-foreground",
            )}
          >
            {totalWords} / {target} words
          </span>
        </div>
      </div>
    </div>
  );
}
