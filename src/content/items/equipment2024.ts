// ============================================================================
// FILE: src/content/items/equipment2024.ts
// The Equipment chapter of the System Reference Document 5.2.1 (2024 rules / 5.5e), Creative Commons Attribution 4.0:
// the mundane items the item catalog did not have yet (Tools, Adventuring Gear, focus/ammunition/instrument/gaming-set
// variants, mounts, tack and vehicles), plus the two firearms and the two armors the catalog lacked. The rows come from
// equipment2024Data.ts (generated from the SRD text). Items the catalog already had keep the catalog's copy and are only
// named in EQUIPMENT_2024_IDS, which is the full list the SRD 5.2.1 pack must carry.
// Rules text rides on a passive feature with no effects (nothing here changes a statistic); the armors and firearms are the
// exceptions and use the same Armor Class formula and damage entries as the rest of the catalog.
// ============================================================================
import type { Item, Feature } from '../../engine/types';
import { GEAR_2024 } from './gear2024';
import { TOOL_ROWS, GEAR_ROWS, VARIANT_ROWS, MOUNT_ROWS, Row } from './equipment2024Data';

function describe(id: string, name: string, description: string): Feature {
  return { id: `${id}_info`, name, description, source: { kind: 'item', refId: id }, level: null, effects: [], actions: [], choices: [], passive: true } as Feature;
}

function plain(r: Row, kind: string, description: string, extra: string[] = []): Item {
  return { id: r.id, name: r.name, weight: r.weight, cost: r.cost, properties: [kind, ...extra], features: description ? [describe(r.id, r.name, description)] : [] };
}

const toolItem = (r: Row): Item => plain(r, 'tool', [
  r.ability ? `Ability: ${r.ability}.` : '', r.utilize ? `Utilize: ${r.utilize}.` : '', r.craft ? `Craft: ${r.craft}.` : '', r.variants ? `Variants: ${r.variants}.` : '',
].filter(Boolean).join(' '), r.ability ? [`ability: ${r.ability}`] : []);

const gearItem = (r: Row): Item => plain(r, 'adventuring gear', r.text ?? '');
const variantItem = (r: Row): Item => plain(r, /Focus|Holy Symbol/.test(r.name) ? 'spellcasting focus' : /Instrument|Bagpipes|Drum|Dulcimer|Flute|Horn|Lute|Lyre|Shawm|Viol/.test(r.name) ? 'tool' : /Set$/.test(r.name) ? 'tool' : 'adventuring gear', r.text ?? '');
const mountItem = (r: Row): Item => plain(r, /^(Camel|Elephant|Horse|Mastiff|Mule|Pony|Warhorse)/.test(r.name) ? 'mount' : 'tack and vehicles', r.text ?? '');

function weapon(id: string, name: string, weight: number, cost: string, dice: string, props: string[], range: string): Item {
  return {
    id, name, weight, cost, properties: props,
    features: [{
      id: `${id}_attack`, name, description: 'Ranged weapon attack.', source: { kind: 'item', refId: id }, level: null, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range, target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice, damageType: 'piercing' }],
    } as Feature],
  };
}

function armor(id: string, name: string, weight: number, cost: string, base: number, cap: number | null, kind: string, stealth: boolean): Item {
  return {
    id, name, weight, cost, properties: [kind, ...(stealth ? ['disadvantage on stealth'] : [])],
    features: [{
      id: `${id}_ac`, name, description: `Base AC ${base} + DEX modifier${cap ? ` (max +${cap})` : ''}.`, source: { kind: 'item', refId: id }, level: null, actions: [], choices: [], passive: true,
      effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: base, condition: null, formulaAbilities: ['dex'] as never, ...(cap ? { formulaAbilityCap: { dex: cap } } : {}) }],
    } as Feature],
  };
}

/** Items the catalog lacked, built from the SRD 5.2.1 Equipment chapter. */
// (gear2024.ts already carries a few of these, with no srd flag, so the generator saw them as new.)
const HAVE_GEAR = new Set(GEAR_2024.map(i => i.id));
const isNew = (r: Row) => !r.existing && !HAVE_GEAR.has(r.id);

export const EQUIPMENT_2024: Item[] = [
  ...TOOL_ROWS.filter(isNew).map(toolItem),
  ...GEAR_ROWS.filter(isNew).map(gearItem),
  ...VARIANT_ROWS.filter(isNew).map(variantItem),
  ...MOUNT_ROWS.filter(isNew).map(mountItem),
  weapon('musket', 'Musket', 10, '500 gp', '1d12', ['ammunition (range 40/120; bullet)', 'loading', 'two-handed', 'heavy', 'martial ranged', 'mastery: slow'], '40 feet'),
  weapon('pistol', 'Pistol', 3, '250 gp', '1d10', ['ammunition (range 30/90; bullet)', 'loading', 'martial ranged', 'mastery: vex'], '30 feet'),
  armor('padded_armor', 'Padded Armor', 8, '5 gp', 11, null, 'light armor', true),
  armor('hide_armor', 'Hide Armor', 12, '10 gp', 12, 2, 'medium armor', false),
];

/** The armor the SRD 5.2.1 table lists, as catalog ids (padded and hide are built above). */
export const ARMOR_IDS_2024 = ['padded_armor', 'leather_armor', 'studded_leather', 'hide_armor', 'chain_shirt', 'scale_mail', 'breastplate', 'half_plate', 'ring_mail', 'chain_mail', 'splint', 'plate_mail', 'shield'];

/** Every id the SRD 5.2.1 equipment list names (new items and the catalog's own), except the weapons (weaponMastery.ts lists those). */
export const EQUIPMENT_2024_IDS: string[] = [
  ...[...TOOL_ROWS, ...GEAR_ROWS, ...VARIANT_ROWS, ...MOUNT_ROWS].map(r => r.id),
  ...ARMOR_IDS_2024,
];
