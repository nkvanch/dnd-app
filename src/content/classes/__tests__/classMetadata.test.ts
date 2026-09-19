import { ALL_CHAR_CLASSES } from '../index';
import type { Ability } from '../../../engine/types';

const KNOWN_CASTERS: Record<string, Ability> = {
  wizard: 'int', cleric: 'wis', druid: 'wis', bard: 'cha',
  paladin: 'cha', ranger: 'wis', sorcerer: 'cha', warlock: 'cha', artificer: 'int',
};
const KNOWN_MARTIAL = ['fighter', 'rogue', 'barbarian', 'monk'];
const VALID_ARMOR = new Set(['light', 'medium', 'heavy', 'shield']);
const VALID_WEAPON = new Set(['simple', 'martial', 'Hand Crossbow', 'Longsword', 'Rapier', 'Shortsword', 'Dagger', 'Dart', 'Sling', 'Quarterstaff', 'Light Crossbow', 'Club', 'Javelin', 'Mace', 'Scimitar', 'Sickle', 'Spear']);

describe('ALL_CHAR_CLASSES filter metadata', () => {
  it('every official class has exactly 2 saving-throw proficiencies', () => {
    for (const cls of ALL_CHAR_CLASSES) {
      expect(cls.savingThrows).toBeDefined();
      expect(cls.savingThrows).toHaveLength(2);
    }
  });

  it('armorProfs/weaponProfs use supported category or named-weapon proficiencies', () => {
    for (const cls of ALL_CHAR_CLASSES) {
      expect(cls.armorProfs).toBeDefined();
      expect(cls.weaponProfs).toBeDefined();
      for (const a of cls.armorProfs!) expect(VALID_ARMOR.has(a)).toBe(true);
      for (const w of cls.weaponProfs!) expect(VALID_WEAPON.has(w)).toBe(true);
    }
  });

  it('spellcastingAbility is set exactly for the known caster classes', () => {
    for (const cls of ALL_CHAR_CLASSES) {
      if (cls.id in KNOWN_CASTERS) {
        expect(cls.spellcastingAbility).toBe(KNOWN_CASTERS[cls.id]);
      } else {
        expect(cls.spellcastingAbility).toBeUndefined();
      }
    }
  });

  it('known non-casters have no blanket martial-weapon access beyond their real PHB grant', () => {
    // Named exceptions do not imply blanket martial access.
    const fullMartial = new Set(['fighter', 'barbarian']);
    for (const id of KNOWN_MARTIAL) {
      const cls = ALL_CHAR_CLASSES.find(c => c.id === id)!;
      if (fullMartial.has(id)) {
        expect(cls.weaponProfs).toEqual(expect.arrayContaining(['simple', 'martial']));
      } else {
        expect(cls.weaponProfs).toContain('simple');
        expect(cls.weaponProfs).not.toContain('martial');
      }
    }
  });
});
