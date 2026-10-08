import { newChar } from '../../content/classes2024/testKit';
import { resolveChoice, resolveEquipmentChoice, parseStartingItem } from '../leveling';
import { reopenEquipmentChoice, skipEquipmentChoice } from '../../content/items/equipmentDisplay';
import { DEFAULT_RULES } from '../../store/characterStore';
import { BACKGROUNDS_2024 } from '../../content/backgrounds/backgrounds2024';
import { CLASSES_2024 } from '../../content/classes2024';
import { FULL_ITEM_LIBRARY } from '../../content/items/index';
import { Entity } from '../types';

const equipChoice = (e: Entity) => e.choices.find(c => c.definition.kind === 'equipment' && !c.resolved)!;
const itemIds = new Set((FULL_ITEM_LIBRARY as any[]).map(i => i.id));

describe('starting equipment: packages, gold and skipping', () => {
  it('taking package A adds its items and its leftover gold', () => {
    let e = newChar('fighter');
    const gp0 = e.inventory.currency.gp;
    const ch = equipChoice(e);
    e = resolveChoice(e, ch.id, ['a'], DEFAULT_RULES);
    expect(e.inventory.currency.gp).toBe(gp0 + 4);
    const names = e.inventory.carried.map(i => i.itemId);
    expect(names).toEqual(expect.arrayContaining(['chain_mail', 'greatsword', 'flail', 'dungeoneers_pack']));
    expect(names.filter(n => n === 'javelin')).toHaveLength(8);
  });

  it('the gold alternative adds only gold', () => {
    let e = newChar('fighter');
    const gp0 = e.inventory.currency.gp;
    const before = e.inventory.carried.length;
    e = resolveChoice(e, equipChoice(e).id, ['c'], DEFAULT_RULES);
    expect(e.inventory.currency.gp).toBe(gp0 + 155);
    expect(e.inventory.carried).toHaveLength(before);
  });

  it('reopening the choice takes back exactly its items and gold, and another option can be taken', () => {
    let e = newChar('wizard');
    const gp0 = e.inventory.currency.gp;
    const id = equipChoice(e).id;
    e = resolveChoice(e, id, ['a'], DEFAULT_RULES);
    expect(e.inventory.currency.gp).toBe(gp0 + 5);
    e = reopenEquipmentChoice(e, id);
    expect(e.inventory.currency.gp).toBe(gp0);
    expect(e.inventory.carried).toHaveLength(0);
    e = resolveChoice(e, id, ['b'], DEFAULT_RULES);
    expect(e.inventory.currency.gp).toBe(gp0 + 55);
  });

  it('skipping adds nothing at all', () => {
    let e = newChar('rogue');
    const gp0 = e.inventory.currency.gp;
    e = skipEquipmentChoice(e, equipChoice(e).id);
    expect(e.inventory.currency.gp).toBe(gp0);
    expect(e.inventory.carried).toHaveLength(0);
    expect(e.choices.find(c => c.definition.kind === 'equipment')!.resolved).toBe(true);
  });

  it('item*N is N of one stackable item in a single row', () => {
    expect(parseStartingItem('parchment*10')).toEqual({ itemId: 'parchment', quantity: 10 });
    expect(parseStartingItem('dagger')).toEqual({ itemId: 'dagger', quantity: 1 });
  });

  it('Monk package A also asks for a real tool, and keeps the gold', () => {
    const e = newChar('monk');
    const ch = equipChoice(e);
    const a = (ch.definition.pool as any[]).find(o => o.id === 'a');
    expect(a.gold).toBe(11);
    expect(a.itemFilter).toEqual({ constraint: { category: 'tool' }, quantity: 1 });
  });

  it('every class package carries its SRD leftover gold', () => {
    const expected: Record<string, [number, number, number?]> = {
      barbarian: [15, 75], bard: [19, 90], cleric: [7, 110], druid: [9, 50], fighter: [4, 11, 155], monk: [11, 50],
      paladin: [9, 150], ranger: [7, 150], rogue: [8, 100], sorcerer: [28, 50], warlock: [15, 100], wizard: [5, 55],
    };
    for (const c of CLASSES_2024) {
      const key = c.id.replace('_2024', '');
      const choice = c.rawProgression!.entries[0].choices.find(ch => ch.kind === 'equipment')!;
      const golds = (choice.pool as any[]).map(o => o.gold);
      expect([key, golds]).toEqual([key, expected[key]]);
    }
  });
});

describe('background equipment', () => {
  it('each 2024 background offers package A (items and gold) or 50 GP, and every item exists', () => {
    for (const bg of BACKGROUNDS_2024) {
      const ch = (bg.pendingChoices ?? []).find(c => c.kind === 'equipment')!;
      expect(ch).toBeDefined();
      const pool = ch.pool as any[];
      expect(pool.map(o => o.id)).toEqual(['a', 'b']);
      expect(pool[1].gold).toBe(50);
      for (const entry of pool[0].value as string[]) expect(itemIds.has(parseStartingItem(entry).itemId)).toBe(true);
    }
  });

  it('resolving a background package grants stacked rows, the items and the gold', () => {
    const acolyte = BACKGROUNDS_2024.find(b => b.id === 'acolyte_2024')!;
    let e = newChar('cleric');
    const queued = { ...acolyte.pendingChoices![0] };
    e = { ...e, choices: [...e.choices, { id: 'bg_equip', definition: queued, grantedAt: 0, resolved: false, selections: [] }] };
    const gp0 = e.inventory.currency.gp;
    e = resolveEquipmentChoice(e, 'bg_equip', { style: 'exact_options', optionId: 'a' }, () => undefined, DEFAULT_RULES);
    expect(e.inventory.currency.gp).toBe(gp0 + 8);
    expect(e.inventory.carried.find(i => i.itemId === 'parchment')!.quantity).toBe(10);
    expect(e.inventory.carried.map(i => i.itemId)).toEqual(expect.arrayContaining(['calligrapher_s_supplies', 'holy_symbol', 'robe', 'book']));
  });
});

describe('class equipment ids', () => {
  it('every item named by a 2024 class package exists in the catalog', () => {
    const missing: string[] = [];
    for (const c of CLASSES_2024) for (const ch of c.rawProgression!.entries[0].choices.filter(x => x.kind === 'equipment'))
      for (const o of ch.pool as any[]) for (const entry of o.value as string[]) if (!itemIds.has(parseStartingItem(entry).itemId)) missing.push(`${c.id}:${entry}`);
    expect(missing).toEqual([]);
  });
});
