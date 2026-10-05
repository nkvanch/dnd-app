// The 2024 (5.5e) species and Origin-feat backgrounds run through the real engine.
import { makeEmptyEntity, DEFAULT_RULES } from '../../../store/characterStore';
import { recomputeDerived } from '../../../engine/pipeline';
import { applyGrant, swapBackground, applyPoolChoiceToEntity } from '../../../engine/leveling';
import { generateAllActionCards } from '../../../engine/actionCards';
import { Entity, Race, Background, Feat } from '../../../engine/types';
import {
  raceDragonborn2024, raceDwarf2024, raceElf2024, raceGoliath2024, raceTiefling2024, raceGnome2024, raceOrc2024, RACES_2024,
} from '../races2024';
import { ORIGIN_FEATS_2024 } from '../../feats/origin2024';
import { bgAcolyte2024, bgCriminal2024, bgSage2024, bgSoldier2024, BACKGROUNDS_2024 } from '../../backgrounds/backgrounds2024';

const featById = (id: string): Feat => ORIGIN_FEATS_2024.find(f => f.id === id)!;
const originOf = (bg: Background) => (bg.originFeat ? featById(bg.originFeat) : undefined);

/** Applies a race the way race-detail.tsx's selectRace does (features, resources, chosen ancestry, subrace). */
function withRace(level: number, race: Race, ancestryId?: string, subraceId?: string): Entity {
  let e = makeEmptyEntity('r');
  e = { ...e, identity: { ...e.identity, level, raceId: race.id }, stats: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
    resources: { ...e.resources, hp: { current: 20, maximum: 20, temp: 0 }, hitDice: { die: 8, total: level, remaining: level } } };
  for (const f of race.features) e = applyGrant(e, { kind: 'feature', value: { ...f, isActive: true } }, f.level ?? 0);
  for (const r of race.resources ?? []) e = applyGrant(e, { kind: 'resource', value: r }, 0, undefined, { kind: 'race', id: race.id });
  const sub = race.subraces?.find(s => s.id === subraceId);
  for (const f of sub?.features ?? []) e = applyGrant(e, { kind: 'feature', value: { ...f, isActive: true } }, f.level ?? 0);
  const opt = race.ancestryChoice?.options.find(o => o.id === ancestryId);
  if (opt?.feature) e = applyGrant(e, { kind: 'feature', value: { ...opt.feature, isActive: true } }, opt.feature.level ?? 0);
  return recomputeDerived(e, DEFAULT_RULES);
}
const atLevel = (e: Entity, level: number) => recomputeDerived({ ...e, identity: { ...e.identity, level } }, DEFAULT_RULES);
const cardNames = (e: Entity) => generateAllActionCards(e, DEFAULT_RULES).map(c => c.name);

describe('registration', () => {
  it('the SRD 5.2.1 species and backgrounds are all present, tagged 5.5e, and not part of SRD 5.1', () => {
    expect(RACES_2024.map(r => r.id).sort()).toEqual(['dragonborn_2024', 'dwarf_2024', 'elf_2024', 'gnome_2024', 'goliath_2024', 'halfling_2024', 'orc_2024', 'tiefling_2024']);
    expect(BACKGROUNDS_2024.map(b => b.id)).toEqual(['acolyte_2024', 'criminal_2024', 'sage_2024', 'soldier_2024']);
    for (const x of [...RACES_2024, ...BACKGROUNDS_2024, ...ORIGIN_FEATS_2024]) {
      expect(x.rulesetId).toBe('dnd5e-2024');
      expect(x.srd).toBe(false);
    }
  });

  it('every background names an Origin feat that exists', () => {
    for (const b of BACKGROUNDS_2024) expect(featById(b.originFeat!)).toBeDefined();
    expect(BACKGROUNDS_2024.map(b => b.originFeat)).toEqual(['magic_initiate_cleric_2024', 'alert_2024', 'magic_initiate_wizard_2024', 'savage_attacker_2024']);
  });
});

describe('Origin feats are granted by the background, for real', () => {
  const char = (): Entity => {
    const e = makeEmptyEntity('o');
    return recomputeDerived({ ...e, identity: { ...e.identity, level: 1 }, stats: { ...e.stats, cha: 14 } }, DEFAULT_RULES);
  };

  it('Criminal grants Alert: initiative gains the proficiency bonus, and it keeps up as PB grows', () => {
    const base = char();
    let e = swapBackground(base, bgCriminal2024, DEFAULT_RULES, undefined, undefined, originOf(bgCriminal2024));
    expect(e.features.some(f => f.id === 'criminal_2024_origin_alert_2024')).toBe(true);
    expect(e.derived.initiative).toBe(base.derived.initiative + 2);          // PB 2 at level 1
    e = atLevel(e, 9);
    expect(e.derived.initiative).toBe(base.derived.initiative + 4);          // PB 4 at level 9
  });

  it('Soldier grants Savage Attacker and a gaming-set pick; Criminal -> Soldier takes Alert back out', () => {
    let e = swapBackground(char(), bgCriminal2024, DEFAULT_RULES, undefined, undefined, originOf(bgCriminal2024));
    e = swapBackground(e, bgSoldier2024, DEFAULT_RULES, undefined, undefined, originOf(bgSoldier2024));
    const ids = e.features.map(f => f.id);
    expect(ids).toContain('soldier_2024_origin_savage_attacker_2024');
    expect(ids.some(i => i.includes('alert_2024'))).toBe(false);
    expect(e.derived.initiative).toBe(char().derived.initiative);
    expect(e.choices.some(c => !c.resolved && c.definition.kind === 'tool')).toBe(true);
  });

  it('Acolyte grants Magic Initiate (Cleric): picks are queued, resolving them gives real cantrips, a prepared spell and a once-per-rest cast', () => {
    let e = swapBackground(char(), bgAcolyte2024, DEFAULT_RULES, undefined, undefined, originOf(bgAcolyte2024));
    const cantrips = e.choices.find(c => !c.resolved && c.definition.id.endsWith('_cantrips'))!;
    const spell = e.choices.find(c => !c.resolved && c.definition.id.endsWith('_spell'))!;
    expect(cantrips.definition).toMatchObject({ kind: 'feature_pool', count: 2 });
    expect(spell.definition).toMatchObject({ kind: 'feature_pool', count: 1 });
    const cantripIds = (cantrips.definition.pool as { id: string }[]).slice(0, 2).map(o => o.id);
    const spellOpt = (spell.definition.pool as { id: string }[]).find(o => o.id.endsWith('_bless'))!.id;
    e = applyPoolChoiceToEntity(e, cantrips.id, cantripIds, DEFAULT_RULES);
    e = applyPoolChoiceToEntity(e, spell.id, [spellOpt], DEFAULT_RULES);
    expect(e.spellcasting!.cantrips.length).toBe(2);
    expect(e.spellcasting!.known).toContain('bless');
    expect(e.spellcasting!.ability).toBe('wis');
    expect(e.resources.custom.find(r => r.id === 'magic_initiate_cleric_2024_cast')).toMatchObject({ maximum: 1, recharge: 'long_rest' });
    expect(cardNames(e).some(n => n.includes('Bless'))).toBe(true);
  });

  it('Acolyte -> Sage takes the Cleric spells and pool out and queues fresh Wizard picks', () => {
    let e = swapBackground(char(), bgAcolyte2024, DEFAULT_RULES, undefined, undefined, originOf(bgAcolyte2024));
    const cantrips = e.choices.find(c => !c.resolved && c.definition.id.endsWith('_cantrips'))!;
    const spell = e.choices.find(c => !c.resolved && c.definition.id.endsWith('_spell'))!;
    e = applyPoolChoiceToEntity(e, cantrips.id, (cantrips.definition.pool as { id: string }[]).slice(0, 2).map(o => o.id), DEFAULT_RULES);
    e = applyPoolChoiceToEntity(e, spell.id, [(spell.definition.pool as { id: string }[])[0].id], DEFAULT_RULES);
    expect(e.spellcasting!.cantrips.length).toBe(2);

    e = swapBackground(e, bgSage2024, DEFAULT_RULES, undefined, undefined, originOf(bgSage2024));
    expect(e.spellcasting!.cantrips).toEqual([]);
    expect(e.spellcasting!.known).toEqual([]);
    expect(e.resources.custom.some(r => r.id === 'magic_initiate_cleric_2024_cast')).toBe(false);
    const fresh = e.choices.filter(c => !c.resolved && c.definition.id.includes('magic_initiate_wizard_2024'));
    expect(fresh).toHaveLength(2);
  });

  it('the background grants its skill and tool proficiencies', () => {
    const e = swapBackground(char(), bgCriminal2024, DEFAULT_RULES, undefined, undefined, originOf(bgCriminal2024));
    expect(e.skills.skills.sleight_of_hand.trained).toBe(true);
    expect(e.skills.skills.stealth.trained).toBe(true);
    expect(e.proficiencies.tools.map(t => t.toLowerCase())).toContain('thieves tools');
  });

  it('Skilled asks for three skill picks', () => {
    expect(featById('skilled_2024').pendingChoices![0]).toMatchObject({ kind: 'skill', count: 3 });
  });
});

describe('level-gated and scaling species traits', () => {
  it('Dragonborn: Draconic Flight stays locked until level 5; Breath Weapon dice scale 1d10 -> 4d10', () => {
    const e1 = withRace(1, raceDragonborn2024, 'red');
    expect(cardNames(e1)).toContain('Draconic Ancestry: Red');
    expect(cardNames(e1)).not.toContain('Draconic Flight');
    const breath = (e: Entity) => generateAllActionCards(e, DEFAULT_RULES).find(c => c.name === 'Draconic Ancestry: Red')!.layer2;
    expect(breath(e1)).toContain('1d10 Fire');
    expect(cardNames(atLevel(e1, 5))).toContain('Draconic Flight');
    expect(breath(atLevel(e1, 5))).toContain('2d10 Fire');
    expect(breath(atLevel(e1, 11))).toContain('3d10 Fire');
    expect(breath(atLevel(e1, 17))).toContain('4d10 Fire');
    const fire = applyDamageType(e1, 'fire');
    expect(fire).toBeLessThan(10);                                            // fire resistance from the Red ancestry
  });

  it('Dragonborn Breath Weapon uses follow the proficiency bonus', () => {
    const e = withRace(1, raceDragonborn2024, 'blue');
    expect(e.resources.custom.find(r => r.id === 'dragonborn_2024_breath')).toMatchObject({ maximum: 2, perProficiencyBonus: true });
    expect(atLevel(e, 5).resources.custom.find(r => r.id === 'dragonborn_2024_breath')!.maximum).toBe(3);
  });

  it('Dwarven Toughness is +1 maximum HP per level, retroactively', () => {
    const e1 = withRace(1, raceDwarf2024);
    expect(e1.resources.hp.maximum).toBe(21);
    expect(atLevel(e1, 5).resources.hp.maximum).toBe(25);
    expect(e1.derived.senses.some(s => s.type === 'darkvision' && s.range === 120)).toBe(true);
  });

  it('Goliath: speed 35, Giant Ancestry is a Proficiency-Bonus-use pool, Large Form arrives at 5', () => {
    const e = withRace(1, raceGoliath2024, 'fire');
    expect(e.derived.speed).toBe(35);
    expect(e.resources.custom.find(r => r.id === 'goliath_2024_giant')).toMatchObject({ perProficiencyBonus: true });
    expect(cardNames(e)).not.toContain('Large Form');
    expect(cardNames(atLevel(e, 5))).toContain('Large Form');
  });

  it('Elf (Wood): speed 35, Druidcraft, and the level 3 and level 5 lineage spells arrive on time', () => {
    const e = withRace(1, raceElf2024, 'wood_elf');
    expect(e.derived.speed).toBe(35);
    expect(e.spellcasting!.cantrips).toContain('druidcraft');
    expect(cardNames(e).some(n => n.includes('Longstrider'))).toBe(false);
    expect(cardNames(atLevel(e, 3)).some(n => n.includes('Longstrider'))).toBe(true);
    expect(cardNames(atLevel(e, 3)).some(n => n.includes('Pass Without Trace'))).toBe(false);
    expect(cardNames(atLevel(e, 5)).some(n => n.includes('Pass Without Trace'))).toBe(true);
  });

  it('Elf (Drow) raises Darkvision to 120 ft; every Elf has Keen Senses as a three-way choice', () => {
    const e = withRace(1, raceElf2024, 'drow');
    expect(e.derived.senses.find(s => s.type === 'darkvision')!.range).toBe(120);
    expect(raceElf2024.pendingChoices![0].pool).toHaveLength(3);
  });

  it('Tiefling (Infernal): fire resistance, Fire Bolt and Thaumaturgy at level 1, Hellish Rebuke at 3; Small or Medium', () => {
    const e = withRace(1, raceTiefling2024, 'infernal', 'tiefling_2024_small');
    expect(e.spellcasting!.cantrips).toEqual(expect.arrayContaining(['fire_bolt', 'thaumaturgy']));
    expect(e.spellcasting!.ability).toBe('cha');
    expect(cardNames(e).some(n => n.includes('Hellish Rebuke'))).toBe(false);
    expect(cardNames(atLevel(e, 3)).some(n => n.includes('Hellish Rebuke'))).toBe(true);
    expect(raceTiefling2024.subraces!.map(s => s.size)).toEqual(['Medium', 'Small']);
  });

  it('Gnome (Forest) knows Minor Illusion and has Speak with Animals prepared; Orc has Adrenaline Rush and Relentless Endurance', () => {
    const g = withRace(1, raceGnome2024, 'forest');
    expect(g.spellcasting!.cantrips).toContain('minor_illusion');
    expect(g.spellcasting!.known).toContain('speak_with_animals');
    const o = withRace(1, raceOrc2024);
    expect(cardNames(o)).toEqual(expect.arrayContaining(['Adrenaline Rush', 'Relentless Endurance']));
    expect(o.resources.custom.find(r => r.id === 'orc_2024_rush')!.recharge).toBe('short_rest');
  });
});

function applyDamageType(e: Entity, type: string): number {
  const { applyDamage } = require('../../../engine/combat');
  const before = e.resources.hp.current;
  return before - applyDamage(e, 10, DEFAULT_RULES, type).resources.hp.current;
}
