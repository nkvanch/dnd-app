import { newChar, toLevel, bindSubclass, sub, cls } from '../testKit';
import { recomputeDerived } from '../../../engine/pipeline';
import { DEFAULT_RULES } from '../../../store/characterStore';
import { weaponMasteryCapacity, weaponMasteryRules, setWeaponMasteryPicks, masteredWeaponIds } from '../../../engine/weaponMastery';
import { applyDamage } from '../../../engine/combat';

describe('Barbarian (2024)', () => {
  it('is a 2024 class with d12, Strength/Constitution saves, and a Rage pool of 2', () => {
    expect(cls('barbarian')).toMatchObject({ id: 'barbarian_2024', hitDie: 12, rulesetId: 'dnd5e-2024', savingThrows: ['str', 'con'] });
    const e = newChar('barbarian');
    expect(e.resources.custom.find(r => r.id === 'rage_pool')).toMatchObject({ maximum: 2, current: 2 });
    expect(e.features.map(f => f.id)).toEqual(expect.arrayContaining(['barbarian_2024_rage', 'barbarian_2024_unarmored_defense', 'barbarian_2024_weapon_mastery']));
    expect(e.choices.some(c => c.definition.kind === 'skill' && c.definition.count === 2)).toBe(true);
  });

  it('Unarmored Defense is 10 + Dex + Con', () => {
    const e = newChar('barbarian', { dex: 14, con: 16 });
    expect(e.derived.ac).toBe(10 + 2 + 3);
  });

  it('Rages follow the table: 3 at 3, 4 at 6, 5 at 12, 6 at 17', () => {
    let e = newChar('barbarian');
    const rages = (lv: number) => { e = toLevel(e, 'barbarian', lv); return e.resources.custom.find(r => r.id === 'rage_pool')!.maximum; };
    expect([rages(3), rages(6), rages(12), rages(17)]).toEqual([3, 4, 5, 6]);
  });

  it('Weapon Mastery: 2 melee kinds at level 1, 3 at level 4, 4 at level 10; picks are limited to melee weapons', () => {
    let e = newChar('barbarian');
    expect(weaponMasteryCapacity(e)).toBe(2);
    expect(weaponMasteryRules(e)).toEqual(['melee']);
    e = setWeaponMasteryPicks(e, ['greataxe', 'handaxe', 'longbow', 'quarterstaff']);       // longbow is ranged, third exceeds capacity
    expect(masteredWeaponIds(e)).toEqual(['greataxe', 'handaxe']);
    e = toLevel(e, 'barbarian', 4);
    expect(weaponMasteryCapacity(e)).toBe(3);
    expect(e.features.filter(f => f.id === 'barbarian_2024_weapon_mastery')).toHaveLength(1);   // upgraded in place, never duplicated
    e = toLevel(e, 'barbarian', 10);
    expect(weaponMasteryCapacity(e)).toBe(4);
  });

  it('Rage resistance applies only while the Rage flag is set', () => {
    let e = newChar('barbarian');
    const hp = e.resources.hp.current;
    expect(applyDamage(e, 10, DEFAULT_RULES, 'slashing').resources.hp.current).toBe(hp - 10);
    e = recomputeDerived({ ...e, conditionMonitor: { ...e.conditionMonitor, flags: { rage_active: true } } }, DEFAULT_RULES);
    expect(applyDamage(e, 10, DEFAULT_RULES, 'slashing').resources.hp.current).toBe(hp - 5);
  });

  it('level 5 gives Extra Attack and +10 speed; level 20 raises Strength and Constitution by 4', () => {
    let e = toLevel(newChar('barbarian'), 'barbarian', 5);
    expect(e.derived.speed).toBe(40);
    expect(e.derived.attackActionAttacks).toBeGreaterThanOrEqual(2);
    e = toLevel(e, 'barbarian', 20);
    const { effectiveAbilityScores } = require('../../../engine/pipeline');
    expect(effectiveAbilityScores(e).str).toBe(14);
    expect(effectiveAbilityScores(e).con).toBe(18);
  });

  it('Path of the Berserker is the one subclass, with its four features at levels 3, 6, 10 and 14', () => {
    expect(sub('barbarian').name).toBe('Path of the Berserker');
    let e = toLevel(newChar('barbarian'), 'barbarian', 3);
    e = bindSubclass(e, 'barbarian');
    expect(e.features.some(f => f.id === 'berserker_2024_berserker_frenzy' || f.name === 'Frenzy')).toBe(true);
    e = toLevel(e, 'barbarian', 14);
    expect(e.features.filter(f => f.source.kind === 'subclass').map(f => f.name)).toEqual(['Frenzy', 'Mindless Rage', 'Retaliation', 'Intimidating Presence']);
  });
});
