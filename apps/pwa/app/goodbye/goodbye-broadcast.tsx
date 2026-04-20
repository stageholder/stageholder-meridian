"use client";

import { useEffect } from "react";
import { announceLogout } from "@/lib/auth-broadcast";

/**
 * Fires the cross-tab logout broadcast only once we've actually landed on
 * /goodbye. At this point the Hub has finished its end-session flow and
 * the iron-session cookie is gone, so peer tabs hard-navigating to
 * /auth/login won't silent-SSO straight back in. Broadcasting before this
 * point (e.g. from the sign-out button handler) races the Hub redirect
 * chain and puts other tabs back into a signed-in state.
 */
export function GoodbyeBroadcast(): null {
  useEffect(() => {
    announceLogout();
  }, []);
  return null;
}
