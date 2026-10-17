// Custom tentap web editor for the native quick-add field.
//
// This is NOT shipped as-is — it's bundled to a single self-contained HTML
// string by `build.mjs` and imported by `smart-todo-input.native.tsx` as the
// tentap `customSource`. It lives OUTSIDE `src/` so the package's tsc/eslint
// (which target React Native) never try to type-check this DOM/React-web file.
//
// It adds a ProseMirror decoration plugin that paints recognized phrases as
// rounded inline pills.
//
// WHY THE PARSER RUNS HERE (in the WebView) — the highlight used to round-trip
// out to React Native on every keystroke: RN did `getText()` (WebView→RN),
// parsed, then pushed token ranges back via `__setSmartTokens` (RN→WebView).
// Two serialized bridge messages per keystroke made the pill lag behind the
// caret ("type 'tomorrow', it highlights only after you pause"). The parser
// (`parseSmartTodo`, chrono-node) is cross-platform, so we bundle it INTO this
// web editor and run it in the decoration plugin against the live document —
// the pill now paints on the SAME frame as the keystroke, with no bridge hop.
// RN only pushes the CONFIG (lists / now / locale) via `__setSmartConfig`, and
// that changes rarely (not per keystroke). RN still parses its own copy for the
// pills row + the saved due/do/priority/list — that side may lag harmlessly.
import React from "react";
import { createRoot } from "react-dom/client";
import { EditorContent } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import {
  useTenTap,
  TenTapStartKit,
  Plugin,
  PluginKey,
  Decoration,
  DecorationSet,
  TextSelection,
} from "@10play/tentap-editor/web";
import { parseSmartTodo } from "@repo/core/todos/smart-parse";

/* ── Config pushed once from RN (lists/now/locale) — NOT per keystroke ─────── */
type SmartList = { id: string; name: string; color?: string };
type SmartConfig = {
  lists: SmartList[];
  nowIso: string | null;
  locale: string | null;
};
let smartConfig: SmartConfig = { lists: [], nowIso: null, locale: null };
let smartEnabled = true;

/* ── Colours (mirrors tokenColor() in smart-todo-input.native.tsx) ─────────── */
const TODO_RED = "#ef4444";
const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
};
function tokenColor(token: any, lists: SmartList[]): string {
  switch (token.kind) {
    case "do":
    case "due":
      return TODO_RED;
    case "priority":
      return PRIORITY_COLOR[token.value] ?? TODO_RED;
    case "list":
      return lists.find((l) => l.id === token.value)?.color || "#6b7280";
    default:
      return TODO_RED;
  }
}

/* ── Parse the live title locally, memoized by (text, config) ──────────────── */
type SmartToken = { start: number; end: number; color: string };
let cacheKey: string | null = null;
let cacheTokens: SmartToken[] = [];
function tokensForText(text: string): SmartToken[] {
  if (!smartEnabled) return [];
  // Config identity folded into the key so a lists/locale push re-parses.
  const key = `${smartConfig.nowIso}|${smartConfig.locale}|${smartConfig.lists.length}|${text}`;
  if (key === cacheKey) return cacheTokens;
  cacheKey = key;
  try {
    const now = smartConfig.nowIso ? new Date(smartConfig.nowIso) : new Date();
    const result = parseSmartTodo(text, {
      lists: smartConfig.lists as any,
      now,
      locale: (smartConfig.locale ?? undefined) as any,
    });
    cacheTokens = (result.tokens ?? []).map((t: any) => ({
      start: t.start,
      end: t.end,
      color: tokenColor(t, smartConfig.lists),
    }));
  } catch {
    cacheTokens = [];
  }
  return cacheTokens;
}

const smartKey = new PluginKey("smartHighlight");
// The live ProseMirror view, captured so RN pushes can force a redraw / edit.
let smartView: any = null;

const SmartHighlight = Extension.create({
  name: "smartHighlight",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: smartKey,
        view: (v: any) => {
          smartView = v;
          return {
            destroy() {
              if (smartView === v) smartView = null;
            },
          };
        },
        props: {
          // Runs on every document change (ProseMirror re-invokes this per
          // transaction) — parse the current title and paint the pills locally,
          // no RN round-trip. `textContent` of the single title paragraph is the
          // raw title the parser expects; text index → PM position is index + 1.
          decorations: (state: any) => {
            const text: string = state.doc.textContent ?? "";
            const tokens = tokensForText(text);
            if (!tokens.length) return DecorationSet.empty;
            const size = state.doc.content.size;
            const decos = [];
            for (const t of tokens) {
              const from = Math.min(t.start + 1, size);
              const to = Math.min(t.end + 1, size);
              if (to > from) {
                decos.push(
                  Decoration.inline(from, to, {
                    class: "smart-token",
                    // Per-token colour rides inline; the rounded/padded/white
                    // treatment is the `.smart-token` class (CSS injected by RN).
                    style: `background-color:${t.color}`,
                  }),
                );
              }
            }
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});

// RN → web: push the parse CONFIG (lists / now / locale). Changes rarely (list
// set, a locale switch) — NOT per keystroke. Invalidate the memo + force the
// decorations to re-run against the current document.
(window as any).__setSmartConfig = (
  config: Partial<SmartConfig> & { enabled?: boolean },
) => {
  if (config && typeof config === "object") {
    if (Array.isArray(config.lists)) smartConfig.lists = config.lists;
    if (typeof config.nowIso === "string" || config.nowIso === null)
      smartConfig.nowIso = config.nowIso ?? null;
    if (typeof config.locale === "string" || config.locale === null)
      smartConfig.locale = config.locale ?? null;
    if (typeof config.enabled === "boolean") smartEnabled = config.enabled;
  }
  cacheKey = null; // force a re-parse on the next decorations() pass
  if (smartView) smartView.dispatch(smartView.state.tr.setMeta(smartKey, true));
};

// RN → web: replace [from, to) (ProseMirror positions) with `text`, then put the
// caret right after it and refocus. Used by the `!`/`#` picker to insert a
// chosen priority/list token where the user was typing (tentap's default bridge
// has no insert-at-caret, so we drive the view we captured above).
(window as any).__replaceRange = (from: number, to: number, text: string) => {
  if (!smartView) return;
  const tr = smartView.state.tr.insertText(text, from, to);
  const pos = Math.min(from + text.length, tr.doc.content.size);
  try {
    tr.setSelection(TextSelection.create(tr.doc, pos));
  } catch {
    /* position clamp failed — leave selection as-is */
  }
  smartView.dispatch(tr.scrollIntoView());
  (smartView as any).focus?.();
};

function QuickAddEditor() {
  // Same whitelist filter tentap's own editor uses, plus our decoration ext.
  const bridges = TenTapStartKit.filter(
    (e: any) =>
      !(window as any).whiteListBridgeExtensions ||
      (window as any).whiteListBridgeExtensions.includes(e.name),
  );
  const editor = useTenTap({
    bridges,
    tiptapOptions: { extensions: [SmartHighlight] },
  });
  return React.createElement(EditorContent, {
    editor,
    className: (window as any).dynamicHeight ? "dynamic-height" : undefined,
  });
}

// Mirror tentap's mount: wait until RN has injected the window config, then
// render into #root.
const interval = setInterval(() => {
  if (!(window as any).contentInjected) return;
  const container = document.getElementById("root");
  if (!container) return;
  createRoot(container).render(React.createElement(QuickAddEditor));
  clearInterval(interval);
}, 1);
