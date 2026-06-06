const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Stub Node.js built-ins that some npm packages reference.
// These modules do not exist in React Native.
config.resolver.extraNodeModules = {
  'node:fs':     require.resolve('./src/mocks/node-stub.js'),
  'node:path':   require.resolve('./src/mocks/node-stub.js'),
  'node:os':     require.resolve('./src/mocks/node-stub.js'),
  'node:crypto': require.resolve('./src/mocks/node-stub.js'),
  'node:buffer': require.resolve('./src/mocks/node-stub.js'),
  'fs':          require.resolve('./src/mocks/node-stub.js'),
  'path':        require.resolve('./src/mocks/node-stub.js'),
  'os':          require.resolve('./src/mocks/node-stub.js'),
  'crypto':      require.resolve('./src/mocks/node-stub.js'),
};

// Exclude SQLite WASM from web builds.
// expo-sqlite ships a wa-sqlite WASM file for web that Metro cannot bundle.
// This app targets iOS and Android only — the web platform guard in db.ts
// prevents any runtime SQLite calls, and this resolver prevents the bundler
// error entirely by returning an empty module for any .wasm file on web.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName.endsWith('.wasm')) {
    return { type: 'empty' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
