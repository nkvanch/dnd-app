// src/components/__tests__/FeatPreviewModal.test.ts
// Tests buildFeatSummaryRows directly (pure logic) rather than through the
// RN component, matching this codebase's established preference. Feats'
// ability-score bonuses are injected as stat_modifier Effects (see
// AsiFeatPicker.tsx's featureToApply()), not written to entity.stats
// directly, so an ability-granting feat is exercised through a real
// applyFeatToEntity() call rather than a hand-crafted stats diff — that's
// the actual shape a feat commit produces.
import { buildFeatSummaryRows } from '../FeatPreviewModal';
import { applyFeatToEntity } from '../../engine/leveling';
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { Entity, Feature } from '../../engine/types';

function feature(id: string, effects: Feature['effects'] = []): Feature {
  return {
    id, name: id, description: '', source: { kind: 'feat', refId: id },
    level: null, effects, actions: [], choices: [], passive: true,
  };
}

function baseEntity(): Entity {
  const e = makeEmptyEntity('feat-preview-test');
  return { ...e, choices: [{ id: 'c1', definition: { kind: 'asi_or_feat', prompt: '' } as any, grantedAt: 4, resolved: false, selections: [] }] };
}

describe('buildFeatSummaryRows', () => {
  it('reports an effective ability-score change from a feat-granted stat_modifier', () => {
    const before = baseEntity();
    const after = applyFeatToEntity(
      before, 'c1', 4,
      feature('resilient_test', [{ type: 'stat_modifier', target: 'con', operation: 'add', value: 1, condition: null }]),
      'resilient_test', DEFAULT_RULES,
    );
    const rows = buildFeatSummaryRows(before, after);
    expect(rows.some(r => r.label === 'CON: 10 → 11')).toBe(true);
  });

  it('reports a new skill proficiency', () => {
    const before = baseEntity();
    const after = applyFeatToEntity(
      before, 'c1', 4,
      feature('skilled_test', [{ type: 'grant_proficiency', target: 'skill:athletics', operation: 'add', value: null, condition: null }]),
      'skilled_test', DEFAULT_RULES,
    );
    const rows = buildFeatSummaryRows(before, after);
    expect(rows.some(r => r.label === 'Athletics: proficient')).toBe(true);
  });

  it('reports a new saving-throw proficiency (Resilient-style)', () => {
    const before = baseEntity();
    const after: Entity = {
      ...before,
      proficiencies: { ...before.proficiencies, savingThrows: [...before.proficiencies.savingThrows, 'wis'] },
    };
    const rows = buildFeatSummaryRows(before, after);
    expect(rows.some(r => r.label === 'WIS saving throws: proficient')).toBe(true);
  });

  it('reports a max HP change (CON-increasing feat, via reconcileConHp)', () => {
    const e = baseEntity();
    const before: Entity = { ...e, resources: { ...e.resources, hp: { current: 20, maximum: 20, temp: 0 } } };
    const after: Entity = { ...before, resources: { ...before.resources, hp: { current: 21, maximum: 21, temp: 0 } } };
    const rows = buildFeatSummaryRows(before, after);
    expect(rows.some(r => r.label === 'Max HP: 20 → 21')).toBe(true);
  });

  it('returns no rows for a purely narrative feat with no automated effect', () => {
    const before = baseEntity();
    const after = applyFeatToEntity(before, 'c1', 4, feature('linguist_test'), 'linguist_test', DEFAULT_RULES);
    expect(buildFeatSummaryRows(before, after)).toEqual([]);
  });
});
