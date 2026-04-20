import { z } from "zod";

// IANA timezone validator — Node 20+ exposes Intl.supportedValuesOf. Falls
// back to a permissive try/catch on older runtimes so we never throw here.
function isValidTimezone(tz: string): boolean {
  try {
    const supported = (Intl as any).supportedValuesOf?.("timeZone") as
      | string[]
      | undefined;
    if (supported) return supported.includes(tz);
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const CompleteOnboardingDto = z.object({
  timezone: z.string().min(1).refine(isValidTimezone, {
    message: "timezone must be a valid IANA zone",
  }),
});
export type CompleteOnboardingDto = z.infer<typeof CompleteOnboardingDto>;
