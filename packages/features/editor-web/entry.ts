// Custom tentap web editor for the native quick-add field.
//
// This is NOT shipped as-is — it's bundled to a single self-contained HTML
// string by `build.mjs` and imported by `smart-todo-input.native.tsx` as the
// tentap `customSource`. It lives OUTSIDE `src/` so the package's tsc/eslint
// (which target React Native) never try to type-check this DOM/React-web file.
//
// It adds exactly ONE thing over tentap's default editor: a ProseMirror
// decoration plugin that paints recognized phrases as rounded inline pills. The
// PARSER still runs in React Native (so all the multi-language logic is reused);
// RN just pushes the resolved ranges + colors here via `window.__setSmartTokens`.
// A decoration is purely visual (not part of the document), so it never touches
// the text, the caret, or what `getText()` returns.
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

type SmartToken = { start: number; end: number; color: string };

const smartKey = new PluginKey("smartHighlight");
let smartTokens: SmartToken[] = [];
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
          decorations: (state: any) => {
            if (!smartTokens.length) return DecorationSet.empty;
            const size = state.doc.content.size;
            const decos = [];
            for (const t of smartTokens) {
              // The title is a single paragraph, whose text starts at PM
              // position 1 — so a text index maps to position index + 1.
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

// RN → web bridge for the highlight ranges. Dispatching a no-op transaction
// makes the `decorations` prop re-run against the current document.
(window as any).__setSmartTokens = (tokens: SmartToken[]) => {
  smartTokens = Array.isArray(tokens) ? tokens : [];
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
