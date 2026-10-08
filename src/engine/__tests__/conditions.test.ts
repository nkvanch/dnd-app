// src/engine/__tests__/conditions.test.ts
// Covers applyCondition's optional duration param (new — previously
// hardcoded to null) and confirms it round-trips correctly through the
// two mechanisms that actually act on a duration: tickDurations()
// ('rounds') and longRest() ('until_rest').
import { applyCondition, tickDurations } from '../conditions';
import { takeRest } from '../rest';
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';

describe('applyCondition — duration', () => {
  it('defaults to null (permanent) when no duration is passed — unchanged existing behavior', () => {
    const e = makeEmptyEntity('cond-test');
    const updated = applyCondition(e, 'blinded', 'manual', DEFAULT_RULES);
    expect(updated.conditionMonitor.active[0].duration).toBeNull();
  });

  it('a rounds duration is removed by tickDurations after exactly N ticks', () => {
    const e = makeEmptyEntity('cond-test');
    let updated = applyCondition(e, 'blinded', 'manual', DEFAULT_RULES, undefined, { unit: 'rounds', remaining: 2 });
    expect(updated.conditionMonitor.active).toHaveLength(1);

    updated = tickDurations(updated, DEFAULT_RULES);
    expect(updated.conditionMonitor.active).toHaveLength(1); // 2 -> 1, still active
    expect(updated.conditionMonitor.active[0].duration).toEqual({ unit: 'rounds', remaining: 1 });

    updated = tickDurations(updated, DEFAULT_RULES);
    expect(updated.conditionMonitor.active).toHaveLength(0); // 1 -> 0, removed
  });

  it('an until_rest duration survives tickDurations but is removed by a long rest', () => {
    const e = makeEmptyEntity('cond-test');
    let updated = applyCondition(e, 'blinded', 'manual', DEFAULT_RULES, undefined, { unit: 'until_rest', remaining: 0 });
    expect(updated.conditionMonitor.active).toHaveLength(1);

    updated = tickDurations(updated, DEFAULT_RULES);
    expect(updated.conditionMonitor.active).toHaveLength(1); // untouched by round ticking

    updated = takeRest(updated, 'long', DEFAULT_RULES);
    expect(updated.conditionMonitor.active).toHaveLength(0); // removed by long rest
  });

  it('a permanent (null) duration survives both tickDurations and a long rest', () => {
    const e = makeEmptyEntity('cond-test');
    let updated = applyCondition(e, 'blinded', 'manual', DEFAULT_RULES, undefined, null);
    updated = tickDurations(updated, DEFAULT_RULES);
    updated = takeRest(updated, 'long', DEFAULT_RULES);
    expect(updated.conditionMonitor.active).toHaveLength(1);
  });

  // Regression test for a real bug: tickDurations previously removed the
  // ActiveCondition entry on expiry but left the Feature(s) applyCondition()
  // granted sitting in entity.features forever, so the condition's
  // mechanical effect (here, a flat -2 AC) kept applying after the
  // condition visibly expired.
  it('an expired rounds-duration condition also loses the feature (and effect) it granted', () => {
    const e = makeEmptyEntity('cond-test');
    const acPenaltyFeature = [{
      id: 'cursed_ac_penalty', name: 'Cursed', description: '', source: { kind: 'condition' as const, refId: 'cursed' },
      level: null, effects: [{ type: 'stat_modifier' as const, target: 'ac', operation: 'add' as const, value: -2, condition: null }],
      actions: [], choices: [], passive: true,
    }];
    let updated = applyCondition(e, 'cursed', 'manual', DEFAULT_RULES, acPenaltyFeature, { unit: 'rounds', remaining: 1 });
    expect(updated.features.some(f => f.id === 'cursed_ac_penalty')).toBe(true);
    expect(updated.derived.ac).toBe(e.derived.ac - 2);

    updated = tickDurations(updated, DEFAULT_RULES); // 1 -> 0, expires
    expect(updated.conditionMonitor.active).toHaveLength(0);
    expect(updated.features.some(f => f.id === 'cursed_ac_penalty')).toBe(false);
    expect(updated.derived.ac).toBe(e.derived.ac);
  });

  it('an unrelated still-active condition keeps its feature when a different one expires', () => {
    const e = makeEmptyEntity('cond-test');
    const permanentFeature = [{
      id: 'permanent_marker', name: 'Marked', description: '', source: { kind: 'condition' as const, refId: 'marked' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    }];
    let updated = applyCondition(e, 'marked', 'manual', DEFAULT_RULES, permanentFeature, null);
    updated = applyCondition(updated, 'blinded', 'manual', DEFAULT_RULES, undefined, { unit: 'rounds', remaining: 1 });
    updated = tickDurations(updated, DEFAULT_RULES);
    expect(updated.conditionMonitor.active.map(c => c.id)).toEqual(['marked']);
    expect(updated.features.some(f => f.id === 'permanent_marker')).toBe(true);
  });
});
