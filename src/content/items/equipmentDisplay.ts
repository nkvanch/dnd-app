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
