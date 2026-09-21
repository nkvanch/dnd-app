import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { addAdditionalEquipment, additionalEquipment, removeAdditionalEquipment, reopenEquipmentChoice } from '../../content/items/equipmentDisplay';
import { ALL_CHAR_CLASSES_CATALOG, filterClassesForExposure } from '../../content/classes';
import { applyDmOverride, cancelDmOverride } from '../dmOverride';
import { applyHP } from '../leveling';
import { explainValue } from '../audit';
import { recomputeDerived } from '../pipeline';
import { generateAllActionCards } from '../actionCards';

import { serializePortableCharacter, parsePortableCharacter } from '../../io/characterPortable';
import { useLastCharacterStore } from '../../store/lastCharacterStore';
import { useHomebrewStore } from '../../store/homebrewStore';
import { IMPORTED_ITEMS } from '../../content/items/importedItems';
import { migrateEntity } from '../multiclass';
import { itemMace } from '../../content/items';
import type { ChoiceState } from '../types';

describe('device smoke closure pass 2', () => {
  it('filters Artificer exposure without removing it from the unrestricted catalog', () => {
    expect(ALL_CHAR_CLASSES_CATALOG.some(c => c.id === 'artificer')).toBe(true);
    expect(filterClassesForExposure(ALL_CHAR_CLASSES_CATALOG, true).some(c => c.id === 'artificer')).toBe(false);
    expect(filterClassesForExposure(ALL_CHAR_CLASSES_CATALOG, false).some(c => c.id === 'artificer')).toBe(true);
    expect(filterClassesForExposure(ALL_CHAR_CLASSES_CATALOG, true).every(c => c.srd === true)).toBe(true);
  });

  it('owns, deduplicates, and removes one additional item independently', () => {
    const base = makeEmptyEntity('equipment-extra');
    const first = addAdditionalEquipment(base, 'potion_of_healing');
    const second = addAdditionalEquipment(first.entity, 'rope_hempen_50_feet');
    expect(addAdditionalEquipment(second.entity, 'potion_of_healing').added).toBe(false);
    const owned = additionalEquipment(second.entity); expect(owned).toHaveLength(2);
    const removed = removeAdditionalEquipment(second.entity, owned[0].acquisitionSourceId!);
    expect(additionalEquipment(removed).map(i => i.itemId)).toEqual(['rope_hempen_50_feet']);
  });

  it('reopens only the selected equipment choice, preserving its sibling', () => {
    const choice = (id: string, itemId: string): ChoiceState => ({ id, grantedAt: 1, resolved: true, selections: ['pick'], definition: { id, prompt: id, equipmentGroup: id, kind: 'equipment', count: 1, pool: [{ id: 'pick', label: itemId, value: [itemId] }], grants: [], required: false, resolved: true } });
    const entity = makeEmptyEntity('replace'); entity.choices = [choice('Weapon','longsword'), choice('Armor','shield')];
    entity.inventory.carried = ['longsword','shield'].map(itemId => ({ itemId, quantity: 1, attuned: false, features: [] }));
    const result = reopenEquipmentChoice(entity, 'Weapon');
    expect(result.choices.map(c => c.resolved)).toEqual([false,true]);
    expect(result.inventory.carried.map(i => i.itemId)).toEqual(['shield']);
  });

  it('CON set override resizes max/current HP by modifier delta, preserves damage, drives future HP, and reverses', () => {
    const base = makeEmptyEntity('con-hp'); base.identity.level = 2; base.stats.con = 10; base.resources.hp = { maximum: 20, current: 12, temp: 0 };
    const overridden = applyDmOverride(base, { campaignId: 'c', entityId: base.id, dmDeviceId: 'd', stat: 'con', operation: 'set', value: 18, label: 'Blessing', expiry: 'manual' }, DEFAULT_RULES);
    expect(overridden.resources.hp).toMatchObject({ maximum: 28, current: 20 });
    const leveled = applyHP(overridden, 8, 'fixed', 3, DEFAULT_RULES);
    expect(leveled.resources.hp.maximum - overridden.resources.hp.maximum).toBe(9);
    const active = overridden.dmOverrides.find(o => o.active)!;
    const restored = cancelDmOverride(overridden, active.id, DEFAULT_RULES);
    expect(restored.resources.hp).toMatchObject({ maximum: 20, current: 12 });
  });

  it('represents set override explanation as replacement without a fake +0 contribution', () => {
    const base = makeEmptyEntity('audit2'); base.stats.con = 10;
    const result = applyDmOverride(base, { campaignId: 'c', entityId: base.id, dmDeviceId: 'd', stat: 'con', operation: 'set', value: 18, label: 'Blessing', expiry: 'manual' }, DEFAULT_RULES);
    const entry = explainValue(result, 'con').entries.find(e => e.sourceKind === 'dm_override');
    expect(entry).toMatchObject({ label: 'DM Override — Blessing', replacement: { from: 10, to: 18 } });
  });

  it('synthesizes only missing equipped weapon attacks and reuses canonical +1 math', () => {
    const mace = IMPORTED_ITEMS.find(item => item.id === 'mace_of_disruption')!;
    const plusOne = IMPORTED_ITEMS.find(item => item.id === 'mace_1')!;
    const bracers = IMPORTED_ITEMS.find(item => item.id === 'bracers_of_defense')!;
    useHomebrewStore.setState({ items: [mace, plusOne, bracers, itemMace] });
    const entity = makeEmptyEntity('weapons'); entity.stats.str = 16; entity.proficiencies.weapons = ['simple'];
    entity.inventory.equipped = [{ itemId: mace.id, quantity: 1, attuned: true, features: mace.features, requiresAttunement: true }];
    const derived = recomputeDerived(entity, DEFAULT_RULES);
    const card = generateAllActionCards(derived).find(c => c.featureId === 'mace_of_disruption_basic_weapon_attack');
    expect(card?.layer2).toContain('1d6+3 Bludgeoning');
    expect(generateAllActionCards({ ...derived, inventory: { ...derived.inventory, equipped: [], carried: derived.inventory.equipped } }).some(c => c.name === mace.name)).toBe(false);
    const passive = bracers;
    const passiveEntity = recomputeDerived({ ...entity, inventory: { ...entity.inventory, carried: [], equipped: [{ itemId: passive.id, quantity: 1, attuned: true, features: passive.features, requiresAttunement: true }] } }, DEFAULT_RULES);
    expect(generateAllActionCards(passiveEntity).some(c => c.name === passive.name)).toBe(false);
    const magicEntity = recomputeDerived({ ...entity, inventory: { ...entity.inventory, carried: [], equipped: [{ itemId: plusOne.id, quantity: 1, attuned: false, features: plusOne.features }] } }, DEFAULT_RULES);
    expect(magicEntity.derived.attackBonuses.find(a => a.id === plusOne.id)).toMatchObject({ bonus: 5, damageBonus: 4, damageDice: '1d6' });
  });

  it('round-trips versioned portable JSON, rejects malformed data, and imports conflicts as copies', () => {
    const entity = makeEmptyEntity('portable'); entity.identity.name = 'Alice';
    const parsed = parsePortableCharacter(serializePortableCharacter(entity)); expect(parsed.entity).toEqual(migrateEntity(entity)); expect(parsed.importedAsCopy).toBe(false);
    const copy = parsePortableCharacter(serializePortableCharacter(entity), new Set([entity.id])); expect(copy.importedAsCopy).toBe(true); expect(copy.entity.id).not.toBe(entity.id);
    expect(() => parsePortableCharacter('{bad')).toThrow('not valid JSON');
    expect(() => parsePortableCharacter(JSON.stringify({ format: 'grimoire-character', version: 1, entity: { id: 'bad' } }))).toThrow('validation failed');
  });

  it('updates last-character state immediately and clears a deleted target', async () => {
    useLastCharacterStore.setState({ lastCharacterId: null, initialized: true });
    await useLastCharacterStore.getState().markOpened('alice'); expect(useLastCharacterStore.getState().lastCharacterId).toBe('alice');
    await useLastCharacterStore.getState().markOpened('bob'); expect(useLastCharacterStore.getState().lastCharacterId).toBe('bob');
    await useLastCharacterStore.getState().clearIfDeleted('bob'); expect(useLastCharacterStore.getState().lastCharacterId).toBeNull();
  });
});
