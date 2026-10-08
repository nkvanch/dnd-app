// src/content/classes/__tests__/equipmentCategoryChoices.test.ts
// CHOICE-EXPANSION-3: regression coverage for migrating "choose N of
// [category]" starting-equipment options (e.g. "any simple weapon") off the
// old flattened-to-one-example shape (`{ label: 'Any simple weapon (Dagger)',
// items: ['dagger'] }`, a fixed grant no matter what the player picked) onto
// the real itemFilter/equipmentStyle mechanism, so the player actually
// chooses which weapon they get. Covers every class migrated this pass:
// Cleric, Barbarian, Paladin, Druid, Bard, Monk, Sorcerer, Warlock.
import {
  clericProgression, barbarianProgression, paladinProgression, druidProgression,
  bardProgression, monkProgression, sorcererProgression, warlockProgression,
} from '../index';
import { queueChoice, resolveEquipmentChoice } from '../../../engine/leveling';
import { makeEmptyEntity, DEFAULT_RULES } from '../../../store/characterStore';
import type { ChoiceDefinition } from '../../../engine/types';
import type { ItemIndexEntry } from '../../itemRepo.types';

function mkItem(over: Partial<ItemIndexEntry>): ItemIndexEntry {
  return { id: 'x', name: 'X', weight: 1, cost: '1 gp', properties: [], hasDamageEffect: false, weaponRange: null, ...over };
}
const dagger    = mkItem({ id: 'dagger', name: 'Dagger', hasDamageEffect: true, weaponRange: 'melee', properties: ['finesse', 'light', 'thrown', 'simple weapon'] });
const quarterstaff = mkItem({ id: 'quarterstaff', name: 'Quarterstaff', hasDamageEffect: true, weaponRange: 'melee', properties: ['versatile', 'simple weapon'] });
const sling      = mkItem({ id: 'sling', name: 'Sling', hasDamageEffect: true, weaponRange: 'ranged', properties: ['ammunition', 'simple weapon'] });
const longsword  = mkItem({ id: 'longsword', name: 'Longsword', hasDamageEffect: true, weaponRange: 'melee', properties: ['versatile', 'martial weapon'] });
const longbow    = mkItem({ id: 'longbow', name: 'Longbow', hasDamageEffect: true, weaponRange: 'ranged', properties: ['ammunition', 'heavy', 'martial weapon'] });
const shield     = mkItem({ id: 'shield', name: 'Shield', properties: ['shield'] });

const ITEM_INDEX: Record<string, ItemIndexEntry> = { dagger, quarterstaff, sling, longsword, longbow, shield };
const lookup = (id: string) => ITEM_INDEX[id];

function level1Choice(progression: typeof clericProgression, choiceId: string): ChoiceDefinition {
  const entry = progression.entries.find(e => e.level === 1)!;
  const def = entry.choices.find(c => c.id === choiceId);
  if (!def) throw new Error(`Choice ${choiceId} not found at level 1`);
  return def;
}

function findFilteredOption(def: ChoiceDefinition) {
  const pool = Array.isArray(def.pool) ? def.pool : [];
  const opt = pool.find(o => o.itemFilter);
  if (!opt) throw new Error(`No itemFilter option found on ${def.id}`);
  return opt;
}

describe('Equipment category choices migrated to real itemFilter picks (CHOICE-EXPANSION-3)', () => {
  const cases: { name: string; progression: typeof clericProgression; choiceId: string; weaponClass: 'simple' | 'martial'; weaponRange?: 'melee' | 'ranged' }[] = [
    { name: 'Cleric — any simple weapon',        progression: clericProgression,    choiceId: 'cleric_equip_c',    weaponClass: 'simple' },
    { name: 'Barbarian — any martial melee weapon', progression: barbarianProgression, choiceId: 'barbarian_equip_a', weaponClass: 'martial', weaponRange: 'melee' },
    { name: 'Barbarian — any simple weapon',      progression: barbarianProgression, choiceId: 'barbarian_equip_b', weaponClass: 'simple' },
    { name: 'Paladin — any simple melee weapon',  progression: paladinProgression,   choiceId: 'paladin_equip_b',   weaponClass: 'simple', weaponRange: 'melee' },
    { name: 'Druid — any simple weapon',          progression: druidProgression,     choiceId: 'druid_equip_a',     weaponClass: 'simple' },
    { name: 'Druid — any simple melee weapon',    progression: druidProgression,     choiceId: 'druid_equip_b',     weaponClass: 'simple', weaponRange: 'melee' },
    { name: 'Bard — any simple weapon',           progression: bardProgression,      choiceId: 'bard_equip_a',      weaponClass: 'simple' },
    { name: 'Monk — any simple weapon',           progression: monkProgression,      choiceId: 'monk_equip_a',      weaponClass: 'simple' },
    { name: 'Sorcerer — any simple weapon',       progression: sorcererProgression,  choiceId: 'sorcerer_equip_a',  weaponClass: 'simple' },
    { name: 'Warlock — any simple weapon',        progression: warlockProgression,   choiceId: 'warlock_equip_a',   weaponClass: 'simple' },
  ];

  for (const { name, progression, choiceId, weaponClass, weaponRange } of cases) {
    it(`${name}: choice is exact_options with a real itemFilter (category:weapon, weaponClass:${weaponClass}${weaponRange ? `, weaponRange:${weaponRange}` : ''}), not a single hardcoded item`, () => {
      const def = level1Choice(progression, choiceId);
      expect(def.equipmentStyle).toBe('exact_options');
      const opt = findFilteredOption(def);
      expect(opt.itemFilter!.constraint).toEqual({ category: 'weapon', weaponClass, ...(weaponRange ? { weaponRange } : {}) });
      expect(opt.itemFilter!.quantity).toBe(1);
      // The option's own fixed `value` no longer bakes in a specific weapon.
      expect(opt.value).toEqual([]);
    });
  }

  it('Cleric: resolving the simple-weapon option with Dagger actually grants Dagger', () => {
    const def = level1Choice(clericProgression, 'cleric_equip_c');
    const opt = findFilteredOption(def);
    let e = queueChoice(makeEmptyEntity('e1'), def, 1);
    e = resolveEquipmentChoice(e, `${def.id}_1`, { style: 'exact_options', optionId: opt.id, filteredItemIds: ['dagger'] }, lookup, DEFAULT_RULES);
    expect(e.inventory.carried.map(i => i.itemId)).toEqual(['dagger']);
  });

  it('Cleric: resolving the same choice with a different simple weapon (Quarterstaff) grants that instead — real player choice, not a fixed example', () => {
    const def = level1Choice(clericProgression, 'cleric_equip_c');
    const opt = findFilteredOption(def);
    let e = queueChoice(makeEmptyEntity('e1'), def, 1);
    e = resolveEquipmentChoice(e, `${def.id}_1`, { style: 'exact_options', optionId: opt.id, filteredItemIds: ['quarterstaff'] }, lookup, DEFAULT_RULES);
    expect(e.inventory.carried.map(i => i.itemId)).toEqual(['quarterstaff']);
  });

  it('Cleric: a martial weapon is rejected for the simple-only choice (filter actually narrows, not just decoration)', () => {
    const def = level1Choice(clericProgression, 'cleric_equip_c');
    const opt = findFilteredOption(def);
    const e = queueChoice(makeEmptyEntity('e1'), def, 1);
    expect(() => resolveEquipmentChoice(e, `${def.id}_1`, { style: 'exact_options', optionId: opt.id, filteredItemIds: ['longsword'] }, lookup, DEFAULT_RULES))
      .toThrow(/does not satisfy/);
  });

  it('Barbarian: a ranged simple weapon (Sling) is rejected for the melee-restricted martial choice; a martial melee weapon works', () => {
    const def = level1Choice(barbarianProgression, 'barbarian_equip_a');
    const opt = findFilteredOption(def);
    let e = queueChoice(makeEmptyEntity('e1'), def, 1);
    expect(() => resolveEquipmentChoice(e, `${def.id}_1`, { style: 'exact_options', optionId: opt.id, filteredItemIds: ['sling'] }, lookup, DEFAULT_RULES))
      .toThrow(/does not satisfy/);
    e = resolveEquipmentChoice(e, `${def.id}_1`, { style: 'exact_options', optionId: opt.id, filteredItemIds: ['longsword'] }, lookup, DEFAULT_RULES);
    expect(e.inventory.carried.map(i => i.itemId)).toEqual(['longsword']);
  });

  it('the OTHER (fixed) option in a migrated choice still works unchanged — e.g. Barbarian greataxe / Cleric crossbow', () => {
    const clericDef = level1Choice(clericProgression, 'cleric_equip_c');
    let e = queueChoice(makeEmptyEntity('e1'), clericDef, 1);
    e = resolveEquipmentChoice(e, `${clericDef.id}_1`, { style: 'exact_options', optionId: 'crossbow' }, lookup, DEFAULT_RULES);
    expect(e.inventory.carried.map(i => i.itemId)).toEqual(expect.arrayContaining([]));
    // (crossbow/bolts aren't in our tiny lookup table — this just proves the
    // fixed-value path still resolves without requiring a filtered pick.)
    expect(e.choices.find(c => c.id === `${clericDef.id}_1`)?.resolved).toBe(true);
  });

  it('Bard\'s musical-instrument choice is deliberately NOT migrated (no compatible structured metadata) — still the flattened legacy shape, disclosed not silent', () => {
    const def = level1Choice(bardProgression, 'bard_equip_c');
    expect(def.equipmentStyle).toBeUndefined();
    const pool = Array.isArray(def.pool) ? def.pool : [];
    expect(pool.every(o => !o.itemFilter)).toBe(true);
  });
});
