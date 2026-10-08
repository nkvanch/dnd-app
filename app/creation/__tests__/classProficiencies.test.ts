import { ALL_CHAR_CLASSES } from '../../../src/content/classes';
import { getProgressionForClass } from '../../../src/content/classes/progressions';
import { acquireClass } from '../../../src/engine/leveling';
import { makeEmptyEntity, DEFAULT_RULES } from '../../../src/store/characterStore';
import type { CharClass, ClassProgression } from '../../../src/engine/types';

/** Uses the same authoritative operation called by class-detail.tsx. */
function selectInitialClass(cls: CharClass, _progression: ClassProgression) {
  return acquireClass(makeEmptyEntity('e1'), cls, DEFAULT_RULES);
}

describe('official class initial proficiencies (A25)', () => {
  it('selecting Fighter as the initial class grants its full armor/weapon package', () => {
    const cls = ALL_CHAR_CLASSES.find(c => c.id === 'fighter')!;
    const progression = getProgressionForClass(cls);
    const entity = selectInitialClass(cls, progression);
    expect(entity.proficiencies.armor).toEqual(expect.arrayContaining(['light', 'medium', 'heavy', 'shield']));
    expect(entity.proficiencies.weapons).toEqual(expect.arrayContaining(['simple', 'martial']));
  });

  it('selecting Wizard as the initial class correctly grants NO blanket armor/weapon category (Wizard has none in 5e RAW)', () => {
    const cls = ALL_CHAR_CLASSES.find(c => c.id === 'wizard')!;
    const progression = getProgressionForClass(cls);
    const entity = selectInitialClass(cls, progression);
    expect(entity.proficiencies.armor).toEqual([]);
    expect(entity.proficiencies.weapons).toEqual(['Dagger', 'Dart', 'Sling', 'Quarterstaff', 'Light Crossbow']);
    expect(entity.proficiencies.weapons).not.toContain('simple');
  });

  it('every official class\'s armorProfs/weaponProfs content data survives round-trip through selectInitialClass unchanged (data regression guard)', () => {
    for (const cls of ALL_CHAR_CLASSES) {
      const progression = getProgressionForClass(cls);
      const entity = selectInitialClass(cls, progression);
      for (const a of cls.armorProfs ?? []) expect(entity.proficiencies.armor).toContain(a);
      for (const w of cls.weaponProfs ?? []) expect(entity.proficiencies.weapons).toContain(w);
    }
  });
});
