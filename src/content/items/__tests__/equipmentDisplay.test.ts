// src/content/items/__tests__/equipmentDisplay.test.ts
// STARTING-EQUIPMENT-1: pure-logic coverage for the Starting Equipment
// screen's own display helpers (the UI-glue itself, app/creation/
// equipment.tsx, is exercised live — per this session's established
// preference for testing pure logic directly rather than through
// rendering, see e.g. RestPreviewModal/FeatPreviewModal tests).
import { describeConstraint, itemsGrantedBy } from '../equipmentDisplay';
import { ChoiceState, ChoiceOption } from '../../../engine/types';

function makeChoice(overrides: Partial<ChoiceState> & { pool?: ChoiceOption[] }): ChoiceState {
  const { pool, ...rest } = overrides;
  return {
    id: 'c1',
    grantedAt: 1,
    resolved: true,
    selections: [],
    ...rest,
    definition: {
      id: 'c1', prompt: 'Choose', kind: 'equipment', count: 1,
      pool: pool ?? [], grants: [], required: true, resolved: false,
      ...rest.definition,
    },
  };
}

describe('describeConstraint', () => {
  it('describes a simple melee weapon constraint', () => {
    expect(describeConstraint({ category: 'weapon', weaponClass: 'simple', weaponRange: 'melee' }))
      .toBe('Simple Melee Weapons');
  });

  it('describes a martial weapon constraint with no range', () => {
    expect(describeConstraint({ category: 'weapon', weaponClass: 'martial' })).toBe('Martial Weapons');
  });

  it('describes an armor-weight constraint', () => {
    expect(describeConstraint({ category: 'armor', armorWeight: 'light' })).toBe('Light Armors');
  });

  it('falls back to "Items" for an empty constraint', () => {
    expect(describeConstraint({})).toBe('Items');
  });
});

describe('itemsGrantedBy', () => {
  it('resolves legacy selections (each selection is a pool option id)', () => {
    const choice = makeChoice({
      selections: ['leather'],
      definition: {
        pool: [
          { id: 'chain', label: 'Chain Mail', value: ['chain_mail'] },
          { id: 'leather', label: 'Leather + Longbow', value: ['leather_armor', 'longbow', 'arrows_20'] },
        ],
      } as any,
    });
    expect(itemsGrantedBy(choice)).toEqual(['leather_armor', 'longbow', 'arrows_20']);
  });

  it('resolves exact_options selections with a fixed item plus a nested filtered pick', () => {
    const choice = makeChoice({
      selections: ['weapon_shield', 'longsword'],
      definition: {
        equipmentStyle: 'exact_options',
        pool: [
          { id: 'weapon_shield', label: 'Martial weapon + shield', value: ['shield'], itemFilter: { constraint: { category: 'weapon', weaponClass: 'martial' }, quantity: 1 } },
          { id: 'two_martial', label: 'Two martial weapons', value: [], itemFilter: { constraint: { category: 'weapon', weaponClass: 'martial' }, quantity: 2 } },
        ],
      } as any,
    });
    expect(itemsGrantedBy(choice)).toEqual(['shield', 'longsword']);
  });

  it('resolves filtered_item selections as raw item ids directly', () => {
    const choice = makeChoice({
      selections: ['dagger', 'quarterstaff'],
      definition: { equipmentStyle: 'filtered_item', itemFilter: { category: 'weapon', weaponClass: 'simple' } } as any,
    });
    expect(itemsGrantedBy(choice)).toEqual(['dagger', 'quarterstaff']);
  });

  it('resolves bundle_options selections with no nested filter (pure fixed bundle)', () => {
    const choice = makeChoice({
      selections: ['dungeoneer'],
      definition: {
        equipmentStyle: 'bundle_options',
        pool: [
          { id: 'dungeoneer', label: "Dungeoneer's Pack", value: ['dungeoneers_pack'] },
          { id: 'explorer', label: "Explorer's Pack", value: ['explorers_pack'] },
        ],
      } as any,
    });
    expect(itemsGrantedBy(choice)).toEqual(['dungeoneers_pack']);
  });
});
