const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Supabase realtime-js tries to import 'ws' (Node.js WebSocket library).
// In React Native, WebSocket is a global — redirect the import to a shim.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  ws: require.resolve('./src/wsShim.js'),
};

module.exports = config;
