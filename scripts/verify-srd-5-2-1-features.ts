// Checks the class, subclass and species features of the SRD 5.2.1 pack against the PDF text.
//   npx tsx scripts/verify-srd-5-2-1-features.ts [--json]
// For each feature the pack carries, the feature's name must be a heading or a bold run-in title in the PDF (a "Level N: Name" heading for class
// features, "Name." for species traits and option features), and its description must share most of its words with the PDF passage that
// follows that title. A feature whose description is shorter than the SRD's (a summary) or longer (the app's own notes, such as "Your own bonus
// is applied ...") shows up as low coverage; the report lists them so a person can read them. It does not prove a rules text is identical.
import fs from 'fs';
import path from 'path';
import { buildSrd51Pack, buildSrd521Pack, serializePack } from '../src/content/packs/srdPacks';
import { packContentProvider } from '../src/content/provider/contentProvider';
import { RulesetId } from '../src/engine/types';

const root = path.join(__dirname, '..');
const flat = fs.readFileSync(path.join(root, 'release', 'srd521.txt'), 'utf8').replace(/\f/g, '\n').replace(/\r/g, '')
  .replace(/\n\d+ System Reference Document 5\.2\.1\n|\nSystem Reference Document 5\.2\.1 \d+\n/g, '\n').replace(/\s+/g, ' ');
const norm = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[­‐-―]/g, '').replace(/[‘’]/g, "'").replace(/[^a-z0-9']+/g, ' ').trim();
const words = (s: string) => new Set(norm(s).split(' ').filter(w => w.length > 2));

const packs = [buildSrd51Pack(), buildSrd521Pack()].map(p => JSON.parse(serializePack(p)));
const provider = packContentProvider(packs, 'dnd5e-2024' as RulesetId);

type F = { id: string; name: string; description: string };
const collect = (node: unknown, out: F[], seen = new Set<unknown>()) => {
  if (!node || typeof node !== 'object' || seen.has(node)) return; seen.add(node);
  const o = node as Record<string, unknown>;
  if (typeof o.id === 'string' && typeof o.name === 'string' && typeof o.description === 'string' && ('source' in o || 'effects' in o)) out.push({ id: o.id, name: o.name, description: o.description });
  for (const v of Object.values(o)) collect(v, out, seen);
};

const groups: Record<string, F[]> = {};
for (const c of provider.classes()) { const fs_: F[] = []; collect((c as { rawProgression?: unknown }).rawProgression, fs_); groups[c.id] = fs_; }
for (const s of provider.subclasses()) { const fs_: F[] = []; collect(s, fs_); groups[s.id] = fs_; }
for (const r of provider.races()) { if (!r.id.endsWith('_2024')) continue; const fs_: F[] = []; collect(r, fs_); groups[r.id] = fs_; }

const rows: { group: string; feature: string; coverage: number; titleFound: boolean }[] = [];
for (const [group, list] of Object.entries(groups)) {
  const seenNames = new Set<string>();
  for (const f of list) {
    if (/\(Magic Initiate\)|\(Versatile\)|^Wild Shape: |^Spellcasting Ability: |^(Polar|Temperate|Tropical|Arid|Dry|Cold|Desert|Swamp|Mountain|Coast)/.test(f.name)) continue;
    const name = f.name.replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (!name || seenNames.has(name)) continue; seenNames.add(name);
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const title = new RegExp('(?:Level \\d+: |[.!?] |\\) )' + esc + '[. ]').exec(flat) ?? new RegExp(esc + '\\.').exec(flat) ?? new RegExp(esc + ' (?:Fighting Style|Origin|General|Epic Boon) Feat').exec(flat);
    if (!title) { rows.push({ group, feature: name, coverage: 0, titleFound: false }); continue; }
    const passage = flat.slice(title.index, title.index + Math.max(1500, f.description.length * 2));
    const a = words(f.description), b = words(passage);
    const covered = a.size ? [...a].filter(w => b.has(w)).length / a.size : 1;
    rows.push({ group, feature: name, coverage: Math.round(covered * 100) / 100, titleFound: true });
  }
}
const noTitle = rows.filter(r => !r.titleFound), low = rows.filter(r => r.titleFound && r.coverage < 0.8);
const summary = { features: rows.length, titleNotFound: noTitle.length, coverageUnder80: low.length, coverageAtLeast80: rows.length - noTitle.length - low.length };
if (process.argv.includes('--json')) console.log(JSON.stringify({ summary, noTitle, low }, null, 1));
else {
  console.log(JSON.stringify(summary));
  console.log('title not found in the PDF:\n' + noTitle.map(r => `  ${r.group}: ${r.feature}`).join('\n'));
  console.log('description shares under 80% of its words with the PDF passage:\n' + low.map(r => `  ${r.group}: ${r.feature} (${Math.round(r.coverage * 100)}%)`).join('\n'));
}
