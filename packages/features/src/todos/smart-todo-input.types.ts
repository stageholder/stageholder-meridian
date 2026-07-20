// Shared types for the cross-platform SmartTodoInput (web `.tsx` + `.native.tsx`
// implementations). Lives in its own module so the native file can import them
// without resolving back into itself.
import type { SmartParseResult } from "@repo/core/todos/smart-parse";
import type { SmartLocale } from "@repo/core/todos/date-parse";

export interface SmartTodoInputHandle {
  focus: () => void;
}

/** A list the `#` picker can offer — carries the colour + default flag so the
 *  menu + pill match the app's standard list treatment (colour dot / Inbox). */
export interface SmartListOption {
  id: string;
  name: string;
  color?: string;
  isDefault?: boolean;
}

export interface SmartTodoInputProps {
  value: string;
  onValueChange: (value: string) => void;
  lists: SmartListOption[];
  /** Injected for deterministic relative-date parsing; defaults to now. */
  now?: Date;
  /** Language for date parsing (English is always active too). Defaults to the
   *  device language, mapped to a supported locale (falls back to English). */
  locale?: SmartLocale;
  /** Fired on Enter/submit when no picker is open. */
  onSubmit?: (result: SmartParseResult) => void;
  /** Fired on Escape when no picker is open (host closes the composer). */
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Parse + highlight tokens (default true). Set false to use the field as a
   *  plain text input (e.g. the EDIT dialog, where the title is just a name). */
  parse?: boolean;
  /** Render the built-in removable preview chips (default true). Turn off when
   *  the host renders its own field controls (the create dialog's chip row). */
  showChips?: boolean;
  /** Fires on every value change with the current parse — lets a host form sync
   *  its own date/priority/list controls to what was typed. */
  onParse?: (result: SmartParseResult) => void;
}
