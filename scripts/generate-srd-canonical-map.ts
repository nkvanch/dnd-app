/** Generate a reviewable, non-runtime SRD 5.1 canonical mapping manifest. */
import fs from 'node:fs';
import path from 'node:path';
import { FULL_ITEM_LIBRARY } from '../src/content/items/index';

type Canonical = {
  canonicalId: string;
  name: string;
  source: { printedPage: number; printedEndPage: number; section: string; sourceHash: string };
};
type Extraction = { document: string; sourceHash: string; records: Canonical[] };
const root = path.resolve(import.meta.dirname, '..');
const extraction = JSON.parse(fs.readFileSync(path.join(root, 'third_party/wotc/srd/5.1/extracted/items.json'), 'utf8')) as Extraction;
const normalize = (text: string) => text.normalize('NFKC').replace(/[’‘]/g, "'").replace(/[‐‑–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
const byName = new Map<string, Canonical[]>();
for (const record of extraction.records) byName.set(normalize(record.name), [...(byName.get(normalize(record.name)) ?? []), record]);
const templates: Record<string, { name: string; bonus: number }> = {
  shield_1: { name: 'Shield, +1, +2, or +3', bonus: 1 }, shield_2: { name: 'Shield, +1, +2, or +3', bonus: 2 }, shield_3: { name: 'Shield, +1, +2, or +3', bonus: 3 },
  weapon_1: { name: 'Weapon, +1, +2, or +3', bonus: 1 }, weapon_2: { name: 'Weapon, +1, +2, or +3', bonus: 2 }, weapon_3: { name: 'Weapon, +1, +2, or +3', bonus: 3 },
  wand_of_the_war_mage_1: { name: 'Wand of the War Mage, +1, +2, or +3', bonus: 1 }, wand_of_the_war_mage_2: { name: 'Wand of the War Mage, +1, +2, or +3', bonus: 2 }, wand_of_the_war_mage_3: { name: 'Wand of the War Mage, +1, +2, or +3', bonus: 3 },
};
const mappings: Record<string, unknown> = {};
const analysis: { id: string; name: string; bucket: string; candidate: string; evidence: string; action: string }[] = [];
for (const item of FULL_ITEM_LIBRARY.filter(item => item.srd === true)) {
  const variant = templates[item.id];
  const candidates = byName.get(normalize(variant?.name ?? item.name)) ?? [];
  if (candidates.length === 1) {
    const canonical = candidates[0];
    mappings[item.id] = variant
      ? {
          kind: 'templateVariant', status: 'CONFIRMED_TEMPLATE_VARIANT', canonicalId: canonical.canonicalId,
          parameters: { bonus: variant.bonus }, sourcePage: canonical.source.printedPage,
          sourceEndPage: canonical.source.printedEndPage, sourceHash: canonical.source.sourceHash,
          evidence: `Explicit SRD template ${canonical.name}; permitted bonus ${variant.bonus}.`,
        }
      : {
          kind: 'canonical', status: 'CONFIRMED_CANONICAL', canonicalId: canonical.canonicalId,
          sourcePage: canonical.source.printedPage, sourceEndPage: canonical.source.printedEndPage,
          sourceHash: canonical.source.sourceHash,
          evidence: `Unique normalized exact canonical name on SRD p.${canonical.source.printedPage}.`,
        };
    analysis.push({
      id: item.id, name: item.name,
      bucket: variant ? 'CONFIRMED_TEMPLATE_VARIANT' : 'CONFIRMED_CANONICAL',
      candidate: canonical.name, evidence: String((mappings[item.id] as any).evidence),
      action: 'Eligible for canonical-data generation; do not inherit private fields or prose.',
    });
  } else {
    const status = candidates.length > 1 ? 'MANUAL_AMBIGUOUS' : 'NO_CANONICAL_SOURCE';
    const evidence = candidates.length > 1
      ? 'Multiple canonical records share the normalized name.'
      : 'No exact canonical name or explicit template match in current extraction.';
    mappings[item.id] = {
      kind: 'unmapped', status, evidence,
      verificationMethod: 'none — strict canonical identity not established',
    };
    analysis.push({ id: item.id, name: item.name, bucket: status, candidate: '—', evidence, action: 'Keep blocked; do not infer identity or non-SRD status.' });
  }
}
const output = {
  document: extraction.document, sourceHash: extraction.sourceHash, generatorVersion: 2,
  policy: 'Only a unique mechanics-normalized exact canonical name or a finite explicit SRD template variant is confirmed. Aliases, fuzzy matches, ambiguous matches, and unsupported variants remain blocked.',
  mappings,
};
fs.writeFileSync(path.join(root, 'src/content/items/srdCanonicalMap.json'), JSON.stringify(output, null, 2) + '\n');
const report = ['# SRD 5.1 item canonical-mapping review', '', '| Grimoire ID | Name | Bucket | Candidate Canonical Entry | Evidence | Action |', '| --- | --- | --- | --- | --- | --- |', ...analysis.map(row => `| ${row.id} | ${row.name.replace(/\|/g, '\\|')} | ${row.bucket} | ${row.candidate.replace(/\|/g, '\\|')} | ${row.evidence.replace(/\|/g, '\\|')} | ${row.action} |`), ''];
fs.mkdirSync(path.join(root, 'artifacts/content-audit'), { recursive: true });
fs.writeFileSync(path.join(root, 'artifacts/content-audit/unknown-item-buckets.md'), report.join('\n'));
const confirmedCount = analysis.filter(row => row.bucket === 'CONFIRMED_CANONICAL' || row.bucket === 'CONFIRMED_TEMPLATE_VARIANT').length;
console.log(`Generated ${confirmedCount} confirmed canonical mappings; ${analysis.length - confirmedCount} remain blocked.`);
