/**
 * Deterministically builds the SRD-only Item catalog from extracted SRD 5.1
 * records. This script deliberately imports neither importedItems.ts nor the
 * full catalog: a generated record can only contain source-table fields and
 * explicit format conversions documented in its provenance.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

type Canonical = {
  canonicalId: string; name: string; category: string; description: string | null;
  structured: Record<string, unknown>;
  source: { printedPage: number; printedEndPage: number; section: string; sourceHash: string };
};
type Mapping = { kind: 'canonical' | 'templateVariant' | 'unmapped'; status: string; canonicalId?: string; parameters?: { bonus: number } };
type Feature = Record<string, unknown>;
type Item = { id: string; name: string; weight: number; cost: string; properties: string[]; features: Feature[]; srd: true };

const root = path.resolve(import.meta.dirname, '..');
const extraction = JSON.parse(fs.readFileSync(path.join(root, 'third_party/wotc/srd/5.1/extracted/items.json'), 'utf8')) as { document: string; sourceHash: string; records: Canonical[] };
const map = JSON.parse(fs.readFileSync(path.join(root, 'src/content/items/srdCanonicalMap.json'), 'utf8')) as { mappings: Record<string, Mapping> };
const canonicalById = new Map(extraction.records.map(record => [record.canonicalId, record]));
const confirmedStatuses = new Set(['CONFIRMED_CANONICAL', 'CONFIRMED_TEMPLATE_VARIANT']);

const stable = (value: unknown) => JSON.stringify(value);
const hash = (value: unknown) => createHash('sha256').update(stable(value)).digest('hex');
const asNumber = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const asString = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value : undefined;

function mundaneProperties(structured: Record<string, unknown>): string[] {
  const values: string[] = [];
  const armorCategory = asString(structured.armorCategory);
  if (armorCategory) values.push(armorCategory);
  for (const property of Array.isArray(structured.properties) ? structured.properties : []) {
    if (typeof property === 'string') values.push(property);
  }
  if (structured.stealthDisadvantage === true) values.push('disadvantage on stealth');
  const strength = asNumber(structured.strengthRequirement);
  if (strength !== undefined) values.push(`STR ${strength} required`);
  return values;
}

function weaponFeature(id: string, name: string, structured: Record<string, unknown>): Feature | undefined {
  const dice = asString(structured.damageDice);
  const damageType = asString(structured.damageType);
  const category = asString(structured.weaponCategory);
  if (!dice || !damageType || !category) return undefined;
  const normalRange = asNumber(structured.normalRange);
  const longRange = asNumber(structured.longRange);
  const range = normalRange !== undefined && longRange !== undefined ? `${normalRange}/${longRange} feet`
    : (Array.isArray(structured.properties) && structured.properties.includes('reach') ? '10 feet' : '5 feet');
  return {
    id: `${id}_attack`, name,
    description: `${category} weapon; ${dice} ${damageType} damage.`,
    source: { kind: 'item', refId: id }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range, target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice, damageType }],
  };
}

function armorFeature(id: string, name: string, structured: Record<string, unknown>): Feature | undefined {
  const category = asString(structured.armorCategory);
  const baseAC = asNumber(structured.baseAC);
  if (!category || baseAC === undefined) return undefined;
  if (category === 'shield') {
    return {
      id: `${id}_ac_bonus`, name, description: `+${baseAC} AC while equipped.`,
      source: { kind: 'item', refId: id }, level: null, actions: [], choices: [], passive: true,
      effects: [{ type: 'stat_modifier', target: 'ac', operation: 'add', value: baseAC, condition: null }],
    };
  }
  const dexterityApplies = structured.dexterityApplies === true;
  const dexterityCap = asNumber(structured.dexterityCap);
  const formulaAbilities = dexterityApplies ? ['dex'] : undefined;
  return {
    id: `${id}_ac`, name,
    description: dexterityApplies ? `Base AC ${baseAC} + DEX modifier${dexterityCap !== undefined ? ` (max +${dexterityCap})` : ''}.` : `Base AC ${baseAC}.`,
    source: { kind: 'item', refId: id }, level: null, actions: [], choices: [], passive: true,
    effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: baseAC, condition: null,
      ...(formulaAbilities ? { formulaAbilities, ...(dexterityCap !== undefined ? { formulaAbilityCap: { dex: dexterityCap } } : {}) } : {}),
    }],
  };
}

function generateMundane(id: string, record: Canonical): { item?: Item; reason?: string; fieldSources?: Record<string, string> } {
  const cost = asString(record.structured.cost);
  const weight = asNumber(record.structured.weightPounds);
  if (!cost || weight === undefined) return { reason: 'Canonical source row does not state both model-required cost and weight.' };
  const feature = weaponFeature(id, record.name, record.structured) ?? armorFeature(id, record.name, record.structured);
  return {
    item: { id, name: record.name, weight, cost, properties: mundaneProperties(record.structured), features: feature ? [feature] : [], srd: true },
    fieldSources: {
      id: 'confirmed mapping stable ID', name: 'canonical.name', weight: 'canonical.structured.weightPounds',
      cost: 'canonical.structured.cost', properties: 'canonical.structured armor/weapon fields',
      features: feature ? 'deterministic conversion of canonical structured combat/armor fields' : 'empty: no canonically modeled feature',
      srd: 'Grimoire-original public marker',
    },
  };
}

const items: Item[] = [];
const provenance: Record<string, unknown> = {};
const blockedConfirmed: Record<string, string> = {};
for (const [id, mapping] of Object.entries(map.mappings).sort(([a], [b]) => a.localeCompare(b))) {
  if (!confirmedStatuses.has(mapping.status) || !mapping.canonicalId) continue;
  if (mapping.status === 'CONFIRMED_TEMPLATE_VARIANT') {
    blockedConfirmed[id] = 'Template mechanics require a source-specific conversion and source-safe model-required fields; no generic +N transformation is assumed.';
    continue;
  }
  const record = canonicalById.get(mapping.canonicalId);
  if (!record) { blockedConfirmed[id] = 'Confirmed mapping canonical record is absent from extraction.'; continue; }
  if (record.category !== 'mundane-equipment') { blockedConfirmed[id] = `Canonical ${record.category} lacks source-explicit values for required Item model fields; no neutral gameplay-safe conversion exists.`; continue; }
  const generated = generateMundane(id, record);
  if (!generated.item || !generated.fieldSources) { blockedConfirmed[id] = generated.reason ?? 'No safe canonical conversion.'; continue; }
  const publicRecordHash = hash(generated.item);
  items.push(generated.item);
  provenance[id] = {
    public: true, verified: true, license: 'CC-BY-4.0', sourceDocument: extraction.document,
    sourceType: 'structured-only', canonicalId: record.canonicalId,
    sourcePage: record.source.printedPage, sourceEndPage: record.source.printedEndPage,
    sourceHash: extraction.sourceHash, generatorVersion: 1, publicRecordHash, fields: generated.fieldSources,
  };
}
const output = { document: extraction.document, sourceHash: extraction.sourceHash, generatorVersion: 1, items, provenance, blockedConfirmed };
fs.writeFileSync(path.join(root, 'src/content/items/generatedSrdItems.json'), JSON.stringify(output, null, 2) + '\n');
console.log(`Generated ${items.length} verified SRD public items; ${Object.keys(blockedConfirmed).length} confirmed mappings remain blocked.`);
