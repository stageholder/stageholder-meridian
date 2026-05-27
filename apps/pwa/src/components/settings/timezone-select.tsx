import { useMemo } from "react";
import { Select } from "@stageholder/ui";

interface TimezoneSelectProps {
  value: string;
  onValueChange: (value: string) => void;
}

/**
 * Tamagui-native timezone picker built on the kit `Select`. The kit ships
 * no dedicated timezone component, so this wraps `Select` with the runtime
 * IANA timezone list (`Intl.supportedValuesOf("timeZone")`).
 *
 * The props match the previous local component verbatim
 * (`{ value, onValueChange }`) so the settings/onboarding call sites are
 * unchanged.
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
