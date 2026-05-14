const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

module.exports = (() => {
  const config = getDefaultConfig(__dirname);

  const { transformer, resolver } = config;

  config.transformer = {
    ...transformer,
    babelTransformerPath: require.resolve("react-native-svg-transformer"),
  };
  config.resolver.assetExts = resolver.assetExts.filter((ext) => ext !== "svg");
  config.resolver.sourceExts = [...resolver.sourceExts, "svg"];

  // Ensure Metro watches the project root and node_modules
  config.projectRoot = __dirname;
  config.watchFolders = [__dirname, path.join(__dirname, "node_modules")];

  return config;
})();
