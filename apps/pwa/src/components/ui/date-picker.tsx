import * as React from "react";
import { CalendarIcon, XIcon } from "lucide-react";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { parseDateLocal } from "@/lib/date";
import { Button, Calendar, Popover } from "@stageholder/ui";

/**
 * Meridian's DatePicker — thin product-specific wrapper around the
 * kit's Calendar + Popover primitives, preserving meridian's
 * established API:
 *
 *   - ISO date string IN / ISO date string OUT (good fit for serialization
 *     and react-query cache keys; matches the API the four callers
 *     already depend on)
 *   - Custom Button trigger styled like the rest of the form chrome
 *   - Inline X-clear inside the trigger (vs the kit DatePicker's
 *     footer-Clear pattern)
 *   - Simple `maxDate` predicate
 *
 * Why not use kit's DatePicker directly: the kit's DatePicker has a
 * read-only Input as its trigger, plus presets, time-of-day, editable
 * input, etc. — features meridian doesn't need on these surfaces.
 * Keeping this wrapper local lets us pick exactly the trigger UX
 * without inheriting the kit's full DatePicker feature surface.
 */
interface DatePickerProps {
  /** ISO date string (YYYY-MM-DD) or empty string */
  value: string;
  /** Called with ISO date string or empty string */
  onChange: (value: string) => void;
  placeholder?: string;
  /** Allow clearing the date */
  clearable?: boolean;
  /** Disable dates after this */
  maxDate?: Date;
  className?: string;
  id?: string;
}

function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  clearable = true,
  maxDate,
  className,
  id,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selected = value ? parseDateLocal(value) : null;

  function handleSelect(date: Date) {
    onChange(format(date, "yyyy-MM-dd"));
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen} placement="bottom-start">
      <Popover.Trigger asChild>
        <Button
          id={id}
          intent="outline"
          // kit Button's `onPress` doesn't fire here — the parent
          // Popover.Trigger asChild handles the click. We just need
          // the Button as a styled trigger element.
          onPress={() => setOpen((v) => !v)}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-4 text-muted-foreground" />
          {value ? format(parseDateLocal(value), "MMM d, yyyy") : placeholder}
          {clearable && value && (
            <XIcon
              className="ml-auto size-3.5 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                // Stop propagation so the X-click doesn't bubble to the
                // Popover trigger and re-toggle open state.
                e.stopPropagation();
                onChange("");
              }}
            />
          )}
        </Button>
      </Popover.Trigger>
      <Popover.Content className="w-auto p-0">
        <Calendar
          mode="single"
          value={selected}
          onChange={handleSelect}
          initialMonth={selected ?? undefined}
          isDateDisabled={maxDate ? (date) => date > maxDate : undefined}
        />
      </Popover.Content>
    </Popover>
  );
}

export { DatePicker };
