module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo wires react-native-worklets/plugin (Reanimated 4's successor to
    // react-native-reanimated/plugin) automatically — listing it by hand double-applies it.
    presets: ['babel-preset-expo'],
  };
};
