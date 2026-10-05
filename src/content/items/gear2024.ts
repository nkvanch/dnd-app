// ============================================================================
// FILE: src/content/items/gear2024.ts
// Ordinary adventuring gear that the 2024 starting-equipment packages (classes and backgrounds, System
// Reference Document 5.2.1) name and the item catalog did not have yet. Plain gear with a weight and a price;
// nothing mechanical. Appended to the full item library only for ids it does not already have.
// ============================================================================
import type { Item } from '../../engine/types';

export const GEAR_2024: Item[] = [
  { id: 'quiver', name: 'Quiver', weight: 1, cost: '1 gp', properties: ['gear', 'holds 20 arrows'], features: [] },
  { id: 'travelers_clothes', name: "Traveler's Clothes", weight: 4, cost: '2 gp', properties: ['clothing'], features: [] },
  { id: 'robe', name: 'Robe', weight: 4, cost: '1 gp', properties: ['clothing'], features: [] },
  { id: 'parchment', name: 'Parchment (one sheet)', weight: 0, cost: '1 sp', properties: ['gear'], features: [] },
  { id: 'pouch', name: 'Pouch', weight: 1, cost: '5 sp', properties: ['gear', 'holds 1/5 cubic foot or 6 pounds'], features: [] },
  { id: 'gaming_set', name: 'Gaming Set', weight: 0, cost: '5 sp', properties: ['tool', 'gaming set', 'the same kind as your tool proficiency'], features: [] },
];
