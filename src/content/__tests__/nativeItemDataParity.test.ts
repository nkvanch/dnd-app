/** @jest-environment node */
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string, options?: object) => any };
import path from 'node:path';
import { FULL_ITEM_LIBRARY } from '../../content/items';
import type { Item } from '../../engine/types';
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../../engine/pipeline';

const db = new DatabaseSync(path.resolve(process.cwd(), 'assets/content.db'), { readOnly: true });
const mockNativeItems = new Map<string, Item>();
for (const row of db.prepare('SELECT id, data FROM items').all() as { id: string; data: string }[]) {
  mockNativeItems.set(row.id, JSON.parse(row.data));
}
jest.mock('../../content/itemRepo', () => ({
  itemRepo: {
    init: jest.fn(), getIndex: jest.fn(() => []), ensureLoaded: jest.fn(),
    getItemSync: jest.fn((id: string) => mockNativeItems.get(id)),
  },
}));

function nativeItem(id: string): Item {
  const item = mockNativeItems.get(id);
  if (!item) throw new Error(`native item missing: ${id}`);
  return item;
}

describe('generated native item data parity', () => {
  it.each(['ring_of_protection', 'bracers_of_defense', 'longsword', 'shield'])(
    '%s preserves runtime-relevant structured definition fields', id => {
      const source = FULL_ITEM_LIBRARY.find(item => item.id === id)!;
      const native = nativeItem(id);
      expect(native.properties).toEqual(source.properties);
      expect(native.features).toEqual(source.features);
      expect(native.rulesetId).toEqual(source.rulesetId);
      expect(native.srd).toEqual(source.srd);
    });

  it('Bracers predicate applies, suppresses with native shield data, and reapplies after removal', () => {
    const bracers = nativeItem('bracers_of_defense');
    expect(bracers.features.flatMap(feature => feature.effects)
      .some(effect => effect.requiresNoArmorOrShield === true)).toBe(true);
    const entity = makeEmptyEntity('native-bracers');
    entity.inventory.equipped = [{ itemId: bracers.id, quantity: 1, attuned: true, features: [] }];
    expect(recomputeDerived(entity, DEFAULT_RULES).derived.ac).toBe(12);
    entity.inventory.equipped.push({ itemId: 'leather_armor', quantity: 1, attuned: false, features: [] });
    expect(recomputeDerived(entity, DEFAULT_RULES).derived.ac).toBe(11);
    entity.inventory.equipped = entity.inventory.equipped.filter(item => item.itemId !== 'leather_armor');
    expect(recomputeDerived(entity, DEFAULT_RULES).derived.ac).toBe(12);
  });
});
