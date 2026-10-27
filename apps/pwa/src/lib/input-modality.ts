/**
 * App-wide focus-ring policy: rings for keyboard users, none for pointer users.
 *
 * Kit controls already style focus with `:focus-visible`, but the browser's
 * focus-visible heuristic leaks rings to mouse users whenever focus moves
 * PROGRAMMATICALLY: a dialog or popover opened from a menu auto-focuses its
 * first control, and because menu items take focus as you hover them (which
 * the browser treats as keyboard-style focus), that control inherits a
 * visible ring — "Later" in the update dialog, "Delete" in the todo context
 * menu's confirm, and so on.
 *
 * Instead of suppressing auto-focus dialog by dialog, track the last input
 * modality on <html data-input-modality="pointer|keyboard">; `globals.css`
 * hides focus outlines while it is `pointer`. The first navigation keypress
 * (Tab, arrows, …) flips it to `keyboard` and every ring comes back.
 */

const NAVIGATION_KEYS = new Set([
  "Tab",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

export function initInputModality(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const set = (modality: "pointer" | "keyboard") => {
    if (root.dataset.inputModality !== modality) {
      root.dataset.inputModality = modality;
    }
  };

  // Nothing has happened yet: a boot-time auto-focus shouldn't ring either.
  set("pointer");

  // Capture phase so a handler that stops propagation can't hide the event.
  document.addEventListener("pointerdown", () => set("pointer"), true);
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (NAVIGATION_KEYS.has(e.key)) set("keyboard");
    },
    true,
  );
}
