const {
  withXcodeProject,
  withDangerousMod,
  withPlugins,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const withAppExit = (config) => {
  return withPlugins(config, [withAppExitFiles, withAppExitLinking]);
};

const withAppExitFiles = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;

      const iosAppName = "HamsaHealing";
      const iosRoot = path.join(projectRoot, "ios");
      const destDir = path.join(iosRoot, iosAppName);

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      const headerContent = `#import <React/RCTBridgeModule.h>

@interface AppExit : NSObject <RCTBridgeModule>
@end
`;

      const sourceContent = `#import "AppExit.h"

@implementation AppExit

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(exitApp)
{
  exit(0);
}

@end
`;

      fs.writeFileSync(path.join(destDir, "AppExit.h"), headerContent);
      fs.writeFileSync(path.join(destDir, "AppExit.m"), sourceContent);

      return config;
    },
  ]);
};

const withAppExitLinking = (config) => {
  return withXcodeProject(config, async (config) => {
    const project = config.modResults;
    const iosAppName = "HamsaHealing";

    const groupKey = project.findPBXGroupKey({ name: iosAppName });

    if (!groupKey) {
      console.warn(
        "Could not find PBXGroup for " +
          iosAppName +
          ". AppExit module might not be linked correctly.",
      );
      return config;
    }

    project.addHeaderFile(
      "HamsaHealing/AppExit.h",
      { target: project.getFirstTarget().uuid },
      groupKey,
    );
    project.addSourceFile(
      "HamsaHealing/AppExit.m",
      { target: project.getFirstTarget().uuid },
      groupKey,
    );

    return config;
  });
};

module.exports = withAppExit;
