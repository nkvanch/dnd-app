// src/content/__tests__/compendiumBrowse.test.ts
import {
  flattenSubraces, attachParentClassNames, raceToBrowsable, subraceToBrowsable,
  classToBrowsable, subclassToBrowsable, backgroundToBrowsable, featToBrowsable,
  spellToBrowsable, itemToBrowsable, monsterToBrowsable, conditionToBrowsable,
  summaryLine, entrySourceLabel,
} from '../compendiumBrowse';
import type { Race, CharClass, Background, Feat, Condition } from '../../engine/types';
import type { SpellIndexEntry } from '../spellRepo.types';
import type { ItemIndexEntry } from '../itemRepo.types';
import type { MonsterTemplate } from '../monsters/types';
import type { SubclassEntry } from '../subclasses/subclassBrowse';

const race: Race = {
  id: 'human', name: 'Human', size: 'Medium', speed: 30, features: [], srd: true,
} as unknown as Race;

describe('flattenSubraces', () => {
  it('flattens each race\'s subraces, attaching the parent race id and name', () => {
    const withSubraces: Race = {
      ...race, id: 'dwarf', name: 'Dwarf',
      subraces: [
        { id: 'hill_dwarf', name: 'Hill Dwarf', parentId: 'dwarf', features: [] },
        { id: 'mountain_dwarf', name: 'Mountain Dwarf', parentId: 'dwarf', features: [] },
      ],
    };
    const flat = flattenSubraces([race, withSubraces]);
    expect(flat).toHaveLength(2);
    expect(flat[0]).toMatchObject({ id: 'hill_dwarf', parentRaceId: 'dwarf', parentRaceName: 'Dwarf' });
  });

  it('returns an empty array for races with no subraces', () => {
    expect(flattenSubraces([race])).toEqual([]);
  });
});

describe('attachParentClassNames', () => {
  it('resolves each subclass entry\'s classId to the real class display name', () => {
    const entries = [{ id: 'thief', name: 'Thief', classId: 'rogue', progression: { classId: 'rogue', name: 'Thief', entries: [] }, unlockLevel: 3, blurb: '' }] as unknown as SubclassEntry[];
    const classes = [{ id: 'rogue', name: 'Rogue', hitDie: 8, features: [] }] as unknown as CharClass[];
    expect(attachParentClassNames(entries, classes)[0].parentClassName).toBe('Rogue');
  });

  it('falls back to the raw classId if the class truly cannot be found', () => {
    const entries = [{ id: 'x', name: 'X', classId: 'unknown_class', progression: { classId: 'unknown_class', name: 'X', entries: [] }, unlockLevel: 1, blurb: '' }] as unknown as SubclassEntry[];
    expect(attachParentClassNames(entries, [])[0].parentClassName).toBe('unknown_class');
  });
});

describe('summaryLine', () => {
  it('Race: size + ruleset/source', () => {
    const entry = raceToBrowsable(race, false);
    expect(summaryLine(entry)).toBe('Medium · SRD 5.1');
  });

  it('Subrace: parent race name + source', () => {
    const sr = { id: 'hill_dwarf', name: 'Hill Dwarf', parentId: 'dwarf', parentRaceId: 'dwarf', parentRaceName: 'Dwarf', features: [] };
    const entry = subraceToBrowsable(sr, true);
    expect(summaryLine(entry)).toBe('Dwarf · Local Homebrew');
  });

  it('Class: hit die + caster type + spellcasting ability', () => {
    const wizard = { id: 'wizard', name: 'Wizard', hitDie: 6, features: [], spellcastingAbility: 'int' } as unknown as CharClass;
    expect(summaryLine(classToBrowsable(wizard, false))).toBe('d6 · Full Caster · INT');
  });

  it('Class: a martial class with no spellcasting ability omits that part', () => {
    const fighter = { id: 'fighter', name: 'Fighter', hitDie: 10, features: [] } as unknown as CharClass;
    expect(summaryLine(classToBrowsable(fighter, false))).toBe('d10 · Martial');
  });

  it('Subclass: parent class name + unlock level', () => {
    const entry = { id: 'thief', name: 'Thief', classId: 'rogue', parentClassName: 'Rogue', progression: { classId: 'rogue', name: 'Thief', entries: [] }, unlockLevel: 3, blurb: '' };
    expect(summaryLine(subclassToBrowsable(entry, false))).toBe('Rogue · Level 3');
  });

  it('Background: ruleset/source, falling back to a plain label when neither is available', () => {
    const acolyte: Background = { id: 'acolyte', name: 'Acolyte', features: [], srd: true };
    const homebrewBg: Background = { id: 'hb', name: 'Homebrew Bg', features: [] };
    expect(summaryLine(backgroundToBrowsable(acolyte, false))).toBe('SRD 5.1');
    expect(summaryLine(backgroundToBrowsable(homebrewBg, true))).toBe('Local Homebrew');
  });

  it('Feat: primary prerequisite category, with a friendly label for none', () => {
    const noPrereq: Feat = { id: 'alert', name: 'Alert', prerequisite: null, description: '', source: 'PHB', feature: {} as Feat['feature'] };
    const withPrereq: Feat = { id: 'x', name: 'X', prerequisite: 'Strength 13+', description: '', source: 'PHB', feature: {} as Feat['feature'] };
    expect(summaryLine(featToBrowsable(noPrereq, false))).toBe('No prerequisite');
    expect(summaryLine(featToBrowsable(withPrereq, false))).toBe('Ability Score');
  });

  it('Spell: level/school + casting-time bucket, cantrips labeled specially', () => {
    const fireball: SpellIndexEntry = { id: 'fireball', name: 'Fireball', level: 3, school: 'Evocation', castingTime: '1 action', ritual: false, concentration: false };
    const cantrip: SpellIndexEntry = { id: 'fb', name: 'Fire Bolt', level: 0, school: 'Evocation', castingTime: '1 action', ritual: false, concentration: false };
    expect(summaryLine(spellToBrowsable(fireball, false))).toBe('3rd-level Evocation · Action');
    expect(summaryLine(spellToBrowsable(cantrip, false))).toBe('Cantrip Evocation · Action');
  });

  it('Item: category + cost', () => {
    const sword: ItemIndexEntry = { id: 'longsword', name: 'Longsword', weight: 3, cost: '15 gp', properties: ['versatile'], hasDamageEffect: true, weaponRange: null };
    expect(summaryLine(itemToBrowsable(sword, false))).toBe('Weapons · 15 gp');
  });

  it('Monster: CR + size + type', () => {
    const dragon: MonsterTemplate = {
      id: 'adult_red_dragon', name: 'Adult Red Dragon', cr: 17, size: 'huge', type: 'dragon', alignment: 'chaotic evil',
      stats: { str: 27, dex: 10, con: 25, int: 16, wis: 13, cha: 21 },
      hp: { dice: '32d12+224', average: 256 }, ac: { value: 19, source: 'natural armor' },
      speed: 40, features: [], savingThrows: [], skills: {}, senses: [], languages: [],
    };
    expect(summaryLine(monsterToBrowsable(dragon, false))).toBe('CR 17 · Huge dragon');
  });

  it('Condition: label + ruleset/source', () => {
    const blinded: Condition = { id: 'blinded', name: 'Blinded', description: '', features: [] };
    expect(summaryLine(conditionToBrowsable(blinded, false))).toBe('Condition');
    expect(summaryLine(conditionToBrowsable(blinded, true))).toBe('Condition · Local Homebrew');
  });
});

describe('entrySourceLabel', () => {
  it('dispatches to the correct type-specific source-label function', () => {
    expect(entrySourceLabel(raceToBrowsable(race, false))).toBe('SRD 5.1');
    const blinded: Condition = { id: 'blinded', name: 'Blinded', description: '', features: [] };
    expect(entrySourceLabel(conditionToBrowsable(blinded, true))).toBe('Local Homebrew');
  });
});
