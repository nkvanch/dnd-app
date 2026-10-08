import { newChar, toLevel, bindSubclass, sub, cls } from '../testKit';

describe('Bard (2024)', () => {
  it('Bardic Inspiration uses equal the Charisma modifier (minimum 1) and track it', () => {
    const e = newChar('bard', { cha: 16 });
    expect(e.resources.custom.find(r => r.id === 'bardic_inspiration')).toMatchObject({ maximum: 3, perAbilityModifier: 'cha' });
    expect(newChar('bard', { cha: 8 }).resources.custom.find(r => r.id === 'bardic_inspiration')!.maximum).toBe(1);
  });

  it('the pool returns on a Short Rest from level 5, and the die upgrades in place', () => {
    let e = newChar('bard', { cha: 16 });
    expect(e.resources.custom.find(r => r.id === 'bardic_inspiration')!.recharge).toBe('long_rest');
    e = toLevel(e, 'bard', 5);
    expect(e.resources.custom.find(r => r.id === 'bardic_inspiration')!.recharge).toBe('short_rest');
    expect(e.features.filter(f => f.id === 'bard_2024_bardic_inspiration')).toHaveLength(1);
    expect(e.features.find(f => f.id === 'bard_2024_bardic_inspiration')!.name).toBe('Bardic Inspiration (d8)');
    e = toLevel(e, 'bard', 15);
    expect(e.features.find(f => f.id === 'bard_2024_bardic_inspiration')!.name).toBe('Bardic Inspiration (d12)');
  });

  it('is a full caster with Charisma: 2 slots at level 1, 4/3/3/3/2/1/1/1/1 at level 17', () => {
    let e = newChar('bard');
    expect(e.spellcasting!.ability).toBe('cha');
    expect(e.spellcasting!.slots['1'].total).toBe(2);
    e = toLevel(e, 'bard', 17);
    expect(['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(t => e.spellcasting!.slots[t as '1'].total)).toEqual([4, 3, 3, 3, 2, 1, 1, 1, 1]);
  });

  it('queues 2 cantrips and 4 prepared spells at level 1, then follows the Prepared Spells column', () => {
    let e = newChar('bard');
    const count = (id: string) => e.choices.find(c => c.definition.id === `bard_2024_${id}`)?.definition.count;
    expect([count('cantrips_1'), count('spells_1')]).toEqual([2, 4]);
    e = toLevel(e, 'bard', 5);
    expect([count('spells_2'), count('spells_3'), count('spells_4'), count('spells_5'), count('cantrips_4')]).toEqual([1, 1, 1, 2, 1]);
  });

  it('Expertise arrives at 2 and 9; Jack of All Trades at 2; the subclass is College of Lore', () => {
    let e = toLevel(newChar('bard'), 'bard', 9);
    expect(e.choices.filter(c => c.definition.kind === 'expertise')).toHaveLength(2);
    expect(e.features.map(f => f.id)).toContain('bard_2024_jack_of_all_trades');
    expect(sub('bard').name).toBe('College of Lore');
    e = bindSubclass(e, 'bard');
    expect(e.features.some(f => f.name === 'Cutting Words')).toBe(true);
  });

  it('uses the 2024 Bard spell list, which includes the new Starry Wisp cantrip', () => {
    const { FULL_SPELL_LIBRARY } = require('../../spells/index');
    const wisp = FULL_SPELL_LIBRARY.find((s: any) => s.id === 'starry_wisp');
    expect(wisp.classes).toContain('bard_2024');
    expect(cls('bard').rulesetId).toBe('dnd5e-2024');
  });
});
