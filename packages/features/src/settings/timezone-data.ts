// Timezone list shared by both TimezoneSelect platform siblings
// (timezone-select.tsx web / timezone-select.native.tsx). Lives in its own
// module so the .native file never imports the web file's basename (Metro
// would self-resolve it — see the kit native-self-import gotcha).

/**
 * Curated IANA fallback for engines without `Intl.supportedValuesOf` —
 * notably Hermes (RN), which ships only partial Intl. Covers the major
 * zone per offset/region; the device's own zone and the current `value`
 * are merged in at runtime so the selected entry always renders.
 */
export const FALLBACK_TIMEZONES = [
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

export function getTimezones(value: string): string[] {
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
