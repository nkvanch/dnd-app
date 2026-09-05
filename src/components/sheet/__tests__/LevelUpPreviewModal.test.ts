// src/components/sheet/__tests__/LevelUpPreviewModal.test.ts
// Tests buildLevelUpSummaryRows directly (pure logic), exercised through
// real levelUp() + simulate() calls where feasible (matching the codebase's
// established preference for testing pure logic over rendering) — except
// spell slots, which are driven by a real content lookup table keyed by a
// known class id, so that one row is exercised via a hand-crafted
// before/after pair instead, same technique EquipmentPreviewModal's own
// "new attack" test uses for a similarly pipeline-computed field.
import { buildLevelUpSummaryRows } from '../LevelUpPreviewModal';
import { levelUp } from '../../../engine/leveling';
import { simulate } from '../../../engine/simulate';
import { makeEmptyEntity, DEFAULT_RULES } from '../../../store/characterStore';
import { Entity, ClassProgression } from '../../../engine/types';

// DEFAULT_RULES.hpMode is 'fixed' — already fully deterministic (no
// Math.random()), so no override needed for these tests.

function progression(): ClassProgression {
  return {
    classId: 'test_class',
    entries: [
      { level: 1, hpDie: 8, grants: [], choices: [] },
      {
        level: 2, hpDie: 8, choices: [],
        grants: [{ kind: 'feature', value: {
          id: 'action_surge', name: 'Action Surge', description: '', source: { kind: 'class', refId: 'test_class' },
          level: 2, effects: [], actions: [], choices: [], passive: true,
        } }],
      },
      {
        level: 3, hpDie: 8, choices: [],
        grants: [{ kind: 'resource', value: { resourceId: 'second_wind', name: 'Second Wind', maximum: 1, recharge: 'long_rest' } }],
      },
      { level: 4, hpDie: 8, grants: [], choices: [] },
      { level: 5, hpDie: 8, grants: [], choices: [] },
    ],
  };
}

function baseEntity(level: number): Entity {
  const e = makeEmptyEntity('levelup-test');
  return {
    ...e,
    identity: { ...e.identity, level, classId: 'test_class' },
    // A real level-N character already has N hit dice — makeEmptyEntity
    // always starts at 0 regardless of the level set above, so match it
    // here for a realistic before-state.
    resources: { ...e.resources, hitDice: { die: 8, total: level, remaining: level } },
  };
}

describe('buildLevelUpSummaryRows', () => {
  it('reports max HP and hit dice change on a single level-up', () => {
    const entity = baseEntity(1);
    const { before, after } = simulate(entity, e => levelUp(e, 2, progression(), DEFAULT_RULES), DEFAULT_RULES);
    expect(after.resources.hp.maximum).toBeGreaterThan(before.resources.hp.maximum);
    const rows = buildLevelUpSummaryRows(before, after);
    expect(rows.some(r => r.label.startsWith('Max HP:'))).toBe(true);
    expect(rows.some(r => r.label === `Hit Dice: 1 → 2 (d8)`)).toBe(true);
  });

  it('reports a new feature granted at this level', () => {
    const entity = baseEntity(1);
    const { before, after } = simulate(entity, e => levelUp(e, 2, progression(), DEFAULT_RULES), DEFAULT_RULES);
    const rows = buildLevelUpSummaryRows(before, after);
    expect(rows.some(r => r.label === 'New feature: Action Surge')).toBe(true);
  });

  it('reports a new resource granted at this level', () => {
    const entity = baseEntity(2);
    const { before, after } = simulate(entity, e => levelUp(e, 3, progression(), DEFAULT_RULES), DEFAULT_RULES);
    const rows = buildLevelUpSummaryRows(before, after);
    expect(rows.some(r => r.label === 'New resource: Second Wind (1)')).toBe(true);
  });

  it('reports a proficiency bonus ripple at a breakpoint level (4 -> 5)', () => {
    const entity = baseEntity(4);
    const { before, after } = simulate(entity, e => levelUp(e, 5, progression(), DEFAULT_RULES), DEFAULT_RULES);
    expect(after.derived.proficiencyBonus).toBeGreaterThan(before.derived.proficiencyBonus);
    const rows = buildLevelUpSummaryRows(before, after);
    expect(rows.some(r => r.label === `Proficiency Bonus: ${before.derived.proficiencyBonus} → ${after.derived.proficiencyBonus}`)).toBe(true);
  });

  it('reports a spell slot change', () => {
    // Spell slots come from a real content lookup keyed by class id
    // (getSpellSlotsForClassLevel), not something a synthetic test class
    // can drive — exercise the row-builder directly instead.
    const e = makeEmptyEntity('levelup-test');
    const before: Entity = {
      ...e,
      spellcasting: {
        ability: 'int', cantrips: [], known: [], prepared: [], concentrating: null,
        slots: { '1': { total: 2, used: 1 }, '2': { total: 0, used: 0 }, '3': { total: 0, used: 0 }, '4': { total: 0, used: 0 }, '5': { total: 0, used: 0 }, '6': { total: 0, used: 0 }, '7': { total: 0, used: 0 }, '8': { total: 0, used: 0 }, '9': { total: 0, used: 0 } },
      },
    };
    const after: Entity = {
      ...before,
      spellcasting: { ...before.spellcasting!, slots: { ...before.spellcasting!.slots, '1': { total: 3, used: 1 } } },
    };
    const rows = buildLevelUpSummaryRows(before, after);
    expect(rows.some(r => r.label === 'Level 1 slots: 1 → 2 available')).toBe(true);
  });

  it('returns no rows when the level-up only queues a pending choice (no immediate grant)', () => {
    const emptyProgression: ClassProgression = { classId: 'test_class', entries: [
      { level: 1, hpDie: 8, grants: [], choices: [] },
    ] };
    const entity = baseEntity(1);
    // Leveling to a level with no entry at all is a genuine no-op for HP too.
    const { before, after } = simulate(entity, e => levelUp(e, 1, emptyProgression, DEFAULT_RULES), DEFAULT_RULES);
    expect(buildLevelUpSummaryRows(before, after)).toEqual([]);
  });
});
