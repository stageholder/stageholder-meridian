// apps/mobile/index.js
//
// Custom entry point for Tamagui v2 + Expo Router. Per Tamagui v2 docs:
// "These setup imports must be executed BEFORE the expo-router/entry module
// is loaded, which is best achieved by creating a custom entry point file
// and updating your package.json main field accordingly."
//
//   https://tamagui.dev/docs/intro/installation (Native Setup section)
//
// Without this file, native portals (Sheet, Dialog, Popover, Select, Toast)
// don't preserve React context across the portal boundary — your custom
// providers (BrandProvider, HapticProvider, ToastProvider) are invisible
// inside any portaled content.

// Native portal setup. Required for Sheet/Dialog/Popover/Select/Toast to
// keep React context across the portal boundary.
import "@tamagui/native/setup-teleport"

// Smoother bottom-sheet drag — uses react-native-gesture-handler under
// the hood (which we already have installed for SwipeableRow etc).
import "@tamagui/native/setup-gesture-handler"

// LinearGradient driver for the kit's GradientSurface on native (the level
// progress bar's gold fill, etc). Required at root or every GradientSurface
// render warns "Must call import '@tamagui/native/setup-expo-linear-gradient'
// at root". Backed by expo-linear-gradient (an install dep).
import "@tamagui/native/setup-expo-linear-gradient"

// setup-zeego intentionally SKIPPED — matches the kit reference app
// (stageholder-ui/apps/docs-expo/index.ts). It enables zeego-backed menus
// for TAMAGUI'S OWN menu primitives, which @stageholder/ui doesn't use:
// the kit's DropdownMenu/ContextMenu are built on Popover + Adapt→Sheet
// (pure Tamagui, cross-platform). Importing it without the `zeego` package
// installed just logs "Error setting up Zeego" at every startup.
// If a future feature wants real native menus: `bun add zeego` (+ its
// native deps + prebuild), then restore:
// import "@tamagui/native/setup-zeego"

// Now hand off to Expo Router. Order is critical — the imports above set
// up module-level state that the router's screens depend on.
import "expo-router/entry"
