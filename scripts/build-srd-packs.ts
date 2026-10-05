// Builds the two first-party SRD packs into release/packs/ (see src/content/packs/srdPacks.ts).
//   npx tsx scripts/build-srd-packs.ts
import fs from 'fs';
import path from 'path';
import { buildSrd51Pack, buildSrd521Pack, serializePack } from '../src/content/packs/srdPacks';

const outDir = path.join(__dirname, '..', 'release', 'packs');
fs.mkdirSync(outDir, { recursive: true });
for (const pack of [buildSrd51Pack(), buildSrd521Pack()]) {
  const file = path.join(outDir, `${pack.manifest.id}-${pack.manifest.version}.grimoire-pack`);
  fs.writeFileSync(file, serializePack(pack));
  const kb = Math.round(fs.statSync(file).size / 1024);
  console.log(`${pack.manifest.id} ${pack.manifest.version}: ${kb} KB, hash ${pack.manifest.contentHash.slice(0, 12)}, ${JSON.stringify(pack.manifest.counts)}`);
}
