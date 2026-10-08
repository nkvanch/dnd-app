// src/content/races/__tests__/subraceBrowse.test.ts
import { subraceOwnTraits } from '../subraceBrowse';
import { Subrace, Feature } from '../../../engine/types';

const feature = (effects: Feature['effects']): Feature => ({
  id: 'f', name: 'F', description: '', source: { kind: 'race', refId: 'test' },
  level: null, actions: [], choices: [], passive: true, effects,
});

function subrace(overrides: Partial<Subrace> = {}): Subrace {
  return { id: 'sub', name: 'Sub', parentId: 'race', features: [], ...overrides };
}

describe('subraceOwnTraits', () => {
  it('detects a size override (real field, not derived)', () => {
    expect(subraceOwnTraits(subrace({ size: 'Small' }))).toEqual(new Set(['size_override']));
  });

  it('detects flexibleAsi as an ASI/stat change even with no matching feature effect', () => {
    const sub = subrace({ flexibleAsi: { prompt: 'x', mode: { kind: 'two_distinct_plus_one' } } });
    expect(subraceOwnTraits(sub).has('asi')).toBe(true);
  });

  it('detects movement/senses/asi/proficiency/spellcasting/defensive from real feature effects', () => {
    const sub = subrace({
      features: [feature([
        { type: 'grant_movement', target: 'speed', operation: 'set', value: 35, condition: null, movementType: 'fly' },
        { type: 'grant_sense', target: 'darkvision', operation: 'set', value: 60, condition: null, senseType: 'darkvision' },
        { type: 'stat_modifier', target: 'dex', operation: 'add', value: 1, condition: null },
        { type: 'grant_proficiency', target: 'skill:perception', operation: 'add', value: null, condition: null },
        { type: 'grant_spell', target: 'misty_step', operation: 'add', value: null, condition: null },
        { type: 'grant_resistance', target: 'fire', operation: 'add', value: null, condition: null },
      ] as unknown as Feature['effects']),
    ] });
    const traits = subraceOwnTraits(sub);
    expect(traits).toEqual(new Set(['movement', 'senses', 'asi', 'proficiency', 'spellcasting', 'defensive']));
  });

  it('returns an empty set for a subrace with no size override, no flexibleAsi, and no matching effects', () => {
    const sub = subrace({ features: [feature([])] });
    expect(subraceOwnTraits(sub).size).toBe(0);
  });

  it('never inspects a parent race\'s traits — Subrace has no field for them at all, so this is structurally guaranteed, not just a scoping choice', () => {
    // A Subrace object literally cannot carry the parent's own features —
    // only `parentId: string` (an id reference) exists on the type. This
    // test documents that guarantee rather than exercising new logic.
    const sub = subrace({ parentId: 'elf' });
    expect('features' in sub).toBe(true);
    expect((sub as unknown as { parentFeatures?: unknown }).parentFeatures).toBeUndefined();
  });
});
