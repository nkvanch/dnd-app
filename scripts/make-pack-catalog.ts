// Writes the catalog of downloadable packs the app reads (src/content/packDownload.ts) next to the pack files.
//   npx tsx scripts/make-pack-catalog.ts <base-url> [--include-private]
// <base-url> is where the pack files will be uploaded, e.g. https://github.com/<owner>/<repo>/releases/download/<tag>/ .
// Only the CC-BY-4.0 SRD packs are listed unless --include-private is given: the private packs are not licensed for redistribution
// and must not be put where anyone can fetch them. Upload release/packs/*.grimoire-pack and release/packs/grimoire-packs.json to that address.
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

const base = process.argv[2];
if (!base || !/^https:\/\//.test(base)) { console.error('Usage: npx tsx scripts/make-pack-catalog.ts https://where/the/files/are/ [--include-private]'); process.exit(1); }
const includePrivate = process.argv.includes('--include-private');
const dir = path.join(__dirname, '..', 'release', 'packs');
const packs: Record<string, unknown>[] = [];
for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.grimoire-pack')).sort()) {
  const buf = fs.readFileSync(path.join(dir, file));
  const m = JSON.parse(buf.toString('utf8')).manifest;
  if (m.license !== 'CC-BY-4.0' && !includePrivate) { console.log(`skipped (private): ${file}`); continue; }
  packs.push({ id: m.id, name: m.name, version: m.version, ruleset: m.ruleset, url: base.replace(/\/?$/, '/') + file, sha256: createHash('sha256').update(buf).digest('hex'), size: buf.length, description: m.description ?? undefined });
  console.log(`listed: ${file} (${Math.round(buf.length / 1024)} KB)`);
}
fs.writeFileSync(path.join(dir, 'grimoire-packs.json'), JSON.stringify({ format: 'grimoire-pack-catalog', version: 1, packs }, null, 2) + '\n');
console.log(`Wrote release/packs/grimoire-packs.json with ${packs.length} pack(s).`);
