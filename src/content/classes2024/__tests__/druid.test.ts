import { newChar, toLevel, bindSubclass, sub } from '../testKit';
import { applyPoolChoiceToEntity } from '../../../engine/leveling';
import { DEFAULT_RULES } from '../../../store/characterStore';
import { applyDamage } from '../../../engine/combat';
import { BEAST_FORMS_2024 } from '../../beastforms/beastforms2024Data';
import { ALL_BEAST_FORMS } from '../../beastforms';

describe('Druid (2024)', () => {
  it('Wisdom caster who prepares from the whole list, always has Speak with Animals, knows Druidic', () => {
    const e = newChar('druid');
    expect(e.spellcasting!.ability).toBe('wis');
    expect(e.spellcasting!.known).toContain('speak_with_animals');
    expect(e.choices.some(c => c.definition.id === 'druid_2024_spells_1')).toBe(false);
    expect(e.proficiencies.tools.map(t => t.toLowerCase())).toContain('herbalism kit');
  });

  it('Wild Shape: 2 uses at level 2, 3 at 6, 4 at 17', () => {
    let e = toLevel(newChar('druid'), 'druid', 2);
    const uses = () => e.resources.custom.find(r => r.id === 'wild_shape_pool')!.maximum;
    expect(uses()).toBe(2);
    e = toLevel(e, 'druid', 6); expect(uses()).toBe(3);
    e = toLevel(e, 'druid', 17); expect(uses()).toBe(4);
  });

  describe('Known Forms (Beast Shapes table)', () => {
    const forms = (e: ReturnType<typeof newChar>, level: number) => e.choices.find(c => c.definition.id === `druid_2024_wild_forms_${level}`)!;
    const ids = (c: { definition: { pool: unknown } }) => (c.definition.pool as { id: string }[]).map(o => o.id.replace('wild_form_', '').replace('_2024', ''));

    it('level 2: four forms from Beasts up to CR 1/4 with no Fly Speed, replaceable after a Long Rest', () => {
      const e = toLevel(newChar('druid'), 'druid', 2);
      const c = forms(e, 2);
      expect(c.definition.count).toBe(4);
      expect(c.definition.replace).toMatchObject({ timing: 'long_rest' });
      const pool = ids(c);
      for (const n of ['wolf', 'rat', 'spider', 'riding_horse', 'boar', 'panther']) expect(pool).toContain(n);
      for (const n of ['black_bear', 'brown_bear', 'eagle', 'giant_bat', 'lion', 'pteranodon']) expect(pool).not.toContain(n);   // too strong, or a Fly Speed
    });

    it('level 4 adds two forms up to CR 1/2 (no flying); level 8 adds two up to CR 1, flying allowed', () => {
      let e = toLevel(newChar('druid'), 'druid', 4);
      expect(forms(e, 4).definition.count).toBe(2);
      expect(ids(forms(e, 4))).toEqual(expect.arrayContaining(['black_bear', 'ape', 'crocodile', 'wolf']));
      expect(ids(forms(e, 4))).not.toContain('giant_wasp');
      expect(ids(forms(e, 4))).not.toContain('brown_bear');
      e = toLevel(e, 'druid', 8);
      expect(forms(e, 8).definition.count).toBe(2);
      expect(ids(forms(e, 8))).toEqual(expect.arrayContaining(['brown_bear', 'dire_wolf', 'tiger', 'giant_wasp', 'giant_bat', 'eagle']));
    });

    it('a chosen form becomes a Wild Shape action that transforms into that Beast, spending Wild Shape', () => {
      let e = toLevel(newChar('druid'), 'druid', 2);
      const c = forms(e, 2);
      e = applyPoolChoiceToEntity(e, c.id, ['wild_form_wolf_2024', 'wild_form_rat_2024', 'wild_form_spider_2024', 'wild_form_riding_horse_2024'], DEFAULT_RULES);
      const wolf = e.features.find(f => f.name === 'Wild Shape: Wolf')!;
      expect(wolf.abilityEffects![0]).toMatchObject({ type: 'transform', formId: 'wolf_2024' });
      expect(wolf.activation).toMatchObject({ actionType: 'bonus_action', resourceCost: { resourceId: 'wild_shape_pool' } });
      expect(e.features.filter(f => f.name.startsWith('Wild Shape: ')).length).toBe(4);
    });

    it('every form is a real stat block the engine can transform into', () => {
      const all = BEAST_FORMS_2024;
      expect(all.length).toBeGreaterThanOrEqual(60);
      for (const f of all) { expect(ALL_BEAST_FORMS.some(x => x.id === f.id)).toBe(true); expect(f.hp).toBeGreaterThan(0); expect(f.challengeRating).toBeLessThanOrEqual(1); }
      expect(all.find(f => f.id === 'wolf_2024')).toMatchObject({ ac: 12, hp: 11, speed: 40, challengeRating: 0.25 });
      expect(all.find(f => f.id === 'brown_bear_2024')).toMatchObject({ ac: 11, hp: 22, climbSpeed: 30 });
    });
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

describe('Circle of the Land land type', () => {
  it('can be changed whenever you finish a Long Rest', () => {
    let e = bindSubclass(toLevel(newChar('druid'), 'druid', 3), 'druid');
    e = toLevel(e, 'druid', 3);
    const c = e.choices.find(x => x.definition.id.endsWith('land_type'))!;
    expect(c.definition.replace).toMatchObject({ timing: 'long_rest' });
  });
});
