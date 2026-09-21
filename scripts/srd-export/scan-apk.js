// Scans an extracted APK folder for names of removed (non-SRD) content. Read-only.
// Usage: node scripts/srd-export/scan-apk.js <sets.json> <extractedApkDir>
// Extract first, e.g.: Copy-Item x.apk x.zip; Expand-Archive x.zip -DestinationPath out
const fs = require('fs');
const path = require('path');

const sets = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const root = process.argv[3];
const keep = new Set();
for (const t of Object.keys(sets)) for (const n of sets[t].keepNames || []) keep.add(n.toLowerCase());
const COMMON = new Set(['resilient', 'telepathic', 'invulnerability', 'scatter', 'mobile', 'durable', 'skilled', 'healer', 'sentinel', 'athlete', 'observant', 'lucky', 'tough', 'alert', 'actor', 'linguist', 'skulker', 'crusher', 'piercer', 'slasher', 'poisoner', 'gunner', 'prodigy', 'staff', 'whirlwind', 'phantom', 'mastermind', 'inquisitive', 'swashbuckler', 'gambler', 'entertainer', 'charlatan', 'criminal', 'hermit', 'outlander', 'sailor', 'soldier', 'urchin', 'noble', 'sage']);
const terms = new Set();
for (const t of ['spells', 'items', 'races', 'feats', 'backgrounds', 'subclasses', 'classes', 'infusions']) {
  for (const n of sets[t].removeNames || []) {
    const l = n.toLowerCase();
    if (l.length >= 8 && !keep.has(l) && !COMMON.has(l)) terms.add(l);
  }
}
for (const x of ['xanathar', "tasha's", 'fizban', 'mordenkainen', 'eberron', 'strixhaven', 'spelljammer', 'blood hunter', 'abyss knight', 'artificer', 'hexblade', 'dragonmark', 'unearthed arcana']) terms.add(x);

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else files.push(p);
  }
})(root);

let scanned = 0, hitFiles = 0;
for (const f of files) {
  const buf = fs.readFileSync(f);
  if (buf.length < 64) continue;
  scanned++;
  const ascii = buf.toString('latin1').toLowerCase();
  const wide = buf.toString('utf16le').toLowerCase();
  const hits = [...terms].filter(t => ascii.includes(t) || wide.includes(t));
  if (hits.length) { hitFiles++; console.log(String(hits.length).padStart(4), path.relative(root, f), '::', hits.slice(0, 8).join(', ')); }
}
console.log(`scanned ${scanned} files, ${terms.size} terms, files with hits: ${hitFiles}`);
process.exit(hitFiles ? 1 : 0);
