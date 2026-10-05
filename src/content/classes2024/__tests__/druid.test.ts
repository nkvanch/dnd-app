import { newChar, toLevel, bindSubclass, sub } from '../testKit';
import { applyPoolChoiceToEntity } from '../../../engine/leveling';
import { DEFAULT_RULES } from '../../../store/characterStore';
import { applyDamage } from '../../../engine/combat';

describe('Druid (2024)', () => {
  it('Wisdom caster who prepares from the whole list, always has Speak with Animals, knows Druidic', () => {
    const e = newChar('druid');
    expect(e.spellcasting!.ability).toBe('wis');
    expect(e.spellcasting!.known).toContain('speak_with_animals');
    expect(e.choices.some(c => c.definition.id === 'druid_2024_spells_1')).toBe(false);
    expect(e.proficiencies.tools.map(t => t.toLowerCase())).toContain('herbalism kit');
  });

  it('Wild Shape: 2 uses at level 2, 3 at 6, 4 at 17; Wolf at 2, Giant Spider and Brown Bear at 8', () => {
    let e = toLevel(newChar('druid'), 'druid', 2);
    const uses = () => e.resources.custom.find(r => r.id === 'wild_shape_pool')!.maximum;
    expect(uses()).toBe(2);
    expect(e.features.map(f => f.name)).toContain('Wild Shape: Wolf');
    expect(e.features.map(f => f.name)).not.toContain('Wild Shape: Brown Bear');
    e = toLevel(e, 'druid', 6); expect(uses()).toBe(3);
    e = toLevel(e, 'druid', 8); expect(e.features.map(f => f.name)).toEqual(expect.arrayContaining(['Wild Shape: Giant Spider', 'Wild Shape: Brown Bear']));
    e = toLevel(e, 'druid', 17); expect(uses()).toBe(4);
  });

  it('Primal Order: Warden grants Martial weapons and Medium armor', () => {
    let e = newChar('druid');
    e = applyPoolChoiceToEntity(e, e.choices.find(c => c.definition.id === 'druid_2024_primal_order')!.id, ['primal_order_warden'], DEFAULT_RULES);
    expect(e.proficiencies.weapons).toContain('martial');
    expect(e.proficiencies.armor).toContain('medium');
  });

  it('Circle of the Land: the land\'s circle spells arrive at Druid levels 3, 5, 7 and 9, and Nature\'s Ward resistance at 10', () => {
    let e = bindSubclass(toLevel(newChar('druid'), 'druid', 3), 'druid');
    const land = e.choices.find(c => !c.resolved && c.definition.id === 'druid_2024_land_type')!;
    e = applyPoolChoiceToEntity(e, land.id, ['arid'], DEFAULT_RULES);
    expect(e.spellcasting!.known).toEqual(expect.arrayContaining(['blur', 'burning_hands']));
    expect(e.spellcasting!.cantrips).toContain('firebolt');
    expect(e.spellcasting!.known).not.toContain('fireball');
    e = toLevel(e, 'druid', 5); expect(e.spellcasting!.known).toContain('fireball');
    expect(e.spellcasting!.known).not.toContain('blight');
    e = toLevel(e, 'druid', 9); expect(e.spellcasting!.known).toEqual(expect.arrayContaining(['blight', 'wall_of_stone']));
    const hp = e.resources.hp.current;
    expect(applyDamage(e, 10, DEFAULT_RULES, 'fire').resources.hp.current).toBe(hp - 10);   // not yet level 10
    e = toLevel(e, 'druid', 10);
    expect(applyDamage(e, 10, DEFAULT_RULES, 'fire').resources.hp.current).toBe(e.resources.hp.current - 5);
    expect(sub('druid').name).toBe('Circle of the Land');
  });
});
