// Computes, from the private repo's full catalog, which ids are SRD (keep) and which are not (remove).
// Policy: keep only entries with an explicit `srd === true`. Unflagged entries are removed (conservative),
// except SRD-vocabulary types listed in KEEP_UNFLAGGED below.
// Run: npx tsx scripts/srd-export/compute-sets.ts <out.json>
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = pathToFileURL(path.resolve('src/content')).href + '/';
type Entry = { id: string; name?: string; srd?: boolean };
const out: Record<string, { keep: string[]; keepNames: string[]; remove: string[]; removeNames: string[] }> = {};

function classify(type: string, arr: Entry[], keepUnflagged = false) {
  const keep: string[] = [], keepNames: string[] = [], remove: string[] = [], removeNames: string[] = [];
  for (const e of arr) {
    const ok = e.srd === true || (keepUnflagged && e.srd === undefined);
    (ok ? keep : remove).push(e.id);
    if (ok && e.name) keepNames.push(e.name);
    if (!ok && e.name) removeNames.push(e.name);
  }
  out[type] = { keep, keepNames, remove, removeNames };
}

(async () => {
  classify('spells', (await import(root + 'spells/index.ts')).FULL_SPELL_LIBRARY);
  classify('items', (await import(root + 'items/index.ts')).FULL_ITEM_LIBRARY);
  classify('races', (await import(root + 'races/index.ts')).FULL_RACE_LIBRARY);
  classify('feats', (await import(root + 'feats/index.ts')).FULL_FEAT_LIBRARY);
  classify('backgrounds', (await import(root + 'backgrounds/index.ts')).FULL_BACKGROUND_LIBRARY);
  classify('subclasses', (await import(root + 'subclasses/index.ts')).FULL_SUBCLASS_LIBRARY);
  classify('monsters', (await import(root + 'monsters/srd.ts')).FULL_MONSTER_LIBRARY);
  classify('classes', (await import(root + 'classes/index.ts')).ALL_CHAR_CLASSES_CATALOG);
  classify('conditions', (await import(root + 'conditions/index.ts')).ALL_CONDITIONS, true);
  classify('beastforms', (await import(root + 'beastforms/index.ts')).ALL_BEAST_FORMS);
  classify('infusions', (await import(root + 'infusions/index.ts')).ALL_INFUSIONS);
  fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
  for (const [k, v] of Object.entries(out)) console.log(k.padEnd(12), 'keep', v.keep.length, 'remove', v.remove.length);
})();
