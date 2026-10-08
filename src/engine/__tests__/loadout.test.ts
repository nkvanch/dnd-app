// src/engine/__tests__/loadout.test.ts
// Item 13 (build comparison/checkpoints/loadouts) — the "loadouts" slice.
// applyLoadout reuses the already-tested equipItem/unequipItem pure
// mutators (see inventory.test.ts) rather than hand-rolling inventory
// movement again — these tests focus on the swap logic itself: minimal-
// diff (untouched items stay untouched), missing-item tolerance, and the
// prepared-spell-list intersection against currently-known spells.
import { captureLoadout, applyLoadout, deleteLoadout } from '../loadout';
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { Entity, Item, ItemInstance } from '../types';

function withInventory(equipped: ItemInstance[], carried: ItemInstance[]): Entity {
  const e = makeEmptyEntity('loadout-test');
  return { ...e, inventory: { ...e.inventory, equipped, carried } };
}

function inst(itemId: string): ItemInstance {
  return { itemId, quantity: 1, attuned: false, features: [] };
}

function item(id: string): Item {
  return { id, name: id, weight: 0, cost: '', properties: [], features: [] };
}

describe('captureLoadout', () => {
  it('snapshots currently equipped item ids and prepared spell ids', () => {
    const e = {
      ...withInventory([inst('sword'), inst('shield')], [inst('torch')]),
      spellcasting: { ability: 'int' as const, slots: {} as any, cantrips: [], known: ['fireball', 'shield_spell'], prepared: ['fireball'], concentrating: null },
    };
    const loadout = captureLoadout(e, 'Combat');
    expect(loadout.name).toBe('Combat');
    expect(loadout.equippedItemIds.sort()).toEqual(['shield', 'sword']);
    expect(loadout.preparedSpellIds).toEqual(['fireball']);
    expect(loadout.id).toBeTruthy();
    expect(loadout.createdAt).toBeGreaterThan(0);
  });

  it('trims the name and falls back to "Loadout" when blank', () => {
    const e = withInventory([], []);
    expect(captureLoadout(e, '  Dungeon  ').name).toBe('Dungeon');
    expect(captureLoadout(e, '   ').name).toBe('Loadout');
  });

  it('captures an empty prepared list for a non-caster (no spellcasting block)', () => {
    const e = withInventory([], []);
    expect(captureLoadout(e, 'x').preparedSpellIds).toEqual([]);
  });
});

describe('applyLoadout', () => {
  it('equips everything the loadout wants and unequips everything it does not', () => {
    const e = withInventory([inst('dagger')], [inst('sword'), inst('shield')]);
    const loadout = captureLoadout(withInventory([inst('sword'), inst('shield')], []), 'Combat');
    const after = applyLoadout(e, loadout, { sword: item('sword'), shield: item('shield') }, DEFAULT_RULES);
    expect(after.inventory.equipped.map(i => i.itemId).sort()).toEqual(['shield', 'sword']);
    expect(after.inventory.carried.map(i => i.itemId)).toEqual(['dagger']);
  });

  it('leaves an item that should stay equipped untouched (minimal diff — no needless unequip/re-equip)', () => {
    const swordInst: ItemInstance = { itemId: 'sword', quantity: 1, attuned: true, features: [{ id: 'x', name: 'x', description: '', source: { kind: 'item', refId: 'sword' }, level: null, effects: [], actions: [], choices: [], passive: true }] };
    const e = withInventory([swordInst], []);
    const loadout = { id: 'l1', name: 'Combat', equippedItemIds: ['sword'], preparedSpellIds: [], createdAt: 0 };
    const after = applyLoadout(e, loadout, {}, DEFAULT_RULES);
    // Same instance object identity — proves it was never unequipped/re-equipped
    // (which would strip the manually-set attuned flag via a fresh equipItem call).
    expect(after.inventory.equipped[0]).toBe(swordInst);
  });

  it('skips a loadout item that is no longer carried at all (sold/lost since saving) rather than crashing', () => {
    const e = withInventory([], []);
    const loadout = { id: 'l1', name: 'Combat', equippedItemIds: ['ghost_item'], preparedSpellIds: [], createdAt: 0 };
    expect(() => applyLoadout(e, loadout, {}, DEFAULT_RULES)).not.toThrow();
    expect(applyLoadout(e, loadout, {}, DEFAULT_RULES).inventory.equipped).toEqual([]);
  });

  it('sets prepared spells to the loadout list intersected with currently known spells', () => {
    const e = {
      ...withInventory([], []),
      spellcasting: { ability: 'int' as const, slots: {} as any, cantrips: [], known: ['fireball', 'shield_spell'], prepared: ['shield_spell'], concentrating: null },
    };
    const loadout = { id: 'l1', name: 'x', equippedItemIds: [], preparedSpellIds: ['fireball', 'forgotten_spell'], createdAt: 0 };
    const after = applyLoadout(e, loadout, {}, DEFAULT_RULES);
    // forgotten_spell isn't in `known` (e.g. swapped out at a level-up since
    // the loadout was saved) — silently dropped, not left as an invalid entry.
    expect(after.spellcasting!.prepared).toEqual(['fireball']);
  });

  it('is a no-op on spellcasting for a non-caster entity', () => {
    const e = withInventory([], []);
    const loadout = { id: 'l1', name: 'x', equippedItemIds: [], preparedSpellIds: ['fireball'], createdAt: 0 };
    expect(applyLoadout(e, loadout, {}, DEFAULT_RULES).spellcasting).toBeNull();
  });
});

describe('deleteLoadout', () => {
  it('removes the matching loadout by id', () => {
    const e = { ...withInventory([], []), loadouts: [{ id: 'a', name: 'A', equippedItemIds: [], preparedSpellIds: [], createdAt: 0 }, { id: 'b', name: 'B', equippedItemIds: [], preparedSpellIds: [], createdAt: 0 }] };
    const after = deleteLoadout(e, 'a');
    expect(after.loadouts!.map(l => l.id)).toEqual(['b']);
  });

  it('is a safe no-op when no loadouts exist yet', () => {
    const e = withInventory([], []);
    expect(deleteLoadout(e, 'missing').loadouts).toEqual([]);
  });
});
