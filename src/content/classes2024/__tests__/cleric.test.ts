import { newChar, toLevel, bindSubclass, sub } from '../testKit';
import { applyPoolChoiceToEntity } from '../../../engine/leveling';
import { DEFAULT_RULES } from '../../../store/characterStore';

describe('Cleric (2024)', () => {
  it('Wisdom caster, full caster slots, 3 cantrips to pick and no prepared-spell picks (prepares from the whole list)', () => {
    const e = newChar('cleric');
    expect(e.spellcasting!.ability).toBe('wis');
    expect(e.spellcasting!.slots['1'].total).toBe(2);
    expect(e.choices.find(c => c.definition.id === 'cleric_2024_cantrips_1')!.definition.count).toBe(3);
    expect(e.choices.some(c => c.definition.id === 'cleric_2024_spells_1')).toBe(false);
  });

  it('Divine Order: Protector grants Martial weapons and Heavy armor', () => {
    let e = newChar('cleric');
    const order = e.choices.find(c => c.definition.id === 'cleric_2024_divine_order')!;
    e = applyPoolChoiceToEntity(e, order.id, ['divine_order_protector'], DEFAULT_RULES);
    expect(e.proficiencies.weapons).toContain('martial');
    expect(e.proficiencies.armor).toContain('heavy');
  });

  it('Channel Divinity: 2 uses at level 2, 3 at level 6, 4 at level 18; Divine Spark dice scale at 7/13/18', () => {
    let e = toLevel(newChar('cleric'), 'cleric', 2);
    const pool = () => e.resources.custom.find(r => r.id === 'channel_divinity')!.maximum;
    expect(pool()).toBe(2);
    e = toLevel(e, 'cleric', 6); expect(pool()).toBe(3);
    e = toLevel(e, 'cleric', 18); expect(pool()).toBe(4);
    const { generateAllActionCards } = require('../../../engine/actionCards');
    const spark = (lv: number) => generateAllActionCards({ ...e, identity: { ...e.identity, level: lv } }, DEFAULT_RULES).find((c: any) => c.name === 'Divine Spark').layer2;
    expect([spark(2), spark(7), spark(13), spark(18)]).toEqual(['1d8 Radiant', '2d8 Radiant', '3d8 Radiant', '4d8 Radiant'].map(x => expect.stringContaining(x)));
  });

  it('Life Domain: domain spells are always prepared as the Cleric levels, and its three features arrive on time', () => {
    let e = bindSubclass(toLevel(newChar('cleric'), 'cleric', 3), 'cleric');
    expect(e.spellcasting!.known).toEqual(expect.arrayContaining(['aid', 'bless', 'cure_wounds', 'lesser_restoration']));
    expect(e.spellcasting!.known).not.toContain('revivify');
    e = toLevel(e, 'cleric', 9);
    expect(e.spellcasting!.known).toEqual(expect.arrayContaining(['revivify', 'mass_healing_word', 'death_ward', 'aura_of_life', 'greater_restoration', 'mass_cure_wounds']));
    e = toLevel(e, 'cleric', 17);
    expect(e.features.filter(f => f.source.kind === 'subclass').map(f => f.name)).toEqual(expect.arrayContaining(['Disciple of Life', 'Preserve Life', 'Blessed Healer', 'Supreme Healing']));
    expect(sub('cleric').name).toBe('Life Domain');
  });

  it('Blessed Strikes is a real choice at level 7, Divine Intervention a once-per-Long-Rest pool at 10', () => {
    const e = toLevel(newChar('cleric'), 'cleric', 10);
    expect(e.choices.some(c => c.definition.id === 'cleric_2024_blessed_strikes')).toBe(true);
    expect(e.resources.custom.find(r => r.id === 'divine_intervention')).toMatchObject({ maximum: 1, recharge: 'long_rest' });
  });
});
