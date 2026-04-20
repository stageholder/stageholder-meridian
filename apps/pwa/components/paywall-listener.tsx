"use client";

import { useEffect, useState } from "react";
import { PaywallModal } from "./paywall-modal";

interface PaywallEventDetail {
  feature: string;
  limit: number;
}

export function PaywallListener() {
  const [state, setState] = useState<{
    open: boolean;
    feature: string;
    limit: number;
  }>({ open: false, feature: "", limit: 0 });

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<PaywallEventDetail>).detail;
      setState({ open: true, feature: detail.feature, limit: detail.limit });
    };
    window.addEventListener("meridian:paywall", handler);
    return () => window.removeEventListener("meridian:paywall", handler);
  }, []);

  return (
    <PaywallModal
      open={state.open}
      onClose={() => setState((s) => ({ ...s, open: false }))}
      feature={state.feature}
      limit={state.limit}
    />
  );
}
