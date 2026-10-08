// Writes the three creator-outreach sample packs next to this file.
// Run: npx tsx demo/sample-packs/build.ts
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildBreadthPack, buildStormboundPack, buildUnderstudyPack } from './samplePacks';

const out: [string, () => unknown][] = [
  ['breadth-test-pack.grimoire-pack', buildBreadthPack],
  ['stormbound-test-pack.grimoire-pack', buildStormboundPack],
  ['understudy-test-pack.grimoire-pack', buildUnderstudyPack],
];
for (const [file, build] of out) {
  const path = join(__dirname, file);
  writeFileSync(path, JSON.stringify(build(), null, 2));
  console.log(`Wrote ${path}`);
}
