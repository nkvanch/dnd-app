/** Deterministic, strict per-entry provenance audit against the extracted SRD 5.1 CC records. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { FULL_ITEM_LIBRARY } from '../src/content/items/index';

type CanonicalRecord = {
  canonicalId: string; name: string; category: string; description?: string | null;
  structured: Record<string, unknown>;
  source: { printedPage: number; printedEndPage: number; pdfPage: number; pdfEndPage: number; section: string; sourceHash: string; rowEvidence: string; recordStructure: string };
  normalizedText: string;
};
type Extraction = { document: string; sourceHash: string; records: CanonicalRecord[]; sections: unknown[] };
type MappingStatus = 'CONFIRMED_CANONICAL' | 'CONFIRMED_TEMPLATE_VARIANT' | 'MANUAL_AMBIGUOUS' | 'NO_CANONICAL_SOURCE';
type Mapping = {
  kind: 'canonical' | 'templateVariant' | 'unmapped'; status: MappingStatus; canonicalId?: string;
  sourcePage?: number; sourceEndPage?: number; sourceHash?: string; parameters?: { bonus: number };
  evidence: string;
};
type CanonicalMap = { document: string; sourceHash: string; mappings: Record<string, Mapping> };
const root = path.resolve(import.meta.dirname, '..');
const extraction = JSON.parse(fs.readFileSync(path.join(root, 'third_party/wotc/srd/5.1/extracted/items.json'), 'utf8')) as Extraction;
const canonicalMap = JSON.parse(fs.readFileSync(path.join(root, 'src/content/items/srdCanonicalMap.json'), 'utf8')) as CanonicalMap;
const generated = JSON.parse(fs.readFileSync(path.join(root, 'src/content/items/generatedSrdItems.json'), 'utf8')) as {
  provenance: Record<string, Record<string, unknown>>;
};
const normalize = (value: string) => value.normalize('NFKC').replace(/[’‘]/g, "'").replace(/[‐‑–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
const canonicalByName = new Map<string, CanonicalRecord[]>();
const canonicalById = new Map<string, CanonicalRecord>();
for (const record of extraction.records) {
  const key = normalize(record.name);
  canonicalByName.set(key, [...(canonicalByName.get(key) ?? []), record]);
  canonicalById.set(record.canonicalId, record);
}
// These are direct, finite instantiations expressly permitted by the named SRD
// template. They remain unverified unless their actual text/structure also matches.
const VARIANTS: Record<string, { canonical: string; bonus: number }> = {
  shield_1: { canonical: 'Shield, +1, +2, or +3', bonus: 1 }, shield_2: { canonical: 'Shield, +1, +2, or +3', bonus: 2 }, shield_3: { canonical: 'Shield, +1, +2, or +3', bonus: 3 },
  weapon_1: { canonical: 'Weapon, +1, +2, or +3', bonus: 1 }, weapon_2: { canonical: 'Weapon, +1, +2, or +3', bonus: 2 }, weapon_3: { canonical: 'Weapon, +1, +2, or +3', bonus: 3 },
  wand_of_the_war_mage_1: { canonical: 'Wand of the War Mage, +1, +2, or +3', bonus: 1 }, wand_of_the_war_mage_2: { canonical: 'Wand of the War Mage, +1, +2, or +3', bonus: 2 }, wand_of_the_war_mage_3: { canonical: 'Wand of the War Mage, +1, +2, or +3', bonus: 3 },
};
const publicItems = FULL_ITEM_LIBRARY.filter(item => item.srd === true);
const records = Object.fromEntries(publicItems.map(item => {
  const mapping = canonicalMap.mappings[item.id];
  const canonical = mapping?.canonicalId ? canonicalById.get(mapping.canonicalId) : undefined;
  const confirmed = mapping?.status === 'CONFIRMED_CANONICAL' || mapping?.status === 'CONFIRMED_TEMPLATE_VARIANT';
  // Identity confirmation alone never exposes a legacy/private Item record.
  // `verified` becomes true only when the public Item is generated directly
  // from the matching canonical record by the canonical public generator.
  const status = !mapping ? 'NO_CANONICAL_SOURCE'
    : mapping.status === 'NO_CANONICAL_SOURCE' || mapping.status === 'MANUAL_AMBIGUOUS' ? mapping.status
    : !canonical ? 'MANUAL_AMBIGUOUS'
    : mapping.status === 'CONFIRMED_TEMPLATE_VARIANT' ? 'CONFIRMED_TEMPLATE_VARIANT_PENDING_GENERATION'
    : 'CONFIRMED_CANONICAL_PENDING_GENERATION';
  const generatedProvenance = generated.provenance[item.id];
  const verified = generatedProvenance?.verified === true;
  const reason = verified ? 'Generated deterministically from source-explicit canonical fields.'
    : !mapping ? 'No unique exact canonical SRD 5.1 name or explicitly permitted template variant exists.'
    : !canonical ? 'Canonical mapping references no extracted canonical record; public exposure remains blocked.'
    : 'Canonical identity is confirmed; public exposure remains blocked until an Item is generated from canonical fields rather than inherited from private catalog data.';
  return [item.id, {
    public: true, verified, license: 'CC-BY-4.0', sourceDocument: 'SRD-5.1-CC',
    sourceEntry: canonical?.name, sourcePage: canonical?.source.printedPage, sourceEndPage: canonical?.source.printedEndPage,
    sourceSection: canonical?.source.section, sourceType: verified ? generatedProvenance?.sourceType : confirmed ? (mapping?.kind === 'templateVariant' ? 'structured-variant' : 'exact') : 'unknown',
    variantParameters: mapping?.parameters, canonicalId: canonical?.canonicalId,
    modified: false, sourceHash: extraction.sourceHash, publicTextHash: createHash('sha256').update('not-generated').digest('hex'),
    verificationMethod: mapping?.kind === 'templateVariant' ? 'explicit-srd-template-variant' : 'unique-mechanics-normalized-exact-canonical-name',
    auditStatus: verified ? 'VERIFIED_GENERATED' : status, reason, identityConfirmed: confirmed,
    ...(generatedProvenance ?? {}),
  }];
}));
const entries = Object.entries(records).map(([id, value]) => ({ id, ...(value as Record<string, any>) })) as Array<Record<string, any> & { id: string }>;
const count = (status: string) => entries.filter(entry => entry.auditStatus === status).length;
const summary = {
  source: { document: extraction.document, sourceHash: extraction.sourceHash, canonicalRecords: extraction.records.length, canonicalSections: extraction.sections.length },
  fullItems: FULL_ITEM_LIBRARY.length, currentlyClassifiedPublic: publicItems.length,
  verifiedPublic: count('VERIFIED_GENERATED'),
  confirmedCanonicalPendingGeneration: count('CONFIRMED_CANONICAL_PENDING_GENERATION'),
  confirmedTemplatePendingGeneration: count('CONFIRMED_TEMPLATE_VARIANT_PENDING_GENERATION'),
  noSource: count('NO_CANONICAL_SOURCE'), ambiguous: count('MANUAL_AMBIGUOUS'), entries,
};
const audit = path.join(root, 'artifacts/content-audit'); fs.mkdirSync(audit, { recursive: true });
fs.writeFileSync(path.join(root, 'src/content/items/srdProvenance.json'), JSON.stringify(records, null, 2) + '\n');
fs.writeFileSync(path.join(audit, 'item-provenance-report.json'), JSON.stringify(summary, null, 2) + '\n');
const rows = entries.map(x => `| ${x.id} | ${String(x.sourceEntry ?? '—')} | ${x.auditStatus} | ${String(x.reason).replace(/\|/g, '\\|')} |`).join('\n');
fs.writeFileSync(path.join(audit, 'item-provenance-report.md'), ['# SRD 5.1 Item Provenance Audit', '', '## Summary', '', `- Total classified public: ${summary.currentlyClassifiedPublic}`, `- Canonical entries extracted: ${summary.source.canonicalRecords}`, `- Confirmed canonical identity, pending generated public data: ${summary.confirmedCanonicalPendingGeneration}`, `- Confirmed template variant, pending generated public data: ${summary.confirmedTemplatePendingGeneration}`, `- Verified public exposure: ${summary.verifiedPublic}`, `- No exact canonical source: ${summary.noSource}`, `- Ambiguous canonical identity: ${summary.ambiguous}`, '', '## Per-entry audit', '', '| ID | Canonical SRD entry | Status | Reason |', '| --- | --- | --- | --- |', rows, ''].join('\n'));
console.log(`Audited ${publicItems.length} classified-public items against ${extraction.records.length} canonical entries: ${summary.verifiedPublic} verified.`);
if (summary.verifiedPublic !== publicItems.length) process.exitCode = 1;
