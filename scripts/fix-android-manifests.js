// scripts/fix-android-manifests.js
// Fixes react-native-tcp-socket's broken Android manifest/build.gradle: it uses
// the deprecated `package=` attribute in AndroidManifest.xml and has no
// namespace declared in build.gradle, which AGP 8+ rejects.
// Run automatically via postinstall. Safe to run multiple times.

const fs   = require('fs');
const path = require('path');

function fix(description, filePath, find, replace) {
  const full = path.join(__dirname, '..', filePath);
  if (!fs.existsSync(full)) {
    console.log(`  SKIP (not found): ${filePath}`);
    return;
  }
  const original = fs.readFileSync(full, 'utf8');
  if (!original.includes(find)) {
    console.log(`  SKIP (already patched): ${filePath}`);
    return;
  }
  fs.writeFileSync(full, original.replace(find, replace), 'utf8');
  console.log(`  FIXED: ${description}`);
}

console.log('fix-android-manifests.js: applying patches...');

// ── react-native-tcp-socket ──────────────────────────────────────────────────

fix(
  'tcp-socket: remove deprecated package= from manifest',
  'node_modules/react-native-tcp-socket/android/src/main/AndroidManifest.xml',
  '<manifest xmlns:android="http://schemas.android.com/apk/res/android"\n          package="com.asterinet.react.tcpsocket">',
  '<manifest xmlns:android="http://schemas.android.com/apk/res/android">'
);

fix(
  'tcp-socket: add missing namespace to build.gradle',
  'node_modules/react-native-tcp-socket/android/build.gradle',
  'android {\n    compileSdkVersion',
  'android {\n    namespace "com.asterinet.react.tcpsocket"\n    compileSdkVersion'
);

console.log('fix-android-manifests.js: done.');
