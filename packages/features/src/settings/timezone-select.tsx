import { useMemo } from "react";
import { Combobox } from "@stageholder/ui";
import { getTimezones } from "./timezone-data";

export interface TimezoneSelectProps {
  value: string;
  onValueChange: (value: string) => void;
}

/**
 * WEB timezone picker built on the kit `Combobox` — the IANA list is ~418
 * zones, so a searchable panel beats a long scroll. The NATIVE sibling
 * (`timezone-select.native.tsx`) replaces this with a driven modal Sheet:
 * the Combobox's Adapt→Sheet path violates the native sheet rules (fit
 * snap mode over a long list grows past the screen). Both share the
 * curated/runtime zone list from ./timezone-data.
 */
export function TimezoneSelect({ value, onValueChange }: TimezoneSelectProps) {
  const options = useMemo(
    () =>
      getTimezones(value).map((tz) => ({
        value: tz,
        label: tz,
        // The default filter is exact-substring on label/value — add a
        // separator-free variant so "new york" matches "America/New_York"
        // and "sao paulo" matches "America/Sao_Paulo".
        keywords: [tz.replace(/[_/]/g, " ")],
      })),
    [value],
  );

  return (
    <Combobox
      options={options}
      value={value}
      onChange={(v) => {
        // Single-select Combobox emits `string | null` (null = cleared);
        // the contract here is a non-empty timezone, so ignore clears.
        if (typeof v === "string") onValueChange(v);
      }}
      placeholder="Select timezone..."
      searchPlaceholder="Search timezones..."
      sheetTitle="Timezone"
      fullWidth
    />
  );
}
