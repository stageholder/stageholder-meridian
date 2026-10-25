// Web counterpart of icon-picker-sheet.native.tsx: the kit MediaPickerSheet
// behind the same props (the web sheet has no keyboard to rise above).
import {
  MediaPickerSheet,
  type MediaTab,
  type MediaValue,
} from "@stageholder/ui/pickers";

export interface IconPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  tabs?: MediaTab[];
  value: MediaValue | null;
  /** Pick-to-apply: a pick (or Remove = null) applies and closes. */
  onChange: (value: MediaValue | null) => void;
}

export function IconPickerSheet({
  open,
  onOpenChange,
  title,
  tabs,
  value,
  onChange,
}: IconPickerSheetProps) {
  return (
    <MediaPickerSheet
      open={open}
      onClose={() => onOpenChange(false)}
      {...(title ? { title } : {})}
      {...(tabs ? { tabs } : {})}
      value={value}
      onChange={onChange}
    />
  );
}
