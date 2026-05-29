import { useMemo } from "react";
import { Select } from "@stageholder/ui";

export interface TimezoneSelectProps {
  value: string;
  onValueChange: (value: string) => void;
}

/**
 * Tamagui-native timezone picker built on the kit `Select`. Wraps the
 * runtime IANA timezone list (`Intl.supportedValuesOf("timeZone")`) so
 * call sites just pass `value` + `onValueChange` like any other Select.
 *
 * `Intl.supportedValuesOf` works on all modern web browsers and in modern
 * Hermes (RN). On older RN engines without it, the host app should ship
 * a polyfill (e.g. `@formatjs/intl-getcanonicallocales`) or substitute a
 * static IANA list before mounting this component.
 */
export function TimezoneSelect({ value, onValueChange }: TimezoneSelectProps) {
  const timezones = useMemo(() => Intl.supportedValuesOf("timeZone"), []);

  return (
    <Select value={value} onValueChange={onValueChange}>
      <Select.Trigger width="100%" placeholder="Select timezone..." />
      <Select.Content>
        {timezones.map((tz) => (
          <Select.Item key={tz} value={tz}>
            {tz}
          </Select.Item>
        ))}
      </Select.Content>
    </Select>
  );
}
