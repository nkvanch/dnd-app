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
// The built-in catalog is not part of the app: each module that holds catalog data is replaced by an empty one with the same
// exports (src/content/empty/). Content comes only from installed content packs. Jest and the build scripts do not go through
// Metro, so they keep the real modules, which are the source the packs are built from.
const emptyCatalog = new Map([
  ['spells/index.ts', 'spells.ts'], ['items/index.ts', 'items.ts'], ['classes/index.ts', 'classes.ts'], ['races/index.ts', 'races.ts'],
  ['backgrounds/index.ts', 'backgrounds.ts'], ['feats/index.ts', 'feats.ts'], ['subclasses/index.ts', 'subclasses.ts'],
  ['monsters/srd.ts', 'monsters.ts'], ['beastforms/index.ts', 'beastforms.ts'], ['infusions/index.ts', 'infusions.ts'],
  ['companions/index.ts', 'companions.ts'], ['conditions/index.ts', 'conditions.ts'], ['conditions/conditions2024.ts', 'conditions2024.ts'],
  ['spells/spellVersions2024.ts', 'spellVersions2024.ts'], ['feats/origin2024.ts', 'origin2024.ts'],
  ['rules/rulesReference2024Data.ts', 'rulesReference2024Data.ts'], ['builtinHomebrew.ts', 'builtinHomebrew.ts'],
].map(([from, to]) => [path.resolve(__dirname, 'src/content', from), path.resolve(__dirname, 'src/content/empty', to)]));

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName.endsWith('.wasm')) {
    return { type: 'empty' };
  }
  const resolved = context.resolveRequest(context, moduleName, platform);
  if (resolved?.type !== 'sourceFile') return resolved;
  const replacement = emptyCatalog.get(path.resolve(resolved.filePath));
  return replacement ? { type: 'sourceFile', filePath: replacement } : resolved;
};

module.exports = config;
