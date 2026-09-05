// src/components/sheet/__tests__/RestPreviewModal.test.ts
// Tests the pure row-building logic (buildRestSummaryRows) directly rather
// than through the RN component, matching this codebase's established
// preference for testing pure logic over rendering. Covers every row type
// the preview modal can show: HP, hit dice, spell slots, custom resources,
// exhaustion, concentration, and until_rest condition removal — the same
// fields takeRest() (src/engine/rest.ts) is documented to change.
import { buildRestSummaryRows, buildRestMutation } from '../RestPreviewModal';
import { simulate } from '../../../engine/simulate';
import { makeEmptyEntity, DEFAULT_RULES } from '../../../store/characterStore';
import { Entity } from '../../../engine/types';

function baseEntity(): Entity {
  const e = makeEmptyEntity('rest-preview-test');
  return {
    ...e,
    resources: {
      ...e.resources,
      hp:      { current: 5, maximum: 20, temp: 3 },
      hitDice: { die: 8, total: 4, remaining: 1 },
      custom: [
        { id: 'ki', name: 'Ki Points', current: 0, maximum: 4, recharge: 'long_rest' },
      ],
    },
    spellcasting: {
      ability: 'wis',
      slots: {
        '1': { total: 4, used: 3 }, '2': { total: 3, used: 3 },
        '3': { total: 0, used: 0 }, '4': { total: 0, used: 0 }, '5': { total: 0, used: 0 },
        '6': { total: 0, used: 0 }, '7': { total: 0, used: 0 }, '8': { total: 0, used: 0 }, '9': { total: 0, used: 0 },
      },
      cantrips: [], known: [], prepared: [],
      concentrating: 'bless',
    },
    conditionMonitor: {
      ...e.conditionMonitor,
      exhaustion: 2,
      active: [
        { id: 'blinded', sourceId: 'test', duration: { unit: 'until_rest', remaining: 0 }, suppressedBy: [] },
      ],
    },
  };
}

describe('buildRestSummaryRows (long rest)', () => {
  it('reports HP, hit dice, spell slots, resources, exhaustion, concentration, and removed conditions', () => {
    const entity = baseEntity();
    const { before, after } = simulate(entity, buildRestMutation('long', DEFAULT_RULES), DEFAULT_RULES);
    const rows = buildRestSummaryRows(before, after);
    const labels = rows.map(r => r.label);

    expect(labels.some(l => l.startsWith('HP: 5 → 20'))).toBe(true);
    expect(rows.find(r => r.label.startsWith('HP:'))?.note).toBe('Temporary HP cleared');
    expect(labels.some(l => l.startsWith('Hit Dice: 1/4 → '))).toBe(true);
    expect(labels.some(l => l.startsWith('Level 1 slots: 1 → 4 available'))).toBe(true);
    expect(labels.some(l => l.startsWith('Level 2 slots: 0 → 3 available'))).toBe(true);
    expect(labels.some(l => l.startsWith('Ki Points: 0 → 4'))).toBe(true);
    expect(labels.some(l => l === 'Exhaustion: 2 → 1')).toBe(true);
    expect(labels.some(l => l.includes('Concentration on') && l.includes('dropped'))).toBe(true);
    expect(labels.some(l => l.startsWith('Conditions removed:') && l.includes('Blinded'))).toBe(true);
  });

  it('produces no rows for a fully-rested character (nothing to restore)', () => {
    const e = makeEmptyEntity('rest-preview-full');
    const fullyRested: Entity = {
      ...e,
      resources: { ...e.resources, hp: { current: 0, maximum: 0, temp: 0 }, hitDice: { die: 8, total: 0, remaining: 0 } },
    };
    const { before, after } = simulate(fullyRested, buildRestMutation('long', DEFAULT_RULES), DEFAULT_RULES);
    expect(buildRestSummaryRows(before, after)).toEqual([]);
  });
});

describe('buildRestMutation', () => {
  it('short rest does not restore HP or non-pact spell slots', () => {
    const entity = baseEntity();
    const { before, after } = simulate(entity, buildRestMutation('short', DEFAULT_RULES), DEFAULT_RULES);
    expect(after.resources.hp.current).toBe(before.resources.hp.current);
    expect(after.spellcasting?.slots['1'].used).toBe(before.spellcasting?.slots['1'].used);
  });

  it('is idempotent to preview repeatedly without committing (simulate never mutates the input entity)', () => {
    const entity = baseEntity();
    simulate(entity, buildRestMutation('long', DEFAULT_RULES), DEFAULT_RULES);
    simulate(entity, buildRestMutation('long', DEFAULT_RULES), DEFAULT_RULES);
    expect(entity.resources.hp.current).toBe(5);
    expect(entity.conditionMonitor.exhaustion).toBe(2);
  });
});
