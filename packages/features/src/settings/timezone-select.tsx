import { useMemo } from "react";
import { Combobox } from "@stageholder/ui";

export interface TimezoneSelectProps {
  value: string;
  onValueChange: (value: string) => void;
}

/**
 * Curated IANA fallback for engines without `Intl.supportedValuesOf` —
 * notably Hermes (RN), which ships only partial Intl. Covers the major
 * zone per offset/region; the device's own zone and the current `value`
 * are merged in at runtime so the selected entry always renders.
 */
const FALLBACK_TIMEZONES = [
  "UTC",
  // Americas
  "America/Anchorage",
  "America/Argentina/Buenos_Aires",
  "America/Bogota",
  "America/Caracas",
  "America/Chicago",
  "America/Denver",
  "America/Halifax",
  "America/Lima",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/New_York",
  "America/Phoenix",
  "America/Santiago",
  "America/Sao_Paulo",
  "America/St_Johns",
  "America/Toronto",
  "America/Vancouver",
  "Pacific/Honolulu",
  // Europe & Africa
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Atlantic/Azores",
  "Europe/Amsterdam",
  "Europe/Athens",
  "Europe/Berlin",
  "Europe/Brussels",
  "Europe/Dublin",
  "Europe/Helsinki",
  "Europe/Istanbul",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Moscow",
  "Europe/Paris",
  "Europe/Prague",
  "Europe/Rome",
  "Europe/Stockholm",
  "Europe/Vienna",
  "Europe/Warsaw",
  "Europe/Zurich",
  // Middle East & Asia
  "Asia/Almaty",
  "Asia/Bangkok",
  "Asia/Dhaka",
  "Asia/Dubai",
  "Asia/Hong_Kong",
  "Asia/Jakarta",
  "Asia/Jayapura",
  "Asia/Jerusalem",
  "Asia/Karachi",
  "Asia/Kathmandu",
  "Asia/Kolkata",
  "Asia/Kuala_Lumpur",
  "Asia/Makassar",
  "Asia/Manila",
  "Asia/Riyadh",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Taipei",
  "Asia/Tashkent",
  "Asia/Tehran",
  "Asia/Tokyo",
  "Asia/Yangon",
  // Oceania
  "Australia/Adelaide",
  "Australia/Brisbane",
  "Australia/Darwin",
  "Australia/Perth",
  "Australia/Sydney",
  "Pacific/Auckland",
  "Pacific/Fiji",
];

function getTimezones(value: string): string[] {
  // Full runtime list where the engine provides it (all modern browsers).
  if (typeof Intl.supportedValuesOf === "function") {
    return Intl.supportedValuesOf("timeZone");
  }
  // Hermes: no supportedValuesOf, but resolvedOptions().timeZone works —
  // merge the device zone + current value into the curated list.
  const zones = new Set(FALLBACK_TIMEZONES);
  const device = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (device) zones.add(device);
  if (value) zones.add(value);
  return [...zones].sort();
}

/**
 * Tamagui-native timezone picker built on the kit `Combobox` — the IANA
 * list is ~418 zones on web (75+ curated on Hermes), so a searchable
 * panel beats a long scroll: Popover with a filter field at ≥ md, bottom
 * Sheet on mobile/native. Uses the runtime IANA timezone list
 * (`Intl.supportedValuesOf("timeZone")`) where available, falling back
 * to a curated list on engines without it (Hermes/RN). Call sites keep
 * the `value` + `onValueChange` Select-style contract.
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
