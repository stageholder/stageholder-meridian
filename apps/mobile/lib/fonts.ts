// apps/mobile/lib/fonts.ts
//
// Registers the Geist / Geist Mono font faces under the family names the kit's
// native font config expects. @stageholder/ui's config/fonts.native.ts builds
// its body/heading font on family "Geist" and its mono font on family
// "GeistMono" — for those `fontFamily` values to actually resolve at runtime,
// faces with EXACTLY those names must be loaded via expo-font before first
// render.
//
// The face keys here mirror the kit's weight face table: in addition to the
// 400 regular face that owns the family name, Tamagui's font weight steps
// (500/600/700) resolve to the "<Family>-<Weight>" face names
// ("Geist-Medium", "Geist-SemiBold", "Geist-Bold"), so we register those too.
// Without the weighted faces, a `<Text fontWeight="600">` would fall back to a
// synthesized bold of the 400 face instead of the real SemiBold cut.
//
// Mono only needs the single 400 face — the kit's mono font doesn't declare
// weighted variants.

import {
  useFonts,
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from "@expo-google-fonts/geist";
import { GeistMono_400Regular } from "@expo-google-fonts/geist-mono";

/**
 * Load the kit's expected font faces. Returns `[loaded, error]` straight from
 * expo-font's `useFonts` — the root layout gates the splash screen on `loaded`
 * (and surfaces `error` only in dev; a font load failure shouldn't hard-block
 * the app, the system font is an acceptable fallback).
 */
export function useAppFonts(): [boolean, Error | null] {
  return useFonts({
    // Family-name face: owns "Geist", used at the 400 weight default.
    Geist: Geist_400Regular,
    // Weighted faces — names match Tamagui's `<Family>-<Weight>` lookup.
    "Geist-Medium": Geist_500Medium,
    "Geist-SemiBold": Geist_600SemiBold,
    "Geist-Bold": Geist_700Bold,
    // Mono family-name face.
    GeistMono: GeistMono_400Regular,
  });
}
