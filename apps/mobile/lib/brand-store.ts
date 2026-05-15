// apps/mobile/lib/brand-store.ts
//
// Cross-screen brand state, persisted to expo-secure-store. The brand
// determines which sub-theme @stageholder/ui's BrandProvider applies on
// top of the base dark theme:
//
//   cosmos   — deep navy   (the night-sky default)
//   fortune  — warm amber  (sunrise / abundance)
//   cottage  — fern green  (grounded / pastoral)
//
// Reading the persisted value happens at root layout via hydrate(). Until
// then, brand defaults to "cosmos" so the first render doesn't flash a
// theme swap.

import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

export type Brand = "cosmos" | "fortune" | "cottage";

// Underscore separator: expo-secure-store rejects keys with chars outside
// [A-Za-z0-9_-]. A colon throws "Invalid key provided to SecureStore".
const KEY = "meridian_brand";
const VALID: ReadonlyArray<Brand> = ["cosmos", "fortune", "cottage"];

type BrandStore = {
  brand: Brand;
  hydrated: boolean;
  setBrand: (b: Brand) => Promise<void>;
  hydrate: () => Promise<void>;
};

export const useBrandStore = create<BrandStore>((set) => ({
  brand: "cosmos",
  hydrated: false,
  async setBrand(b) {
    set({ brand: b });
    try {
      await SecureStore.setItemAsync(KEY, b);
    } catch {
      // Persistence failure is non-fatal — the in-memory swap still works
      // until next launch.
    }
  },
  async hydrate() {
    try {
      const v = (await SecureStore.getItemAsync(KEY)) as Brand | null;
      if (v && (VALID as readonly string[]).includes(v)) {
        set({ brand: v, hydrated: true });
        return;
      }
    } catch {
      // fall through to default
    }
    set({ hydrated: true });
  },
}));

// Visual preview metadata for the brand-picker UI on Profile. Two-stop
// gradient hints at the brand's atmosphere without being literally the
// theme's surface color.
export const BRAND_PREVIEW: Record<
  Brand,
  { primary: string; accent: string; label: string; copy: string }
> = {
  cosmos: {
    primary: "#0d1530",
    accent: "#5b8def",
    label: "Cosmos",
    copy: "Deep navy. Night sky.",
  },
  fortune: {
    primary: "#3a1f0d",
    accent: "#f59e0b",
    label: "Fortune",
    copy: "Warm amber. Sunrise.",
  },
  cottage: {
    primary: "#0f2614",
    accent: "#22c55e",
    label: "Cottage",
    copy: "Fern green. Grounded.",
  },
};
