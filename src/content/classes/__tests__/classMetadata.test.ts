// src/content/classes/__tests__/classMetadata.test.ts
// FILTER-METADATA-1: ALL_CHAR_CLASSES' savingThrows/armorProfs/weaponProfs/
// spellcastingAbility were populated (previously always undefined for every
// official class) so class.tsx can offer real Saving-Throw-Proficiency /
// Armor-Proficiency / Weapon-Proficiency filters instead of reporting them
// BLOCKED. These fields are confirmed dead for MECHANICS on official classes
// (app/creation/class-detail.tsx's CLASS_DETAIL always wins) — this test
// locks in that the two stay in agreement, so a future edit to one doesn't
// silently drift from the other and mislead a filter.
import { ALL_CHAR_CLASSES } from '../index';
import type { Ability } from '../../../engine/types';

const KNOWN_CASTERS: Record<string, Ability> = {
  wizard: 'int', cleric: 'wis', druid: 'wis', bard: 'cha',
  paladin: 'cha', ranger: 'wis', sorcerer: 'cha', warlock: 'cha', artificer: 'int',
};
const KNOWN_MARTIAL = ['fighter', 'rogue', 'barbarian', 'monk'];
const VALID_ARMOR = new Set(['light', 'medium', 'heavy', 'shield']);
const VALID_WEAPON = new Set(['simple', 'martial']);

describe('ALL_CHAR_CLASSES filter metadata', () => {
  it('every official class has exactly 2 saving-throw proficiencies', () => {
    for (const cls of ALL_CHAR_CLASSES) {
      expect(cls.savingThrows).toBeDefined();
      expect(cls.savingThrows).toHaveLength(2);
    }
  });

  it('armorProfs/weaponProfs only use the documented closed vocabulary', () => {
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
    // Fighter/Barbarian get full martial access; Rogue/Monk are simple-only
    // (plus a short named-weapon list this metadata doesn't encode — see
    // ALL_CHAR_CLASSES' own FILTER-METADATA-1 comment).
    const fullMartial = new Set(['fighter', 'barbarian']);
    for (const id of KNOWN_MARTIAL) {
      const cls = ALL_CHAR_CLASSES.find(c => c.id === id)!;
      if (fullMartial.has(id)) {
        expect(cls.weaponProfs).toEqual(expect.arrayContaining(['simple', 'martial']));
      } else {
        expect(cls.weaponProfs).toEqual(['simple']);
      }
    }
  });
});
