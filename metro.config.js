const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

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
const publicContentAliases = new Map([
  ['src/content/spells/index.ts', 'src/content/public/spells.ts'],
  ['src/content/items/index.ts', 'src/content/public/items.ts'],
  ['src/content/classes/index.ts', 'src/content/public/classes.ts'],
  ['src/content/races/index.ts', 'src/content/public/races.ts'],
  ['src/content/backgrounds/index.ts', 'src/content/public/backgrounds.ts'],
  ['src/content/feats/index.ts', 'src/content/public/feats.ts'],
  ['src/content/subclasses/index.ts', 'src/content/public/subclasses.ts'],
  ['src/content/monsters/srd.ts', 'src/content/public/monsters.ts'],
].map(([from, to]) => [path.resolve(__dirname, from), path.resolve(__dirname, to)]));

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName.endsWith('.wasm')) {
    return { type: 'empty' };
  }
  // Resolve relative requests before Metro reads the original module. Looking
  // only at the default resolver result is too late on some Expo versions,
  // which reports the platform candidate rather than the authored .ts path.
  if (process.env.EXPO_PUBLIC_SRD_ONLY === 'true' && moduleName.startsWith('.')) {
    const requested = path.resolve(path.dirname(context.originModulePath), moduleName);
    for (const [source, replacement] of publicContentAliases) {
      const withoutExtension = source.replace(/\.ts$/, '');
      if (requested === source || requested === withoutExtension || requested === path.dirname(source)) {
        return { type: 'sourceFile', filePath: replacement };
      }
    }
  }
  const resolved = context.resolveRequest(context, moduleName, platform);
  if (process.env.EXPO_PUBLIC_SRD_ONLY !== 'true' || resolved?.type !== 'sourceFile') {
    return resolved;
  }
  const replacement = publicContentAliases.get(path.resolve(resolved.filePath));
  return replacement ? { type: 'sourceFile', filePath: replacement } : resolved;
};

module.exports = config;
