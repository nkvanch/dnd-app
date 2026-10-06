// Direct unit tests for applyChangesToEntity's new branches (condition_add/remove,
// concentration_break, stabilize) — the REAL production code path a Player's device runs when
// accepting a DM's change request, as opposed to characterVitals.test.ts's wire-level coverage
// via FakeCharacter. applyChangesToEntity's pre-existing branches (hp/max_hp/temp_hp/exhaustion/
// ability) had no direct unit test before this file either — see roles.test.ts's characterChange
// tests, which only cover describeChange/validChanges, never the entity mutation itself.
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { applyChangesToEntity } from '../entityAdapter';
import { Entity } from '../../engine/types';

describe('applyChangesToEntity: condition_add / condition_remove', () => {
  it('adds a known condition (with its mechanical features resolved from content) and removes it again', () => {
    let e = makeEmptyEntity('e1');
    e = applyChangesToEntity(e, [{ kind: 'condition_add', conditionId: 'poisoned' }], DEFAULT_RULES);
    expect(e.conditionMonitor.active.map(c => c.id)).toEqual(['poisoned']);
    expect(e.conditions.map(c => c.id)).toEqual(['poisoned']);
    // Poisoned's real SRD feature (disadvantage on attacks/ability checks) should have attached —
    // same content-features path app/sheet/[id].tsx's own condition toggle already uses.
    expect(e.features.some(f => f.source.kind === 'condition' && f.source.refId === 'poisoned')).toBe(true);

    e = applyChangesToEntity(e, [{ kind: 'condition_remove', conditionId: 'poisoned' }], DEFAULT_RULES);
    expect(e.conditionMonitor.active).toEqual([]);
    expect(e.features.some(f => f.source.kind === 'condition' && f.source.refId === 'poisoned')).toBe(false);
  });

  it('adding the same condition twice does not duplicate it', () => {
    let e = makeEmptyEntity('e1');
    e = applyChangesToEntity(e, [{ kind: 'condition_add', conditionId: 'prone' }], DEFAULT_RULES);
    e = applyChangesToEntity(e, [{ kind: 'condition_add', conditionId: 'prone' }], DEFAULT_RULES);
    expect(e.conditionMonitor.active.map(c => c.id)).toEqual(['prone']);
  });

  it('removing a condition that is not active is a harmless no-op', () => {
    const e = makeEmptyEntity('e1');
    const after = applyChangesToEntity(e, [{ kind: 'condition_remove', conditionId: 'prone' }], DEFAULT_RULES);
    expect(after.conditionMonitor.active).toEqual([]);
  });

  it('an unrecognized condition id (e.g. a homebrew pack not installed on this device) still records the id, just with no mechanical features', () => {
    let e = makeEmptyEntity('e1');
    e = applyChangesToEntity(e, [{ kind: 'condition_add', conditionId: 'totally-made-up-condition' }], DEFAULT_RULES);
    expect(e.conditionMonitor.active.map(c => c.id)).toEqual(['totally-made-up-condition']);
    expect(e.features.some(f => f.source.kind === 'condition')).toBe(false);
  });
});

describe('applyChangesToEntity: concentration_break', () => {
  it('clears concentration when the entity is a caster', () => {
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      spellcasting: {
        ability: 'int', cantrips: [], known: [], prepared: [], concentrating: 'bless',
        slots: { '1': { total: 2, used: 1 }, '2': { total: 0, used: 0 }, '3': { total: 0, used: 0 }, '4': { total: 0, used: 0 }, '5': { total: 0, used: 0 }, '6': { total: 0, used: 0 }, '7': { total: 0, used: 0 }, '8': { total: 0, used: 0 }, '9': { total: 0, used: 0 } },
      },
    };
    const after = applyChangesToEntity(e, [{ kind: 'concentration_break' }], DEFAULT_RULES);
    expect(after.spellcasting?.concentrating).toBeNull();
  });

  it('is a harmless no-op on a non-caster (spellcasting is null)', () => {
    const e = makeEmptyEntity('e1');
    expect(e.spellcasting).toBeNull();
    const after = applyChangesToEntity(e, [{ kind: 'concentration_break' }], DEFAULT_RULES);
    expect(after.spellcasting).toBeNull();
  });
});

describe('applyChangesToEntity: stabilize', () => {
  it('resets death save counters and marks the character stable', () => {
    const e: Entity = { ...makeEmptyEntity('e1'), resources: { ...makeEmptyEntity('e1').resources, deathSaves: { successes: 1, failures: 2, stable: false } } };
    const after = applyChangesToEntity(e, [{ kind: 'stabilize' }], DEFAULT_RULES);
    expect(after.resources.deathSaves).toEqual({ successes: 0, failures: 0, stable: true });
  });
});

describe('applyChangesToEntity: heroic_inspiration', () => {
  it('awards Heroic Inspiration, and a second award does not stack', () => {
    let e = makeEmptyEntity('e1');
    expect(e.heroicInspiration).toBeFalsy();
    e = applyChangesToEntity(e, [{ kind: 'heroic_inspiration' }], DEFAULT_RULES);
    expect(e.heroicInspiration).toBe(true);
    e = applyChangesToEntity(e, [{ kind: 'heroic_inspiration' }], DEFAULT_RULES);
    expect(e.heroicInspiration).toBe(true);
  });
});
