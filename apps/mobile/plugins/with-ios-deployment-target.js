// Expo config plugin: raise IPHONEOS_DEPLOYMENT_TARGET on EVERY Pods target.
//
// Why: Xcode 26+/27 refuses to plan a build when any target's deployment
// target is below 15.0. React Native's post_install only raises the floor on
// pod *library* targets; resource-bundle targets (RevenueCat, PurchasesHybridCommon,
// RNCAsyncStorage_resources, RNSVGFilters) keep their podspec value (12.4–13.4)
// and fail with "deployment target ... is set to 13.0, but the range of
// supported deployment target versions is 15.0 to 27.x".
//
// `ios/` is generated (CNG), so the Podfile is patched here instead of by hand.
const { withPodfile } = require("expo/config-plugins");

const MARKER = "# [with-ios-deployment-target]";

const SNIPPET = `    ${MARKER} raise every Pods target to the app floor (Xcode 26+ rejects < 15.0)
    min_ios = (podfile_properties['ios.deploymentTarget'] || '16.4').to_f
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        current = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f
        config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = min_ios.to_s if current < min_ios
      end
    end
`;

module.exports = function withIosDeploymentTarget(config) {
  return withPodfile(config, (cfg) => {
    const podfile = cfg.modResults.contents;
    if (podfile.includes(MARKER)) return cfg;
    const anchor = /^(\s*)post_install do \|installer\|\n/m;
    if (!anchor.test(podfile)) {
      throw new Error(
        "[with-ios-deployment-target] could not find `post_install do |installer|` in ios/Podfile",
      );
    }
    cfg.modResults.contents = podfile.replace(anchor, (line) => line + SNIPPET);
    return cfg;
  });
};
