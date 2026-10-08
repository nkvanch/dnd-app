// Gate: the stripped copy's catalog must equal the SRD keep-set exactly (no extra, none missing),
// and nothing nested (subraces, subclasses' options) may carry srd:false or an unflagged marker.
// Run from the COPY's root: npx tsx <path>/verify.ts <sets.json>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const sets = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) as Record<string, { keep: string[]; remove: string[] }>;
const root = pathToFileURL(path.resolve('src/content')).href + '/';
const idOf = (e: any) => e.id;
let bad = 0;
function check(type: string, arr: any[], key: (e: any) => string = idOf) {
  const have = new Set(arr.map(key));
  const keep = new Set(sets[type].keep);
  const extra = [...have].filter(x => !keep.has(x));
  const missing = [...keep].filter(x => !have.has(x));
  console.log(type.padEnd(12), 'have', have.size, 'keep', keep.size, 'extra', extra.length, 'missing', missing.length);
  if (extra.length) { bad++; console.log('  EXTRA  ', extra.join(', ')); }
  if (missing.length) { bad++; console.log('  MISSING', missing.join(', ')); }
}
(async () => {
  check('spells', (await import(root + 'spells/index.ts')).FULL_SPELL_LIBRARY);
  check('items', (await import(root + 'items/index.ts')).FULL_ITEM_LIBRARY);
  const races = (await import(root + 'races/index.ts')).FULL_RACE_LIBRARY;
  check('races', races);
  check('feats', (await import(root + 'feats/index.ts')).FULL_FEAT_LIBRARY);
  check('backgrounds', (await import(root + 'backgrounds/index.ts')).FULL_BACKGROUND_LIBRARY);
  { const sc = (await import(root + 'subclasses/index.ts')).FULL_SUBCLASS_LIBRARY as any[]; const ok = sc.length === sets.subclasses.keep.length && sc.every(x => x.srd === true); console.log('subclasses'.padEnd(12), 'have', sc.length, 'keep', sets.subclasses.keep.length, ok ? '' : 'MISMATCH'); if (!ok) bad++; }
  check('monsters', (await import(root + 'monsters/srd.ts')).FULL_MONSTER_LIBRARY);
  check('classes', (await import(root + 'classes/index.ts')).ALL_CHAR_CLASSES_CATALOG);
  check('conditions', (await import(root + 'conditions/index.ts')).ALL_CONDITIONS);
  // nested: subraces
  for (const r of races) for (const key of ['subraces', 'subracesOptional']) for (const s of Array.isArray((r as any)[key]) ? (r as any)[key] : []) {
    if (s.srd !== true) { bad++; console.log('  SUBRACE not srd:true ->', r.id, key, s.id, 'srd=', s.srd); }
  }
  console.log(bad ? `\nVERIFY FAILED (${bad})` : '\nVERIFY OK');
  process.exit(bad ? 1 : 0);
})();
