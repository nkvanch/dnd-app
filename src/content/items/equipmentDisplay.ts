// src/content/items/equipmentDisplay.ts
// STARTING-EQUIPMENT-1: pure display/derivation helpers for the Starting
// Equipment screen, pulled out of app/creation/equipment.tsx specifically
// so they can be unit-tested directly — that route file imports
// `useRouter` from `expo-router`, which breaks Jest for anything that
// imports it at module scope outside a real route context (the exact
// class of bug found and fixed once already this session for
// AsiFeatPicker.tsx; same fix shape here, applied preemptively).
import { ChoiceOption, ChoiceState, ItemFilterConstraint } from '../../engine/types';

/** Short human-readable label for an ItemFilterConstraint, e.g. "Simple
 *  Melee Weapons" or "Light Armor" — used both on the picker button and
 *  the picker modal's title. Not exhaustive grammar, just legible. */
export function describeConstraint(c: ItemFilterConstraint): string {
  const CAT_LABEL: Record<string, string> = {
    weapon: 'Weapon', armor: 'Armor', shield: 'Shield',
    ammunition: 'Ammunition', tool: 'Tool', focus: 'Focus', gear: 'Gear',
  };
  const parts: string[] = [];
  if (c.weaponClass) parts.push(c.weaponClass === 'martial' ? 'Martial' : 'Simple');
  if (c.weaponRange) parts.push(c.weaponRange === 'melee' ? 'Melee' : 'Ranged');
  if (c.armorWeight) parts.push(c.armorWeight[0].toUpperCase() + c.armorWeight.slice(1));
  if (c.category) parts.push(CAT_LABEL[c.category]);
  if (parts.length === 0) return 'Items';
  const label = parts.join(' ');
  return label.endsWith('s') ? label : label + 's';
}

/** Every item id a resolved choice actually granted into inventory —
 *  covers all three shapes selections can take (legacy: each selection IS
 *  a pool option id; exact/bundle: [optionId, ...filteredItemIds]; plain
 *  filtered_item: raw item ids) — used to remove exactly those instances
 *  when the player chooses to revisit and change their selection. */
export function itemsGrantedBy(choice: ChoiceState): string[] {
  const style = choice.definition.equipmentStyle;
  const pool: ChoiceOption[] = Array.isArray(choice.definition.pool) ? choice.definition.pool : [];
  if (!style) {
    return choice.selections.flatMap(selId => {
      const opt = pool.find(o => o.id === selId);
      return Array.isArray(opt?.value) ? opt.value : [];
    });
  }
  if (style === 'filtered_item') return choice.selections;
  const [optionId, ...filteredItemIds] = choice.selections;
  const opt = pool.find(o => o.id === optionId);
  const fixed = Array.isArray(opt?.value) ? opt.value : [];
  return [...fixed, ...filteredItemIds];
}


/** Starting packages only expose mundane definitions. Special/magic items remain
 * available through Additional Items and the ordinary inventory browser. */
export function isStartingEquipmentItem(item: { properties: string[] }): boolean {
  return !item.properties.some(property => {
    const value = property.toLowerCase();
    return value.includes('magic') || value.includes('wondrous') || value.includes('artifact');
  });
}

/** Reopen exactly one equipment choice, removing only inventory instances it granted. */
export function reopenEquipmentChoice(entity: import('../../engine/types').Entity, choiceId: string): import('../../engine/types').Entity {
  const choice = entity.choices.find(candidate => candidate.id === choiceId);
  if (!choice || choice.definition.kind !== 'equipment') return entity;
  const carried = [...entity.inventory.carried];
  for (const itemId of itemsGrantedBy(choice)) {
    const index = carried.findIndex(item => item.itemId === itemId);
    if (index >= 0) carried.splice(index, 1);
  }
  return { ...entity, inventory: { ...entity.inventory, carried }, choices: entity.choices.map(candidate =>
    candidate.id === choiceId ? { ...candidate, resolved: false, selections: [] } : candidate) };
}

/** Skipping is a real empty resolution and never creates a placeholder item. */
export function skipEquipmentChoice(entity: import('../../engine/types').Entity, choiceId: string): import('../../engine/types').Entity {
  const reopened = reopenEquipmentChoice(entity, choiceId);
  return { ...reopened, choices: reopened.choices.map(choice => choice.id === choiceId
    ? { ...choice, resolved: true, selections: [] } : choice) };
}

export function skipRemainingEquipment(entity: import('../../engine/types').Entity): import('../../engine/types').Entity {
  return entity.choices.filter(choice => choice.definition.kind === 'equipment' && !choice.resolved)
    .reduce((current, choice) => skipEquipmentChoice(current, choice.id), entity);
}


const ADDITIONAL_SOURCE_PREFIX = 'creation:additional:';

export function additionalEquipment(entity: import('../../engine/types').Entity) {
  return entity.inventory.carried.filter(item => item.acquisitionSourceId?.startsWith(ADDITIONAL_SOURCE_PREFIX));
}

export function addAdditionalEquipment(entity: import('../../engine/types').Entity, itemId: string): { entity: import('../../engine/types').Entity; added: boolean } {
  if (additionalEquipment(entity).some(item => item.itemId === itemId)) return { entity, added: false };
  const instance = { itemId, quantity: 1, attuned: false, features: [], acquisitionSourceId: ADDITIONAL_SOURCE_PREFIX + Date.now().toString(36) + ':' + Math.random().toString(36).slice(2) };
  return { entity: { ...entity, inventory: { ...entity.inventory, carried: [...entity.inventory.carried, instance] } }, added: true };
}

export function removeAdditionalEquipment(entity: import('../../engine/types').Entity, acquisitionSourceId: string): import('../../engine/types').Entity {
  const index = entity.inventory.carried.findIndex(item => item.acquisitionSourceId === acquisitionSourceId && item.acquisitionSourceId.startsWith(ADDITIONAL_SOURCE_PREFIX));
  if (index < 0) return entity;
  const carried = [...entity.inventory.carried]; carried.splice(index, 1);
  return { ...entity, inventory: { ...entity.inventory, carried } };
}
