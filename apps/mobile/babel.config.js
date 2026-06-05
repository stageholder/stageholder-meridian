// apps/mobile/babel.config.js
//
// - babel-preset-expo: standard Expo preset (JSX, TS, RN syntax).
// - react-native-worklets/plugin: REQUIRED for the kit's animations and MUST
//   be last. The kit's native Tamagui config uses the Reanimated driver
//   (@tamagui/config/v5-reanimated); Reanimated 4 moved its worklet transform
//   into the separate react-native-worklets package. Without this plugin, NO
//   `transition`/`enterStyle` animation runs on native — the BottomNav sliding
//   pill, Sheet slide-up, press-scale, and celebration animations all sit
//   static. Matches the kit reference app (stageholder-ui/apps/docs-expo).
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: ["react-native-worklets/plugin"],
  };
};
