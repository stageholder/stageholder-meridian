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

// Native menu support for ContextMenu / DropdownMenu via zeego. Tamagui v2
// requires this opt-in import; without it, every render of a menu primitive
// logs a warning about it not being set up.
import "@tamagui/native/setup-zeego"

// Now hand off to Expo Router. Order is critical — the imports above set
// up module-level state that the router's screens depend on.
import "expo-router/entry"
