import {
  ActivityRings as ActivityRingsView,
  type ActivityRingsSize,
} from "@repo/features/activity-rings";
import { useActivityRings } from "@/lib/hooks/use-activity-rings";

interface ActivityRingsProps {
  date: string;
  size?: ActivityRingsSize;
  showLabels?: boolean;
  bare?: boolean;
  className?: string;
}

/**
 * PWA wrapper: calls the local `useActivityRings(date)` hook (which
 * pulls from Dexie-backed calendar + habits + light) and renders the
 * shared cross-platform view. Mobile ships an equivalent wrapper of the
 * same name around `ActivityRingsView` with its own data hook.
 */
export function ActivityRings({ date, ...rest }: ActivityRingsProps) {
  const { data, isLoading, details } = useActivityRings(date);
  return (
    <ActivityRingsView
      data={data}
      details={details}
      isLoading={isLoading}
      {...rest}
    />
  );
}
