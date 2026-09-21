// Writes demo/aster-test-pack/aster-test-pack.grimoire-pack (importable via
// Homebrew → Import Homebrew). Run: npx tsx demo/aster-test-pack/build.ts
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildAsterTestPack } from './asterTestPack';

const out = join(__dirname, 'aster-test-pack.grimoire-pack');
writeFileSync(out, JSON.stringify(buildAsterTestPack(), null, 2));
console.log(`Wrote ${out}`);
