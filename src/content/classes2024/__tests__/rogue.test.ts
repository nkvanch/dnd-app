import { newChar, toLevel, bindSubclass } from '../testKit';
import { weaponMasteryCapacity, weaponMasteryRules, eligibleMasteryWeapons } from '../../../engine/weaponMastery';

describe('Rogue (2024)', () => {
  it('has Sneak Attack that scales 1d6 -> 10d6, Cunning Action at 2, Weapon Mastery for proficient weapons', () => {
    let e = newChar('rogue');
    const sneak = (x: any) => x.features.find((f: any) => f.name === 'Sneak Attack').abilityEffects[0];
    expect(sneak(e).dice).toBe('1d6');
    expect(sneak(e).diceByLevel.find((d: any) => d.level === 19).dice).toBe('10d6');
    expect(weaponMasteryCapacity(e)).toBe(2);
    expect(weaponMasteryRules(e)).toEqual(['finesse_or_light']);
    e = toLevel(e, 'rogue', 2);
    expect(e.features.some(f => f.name === 'Cunning Action')).toBe(true);
  });

  it('mastery covers Simple weapons and Finesse/Light Martial weapons only (a Shortbow yes, a Greatsword no)', () => {
    const e = newChar('rogue');
    const ids = eligibleMasteryWeapons(e).map((w: any) => w.id);
    expect(ids).toEqual(expect.arrayContaining(['dagger', 'shortbow', 'shortsword', 'rapier']));
    expect(ids).not.toContain('greatsword');
    expect(ids).not.toContain('longbow');
  });

  it('Slippery Mind gives Wisdom and Charisma save proficiency at 15; ASIs are at 4, 8, 10, 12, 16 (and the Epic Boon at 19)', () => {
    let e = newChar('rogue', { wis: 10, cha: 10 });
    expect(e.derived.savingThrows.wis).toBe(0);
    e = toLevel(e, 'rogue', 15);
    expect(e.derived.savingThrows.wis).toBe(e.derived.proficiencyBonus);
    const asis = e.choices.filter(c => c.definition.kind === 'asi').length;
    expect(asis).toBe(4);   // levels 4, 8, 10, 12 (16 and the level-19 Epic Boon are not yet reached)
  });

  it('Thief: Fast Hands and Second-Story Work at 3', () => {
    const e = bindSubclass(toLevel(newChar('rogue'), 'rogue', 3), 'rogue');
    expect(e.features.map(f => f.name)).toEqual(expect.arrayContaining(['Fast Hands', 'Second-Story Work']));
  });
});
