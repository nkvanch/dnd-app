// src/content/classes/__tests__/spellcastingChoices.test.ts
// Wizard's level-1 entry had a spellbook ChoiceDefinition (spellChoice, kind
// 'spell') but no cantrip choice, unlike every other known-spell caster
// (Bard/Sorcerer/Warlock all pair a cantrips choice with their spells-known
// choice at level 1). app/creation/spells.tsx's spellChoices.length > 0
// branch takes over rendering entirely once ANY spell-kind choice exists —
// so a Wizard was never shown a cantrip picker at creation, at all
// (architecture review U14).
import { ALL_CLASS_PROGRESSIONS } from '../index';

function level1ChoiceIds(classId: string): string[] {
  const progression = ALL_CLASS_PROGRESSIONS.find(p => p.classId === classId);
  const level1 = progression?.entries.find(e => e.level === 1);
  return (level1?.choices ?? []).filter(c => c.kind === 'spell').map(c => c.id);
}

describe('Wizard has a level-1 cantrip choice (audit finding U14)', () => {
  it('level 1 includes both a cantrip choice and the spellbook choice', () => {
    const ids = level1ChoiceIds('wizard');
    expect(ids.some(id => id.includes('cantrip'))).toBe(true);
    expect(ids.some(id => id === 'wizard_spellbook_1')).toBe(true);
  });

  it('the cantrip choice asks for 3 (the correct 1st-level Wizard cantrips-known count)', () => {
    const progression = ALL_CLASS_PROGRESSIONS.find(p => p.classId === 'wizard');
    const level1 = progression?.entries.find(e => e.level === 1);
    const cantripChoice = level1?.choices.find(c => c.kind === 'spell' && c.id.includes('cantrip'));
    expect(cantripChoice?.count).toBe(3);
  });
});

describe('every known-spell caster with cantrips pairs a cantrip choice with its spells-known choice at the level spellcasting starts (regression lock for the U14 bug class)', () => {
  // Ranger/Paladin are half-casters that start with 0 cantrips known (real
  // 5e RAW) and are deliberately excluded — they have no cantrip choice to
  // pair, by design, not by omission.
  const knownCasters: { classId: string; startLevel: number }[] = [
    { classId: 'wizard',   startLevel: 1 },
    { classId: 'sorcerer', startLevel: 1 },
    { classId: 'bard',     startLevel: 1 },
    { classId: 'warlock',  startLevel: 1 },
  ];

  it.each(knownCasters)('$classId has a cantrip choice at its spellcasting start level', ({ classId, startLevel }) => {
    const ids = level1ChoiceIds(classId);
    expect(ids.some(id => id.includes('cantrip'))).toBe(true);
    // Sanity: startLevel is always 1 for this table today — if a future
    // half-caster addition needs a different start level, this assertion
    // (not just the fixture) should be the thing that has to change.
    expect(startLevel).toBe(1);
  });
});
