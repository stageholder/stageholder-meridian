import { AsyncLocalStorage } from "node:async_hooks";
import type { NextFunction, Request, Response } from "express";

/**
 * The caller's IANA timezone for the current request, from the
 * `X-Timezone` header both clients send (PWA `ServiceWrapper`, mobile
 * `createMeridianClient`). Lets the server compute "today" in the USER's
 * zone instead of one server-wide DEFAULT_TIMEZONE — before this, a check-in
 * / todo / journal near midnight for a user in another zone was dated (and
 * its Light ring evaluated) on the wrong day.
 */
const store = new AsyncLocalStorage<{ timeZone?: string }>();

function isValidTimeZone(tz: string): boolean {
  if (tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Express middleware: binds the validated `X-Timezone` to this request. */
export function requestTimezoneMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const raw = req.header("x-timezone");
  const timeZone = raw && isValidTimeZone(raw) ? raw : undefined;
  store.run({ timeZone }, next);
}

/** The request's timezone, else DEFAULT_TIMEZONE, else UTC. */
export function requestTimeZone(): string {
  return store.getStore()?.timeZone || process.env.DEFAULT_TIMEZONE || "UTC";
}

/** Today's yyyy-mm-dd in the request's timezone. */
export function todayKey(timeZone: string = requestTimeZone()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}
