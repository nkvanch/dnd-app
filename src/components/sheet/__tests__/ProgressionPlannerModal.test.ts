// src/components/sheet/__tests__/ProgressionPlannerModal.test.ts
// Tests buildProjectionRows directly (pure logic) — same
// real-projectToLevel-call convention LevelUpPreviewModal.test.ts already
// uses for buildLevelUpSummaryRows.
import { buildProjectionRows } from '../ProgressionPlannerModal';
import { projectToLevel } from '../../../engine/leveling';
import { makeEmptyEntity, DEFAULT_RULES } from '../../../store/characterStore';
import { Entity, ClassProgression } from '../../../engine/types';

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
        level: 3, hpDie: 8, grants: [],
        choices: [{
          id: 'asi_pick', prompt: 'Ability Score Improvement', kind: 'asi', count: 1,
          pool: 'all', grants: [], required: true, resolved: false,
        }],
      },
    ],
  };
}

function baseEntity(): Entity {
  const e = makeEmptyEntity('planner-test');
  return { ...e, identity: { ...e.identity, level: 1, classId: 'test_class' } };
}

describe('buildProjectionRows', () => {
  it('includes the determinate rows a real level-up would show (HP, new feature)', () => {
    const before = baseEntity();
    const after = projectToLevel(before, 2, progression(), DEFAULT_RULES);
    const rows = buildProjectionRows(before, after);
    expect(rows.some(r => r.label.startsWith('Max HP:'))).toBe(true);
    expect(rows.some(r => r.label === 'New feature: Action Surge')).toBe(true);
  });

  it('discloses a newly-queued pending choice as a plain note, without resolving it', () => {
    const before = baseEntity();
    const after = projectToLevel(before, 3, progression(), DEFAULT_RULES);
    const rows = buildProjectionRows(before, after);
    const disclosed = rows.find(r => r.label.includes('Ability Score Improvement'));
    expect(disclosed).toBeDefined();
    expect(disclosed!.label).toContain('Level 3');
    expect(disclosed!.note).toMatch(/not shown/i);
    // Still genuinely unresolved on the projected entity — the row is a
    // disclosure, not a silent auto-resolution.
    expect(after.choices.find(c => c.definition.id === 'asi_pick')!.resolved).toBe(false);
  });

  it('does not re-disclose a choice that was already pending before the projection', () => {
    // Simulate a character who already had this exact choice queued
    // (e.g. from a prior in-play level-up not yet resolved).
    let before = baseEntity();
    before = projectToLevel(before, 3, progression(), DEFAULT_RULES); // now level 3, choice queued
    const after = projectToLevel(before, 3, progression(), DEFAULT_RULES); // project to the same level again
    const rows = buildProjectionRows(before, after);
    expect(rows.some(r => r.label.includes('Ability Score Improvement'))).toBe(false);
  });

  it('does not disclose a choice that has already been resolved', () => {
    let before = baseEntity();
    before = projectToLevel(before, 3, progression(), DEFAULT_RULES);
    before = {
      ...before,
      choices: before.choices.map(c => c.definition.id === 'asi_pick' ? { ...c, resolved: true } : c),
    };
    const after = projectToLevel(before, 3, progression(), DEFAULT_RULES);
    const rows = buildProjectionRows(before, after);
    expect(rows.some(r => r.label.includes('Ability Score Improvement'))).toBe(false);
  });
});
