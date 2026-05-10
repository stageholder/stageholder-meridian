// Metro config for the Meridian Bun-workspace monorepo.
//
// 1. watchFolders extends Metro's reach to the monorepo root so any shared
//    workspace package changes hot-reload here.
// 2. nodeModulesPaths lets Metro resolve from the project's node_modules
//    first, falling back to the monorepo root (where bun hoists shared deps).
// 3. unstable_enablePackageExports turns on `package.json#exports` resolution
//    so `import "@stageholder/sdk/react-native"` lands at
//    dist/react-native/index.js without dragging in the /react bundle.
// 4. resolveRequest dedupe — CRITICAL for monorepos. Without it, Metro sees
//    TWO copies of react / react-native / expo (one hoisted at monorepo root,
//    one at apps/mobile/node_modules) and codegen babel chokes on the
//    duplicate, killing Metro before it binds 8081. Forcing the origin path
//    to a file inside this project makes Metro always pick the project-local
//    copy.

const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = false;
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_enableSymlinks = true;

const dedupedPackages = [
  "react",
  "react-dom",
  "react-native",
  "expo",
  "expo-modules-core",
  "expo-router",
  "expo-auth-session",
  "expo-crypto",
  "expo-secure-store",
  "expo-web-browser",
  "expo-linking",
  "expo-constants",
  "expo-status-bar",
  "react-native-safe-area-context",
  "react-native-screens",
  "@expo/metro-runtime",
];

const projectOriginPath = path.join(projectRoot, "package.json");
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const root = moduleName.split("/")[0];
  const scoped = moduleName.startsWith("@")
    ? moduleName.split("/").slice(0, 2).join("/")
    : null;
  if (
    dedupedPackages.includes(moduleName) ||
    dedupedPackages.includes(root) ||
    (scoped && dedupedPackages.includes(scoped))
  ) {
    return context.resolveRequest(
      { ...context, originModulePath: projectOriginPath },
      moduleName,
      platform,
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
