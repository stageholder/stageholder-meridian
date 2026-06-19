// Barrel for the `journal` domain — presentational journal-entry views.
// The host (PWA today, mobile later) hooks `useJournals` + supplies the
// `onJournalPress` callback wired to its router.
//
// `MoodPicker` itself lives in the kit (`@stageholder/ui` exports
// `MoodPicker`, `MOOD_DEFAULT_OPTIONS`, `MoodOption`, `MoodPickerProps`)
// — consumers that need the interactive picker import it straight from
// the kit. `MoodDisplay` (read-only emoji from a mood value) lives here
// because the kit doesn't ship one; it reuses the kit's
// `MOOD_DEFAULT_OPTIONS` so the rendered emoji always matches what the
// picker shows.
//
// `JournalEditor` wraps the kit's truly-cross-platform `RichTextEditor`
// (TipTap on web, 10tap on native, lossless TipTap-JSON storage) — see
// the view docstring for the host-vs-view contract. Legacy HTML → JSON
// normalization stays in the host so `@tiptap/html` doesn't become a
// features dep during the migration window.

export { MoodDisplay, type MoodDisplayProps } from "./mood-display";

export { JournalList, type JournalListProps } from "./journal-list";

export {
  JournalEditor,
  BLOCK_GUTTER,
  type JournalEditorProps,
  type JournalProgressState,
  type SaveStatus,
} from "./journal-editor";
