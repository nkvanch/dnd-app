// src/engine/__tests__/actionCards.test.ts
// First test coverage for this 600+ line file. Focuses on buildOutcomeLines
// (this phase's new addition — descriptive outcome-branch text, never
// auto-applied) plus baseline regression coverage for buildLayer1/2/3, which
// had zero tests before despite every action card in the app going through
// them.
import { Feature, FeatureInstance, Entity, SpellSlots, Race, Subrace } from '../types';
import {
  buildLayer1, buildLayer2, buildLayer3, buildOutcomeLines, generateActionCard,
  getTriggeredFeatures, isFeatureAvailable, isLargeCreature,
} from '../actionCards';
import { makeEmptyEntity } from '../../store/characterStore';
import { startTurn, markActionSlotUsed } from '../combat';
import { useHomebrewStore } from '../../store/homebrewStore';
import { raceSkeleton } from '../../content/races';

function makeFeature(overrides: Partial<Feature> = {}): Feature {
  return {
    id: 'test_feature',
    name: 'Test Feature',
    description: '',
    source: { kind: 'class', refId: 'fighter' },
    level: 1,
    effects: [],
    actions: [],
    choices: [],
    passive: false,
    activation: {
      actionType: 'action',
      resourceCost: null,
      range: null,
      target: 'single',
      requiresSave: null,
    },
    abilityEffects: [],
    ...overrides,
  };
}

describe('buildLayer1', () => {
  it('combines source label, action type, and card type', () => {
    const f = makeFeature();
    expect(buildLayer1(f, 'damage')).toBe('Class • Action • Damage');
  });

  it('falls back to a generic label when there is no activation', () => {
    const f = makeFeature({ activation: undefined });
    expect(buildLayer1(f, 'utility')).toBe('Feature • Utility');
  });
});

describe('buildLayer2', () => {
  it('renders a damage effect as dice + damage type', () => {
    const f = makeFeature({
      abilityEffects: [{ type: 'damage', dice: '2d6', damageType: 'fire' }],
    });
    expect(buildLayer2(f)).toBe('2d6 Fire');
  });

  it('appends range when set and not "self"', () => {
    const f = makeFeature({
      abilityEffects: [{ type: 'heal', dice: '1d8' }],
      activation: {
        actionType: 'action', resourceCost: null, range: '30 feet',
        target: 'single', requiresSave: null,
      },
    });
    expect(buildLayer2(f)).toBe('Heal 1d8 • Range 30 feet');
  });

  it('falls back to a slice of the description when there are no effects', () => {
    const f = makeFeature({ description: 'A purely narrative feature with no mechanical effect.' });
    expect(buildLayer2(f)).toBe('A purely narrative feature with no mechanical effect.'.slice(0, 60));
  });
});

describe('buildLayer3', () => {
  it('renders an ability save with a numeric DC and half-damage note', () => {
    const f = makeFeature({
      abilityEffects: [{ type: 'damage', dice: '2d6', damageType: 'fire', saveOnSuccess: 'half' }],
      activation: {
        actionType: 'action', resourceCost: null, range: null, target: 'area',
        requiresSave: { ability: 'dex', dc: 15 },
      },
    });
    expect(buildLayer3(f)).toBe('DEX Save vs DC 15 (half)');
  });

  it('returns null when there is nothing to show', () => {
    expect(buildLayer3(makeFeature())).toBeNull();
  });
});

describe('buildOutcomeLines', () => {
  it('returns an empty array when the feature has no outcomes', () => {
    expect(buildOutcomeLines(makeFeature())).toEqual([]);
  });

  it('renders a description-only outcome', () => {
    const f = makeFeature({
      outcomes: { hit: { description: 'The target is knocked prone.' } },
    });
    expect(buildOutcomeLines(f)).toEqual(['On hit: The target is knocked prone.']);
  });

  it('renders effects using the same wording buildLayer2 uses for set_flag/restore_resource', () => {
    const f = makeFeature({
      outcomes: {
        hit:  { effects: [{ type: 'set_flag', flag: 'stunned_until_next_turn', value: true }] },
        miss: { effects: [{ type: 'restore_resource', resourceId: 'ki_points', amount: 1 }] },
      },
    });
    expect(buildOutcomeLines(f)).toEqual([
      'On hit: Stunned until next turn',
      'On miss: +1 ki points',
    ]);
  });

  it('renders a transform effect (buildLayer2 has no line-formatting for this one)', () => {
    const f = makeFeature({
      outcomes: { success: { effects: [{ type: 'transform', formId: 'wolf_form' }] } },
    });
    expect(buildOutcomeLines(f)).toEqual(['On success: Transform into wolf form']);
  });

  it('combines description and effects when both are present', () => {
    const f = makeFeature({
      outcomes: {
        failure: {
          description: 'You stumble.',
          effects: [{ type: 'restore_resource', resourceId: 'action_surge', amount: 'full' }],
        },
      },
    });
    expect(buildOutcomeLines(f)).toEqual(['On failure: You stumble. (Full action surge)']);
  });

  it('orders lines hit, miss, success, failure regardless of insertion order', () => {
    const f = makeFeature({
      outcomes: {
        failure: { description: 'd' },
        hit:     { description: 'a' },
        success: { description: 'c' },
        miss:    { description: 'b' },
      },
    });
    expect(buildOutcomeLines(f)).toEqual([
      'On hit: a', 'On miss: b', 'On success: c', 'On failure: d',
    ]);
  });

  it('skips an outcome entry that has neither description nor a renderable effect', () => {
    const f = makeFeature({
      outcomes: {
        hit: {}, // present but empty — nothing to show
        miss: { effects: [{ type: 'damage', dice: '1d4', damageType: 'force' }] }, // buildOutcomeLines doesn't render damage
      },
    });
    expect(buildOutcomeLines(f)).toEqual([]);
  });
});

describe('generateActionCard — outcomes wiring', () => {
  const entity = makeEmptyEntity('e1');

  it('returns null for a passive feature with no activation', () => {
    const f = makeFeature({ activation: undefined });
    expect(generateActionCard(f, entity)).toBeNull();
  });

  it('populates card.outcomes from the feature\'s outcomes map', () => {
    const f = makeFeature({
      outcomes: { hit: { description: 'Extra effect on a hit.' } },
    });
    const card = generateActionCard(f, entity);
    expect(card?.outcomes).toEqual(['On hit: Extra effect on a hit.']);
  });

  it('defaults to an empty outcomes array when the feature has none', () => {
    const card = generateActionCard(makeFeature(), entity);
    expect(card?.outcomes).toEqual([]);
  });
});

describe('generateActionCard — triggerNote wiring', () => {
  const entity = makeEmptyEntity('e1');

  it('populates card.triggerNote when the feature has both trigger and activation', () => {
    const f = makeFeature({ trigger: 'When you are hit by an attack.' });
    const card = generateActionCard(f, entity);
    expect(card?.triggerNote).toBe('When you are hit by an attack.');
  });

  it('defaults triggerNote to null when the feature has no trigger', () => {
    const card = generateActionCard(makeFeature(), entity);
    expect(card?.triggerNote).toBeNull();
  });

  it('still returns null for a trigger-only feature with no activation — never synthesizes a fake one', () => {
    const f = makeFeature({ activation: undefined, trigger: 'Once per turn, on a hit with advantage.' });
    expect(generateActionCard(f, entity)).toBeNull();
  });
});

function makeFeatureInstance(overrides: Partial<FeatureInstance> = {}): FeatureInstance {
  return { ...makeFeature(), isActive: true, ...overrides };
}

function entityWithFeatures(features: FeatureInstance[], level = 1): Entity {
  const e = makeEmptyEntity('e1');
  return { ...e, identity: { ...e.identity, level }, features };
}

describe('getTriggeredFeatures', () => {
  it('includes an active feature with a trigger and no level restriction', () => {
    const sneakAttack = makeFeatureInstance({
      id: 'sneak_attack', activation: undefined, level: null,
      trigger: 'Once per turn, on a hit with advantage or an ally within 5 ft.',
    });
    const entity = entityWithFeatures([sneakAttack]);
    expect(getTriggeredFeatures(entity).map(f => f.id)).toEqual(['sneak_attack']);
  });

  it('excludes an inactive feature', () => {
    const f = makeFeatureInstance({ isActive: false, trigger: 'Something.' });
    expect(getTriggeredFeatures(entityWithFeatures([f]))).toEqual([]);
  });

  it('excludes a feature with no trigger', () => {
    const f = makeFeatureInstance({ trigger: undefined });
    expect(getTriggeredFeatures(entityWithFeatures([f]))).toEqual([]);
  });

  it('excludes a feature gated to a level higher than the entity\'s current level', () => {
    const f = makeFeatureInstance({ level: 5, trigger: 'Something.' });
    const entity = entityWithFeatures([f], 3);
    expect(getTriggeredFeatures(entity)).toEqual([]);
  });

  it('includes a feature gated to a level at or below the entity\'s current level', () => {
    const f = makeFeatureInstance({ id: 'uncanny_dodge', level: 5, trigger: 'When hit by an attack you can see.' });
    const entity = entityWithFeatures([f], 5);
    expect(getTriggeredFeatures(entity).map(x => x.id)).toEqual(['uncanny_dodge']);
  });
});

function fullSlots(): SpellSlots {
  const tiers = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
  const slots = {} as SpellSlots;
  for (const t of tiers) slots[t] = { total: 2, used: 2 };
  return slots;
}

describe('isFeatureAvailable — turn economy applies even to a cost-less feature (A-59 audit fix)', () => {
  // generateSpellCard (a cantrip has resourceCost: null) relies on this:
  // the economy check must run BEFORE the "no cost → available" shortcut,
  // not be skipped whenever there's no cost to check. This was previously
  // broken one level up — the caller skipped calling isFeatureAvailable at
  // all when cost was falsy — but pinning the invariant here locks in the
  // fix regardless of which caller relies on it.
  it('is unavailable when the matching action-economy slot is already used, even with no resource cost', () => {
    const f = makeFeature({ activation: { actionType: 'action', resourceCost: null, range: null, target: 'single', requiresSave: null } });
    let entity = startTurn(makeEmptyEntity('e1'));
    entity = markActionSlotUsed(entity, 'action');
    const result = isFeatureAvailable(f, entity);
    expect(result.available).toBe(false);
    expect(result.reason).toMatch(/already used your action/i);
  });

  it('is available when the matching slot is unused and there is no resource cost', () => {
    const f = makeFeature({ activation: { actionType: 'action', resourceCost: null, range: null, target: 'single', requiresSave: null } });
    const entity = startTurn(makeEmptyEntity('e1'));
    expect(isFeatureAvailable(f, entity)).toEqual({ available: true, reason: null });
  });
});

describe('isFeatureAvailable — spell slots (pactSlots bug fix)', () => {
  function casterWithSlots(overrides: { slots?: Record<string, { total: number; used: number }>; pactSlots?: Record<string, { total: number; used: number }> }) {
    const base = makeEmptyEntity('e1');
    return {
      ...base,
      spellcasting: {
        ability: 'cha' as const,
        slots: { ...fullSlots(), ...overrides.slots },
        pactSlots: overrides.pactSlots ? { ...fullSlots(), ...overrides.pactSlots } : undefined,
        cantrips: [], known: [], prepared: [], concentrating: null,
      },
    };
  }

  const spellFeature = (tier: number) => makeFeature({
    activation: { actionType: 'action', resourceCost: { resourceId: 'spell_slots', quantity: 1, spellSlotTier: tier as 1 }, range: null, target: 'single', requiresSave: null },
  });

  it('is available from a regular slot when one is free', () => {
    const entity = casterWithSlots({ slots: { '1': { total: 2, used: 1 } } });
    expect(isFeatureAvailable(spellFeature(1), entity)).toEqual({ available: true, reason: null });
  });

  it('bug: is available from pactSlots when regular slots are exhausted but a pact slot is free', () => {
    const entity = casterWithSlots({
      slots: { '1': { total: 2, used: 2 } }, // fully spent regular pool
      pactSlots: { '1': { total: 1, used: 0 } }, // untouched pact pool
    });
    expect(isFeatureAvailable(spellFeature(1), entity)).toEqual({ available: true, reason: null });
  });

  it('is unavailable when both regular slots and pactSlots at/above the tier are exhausted', () => {
    const entity = casterWithSlots({
      slots: { '1': { total: 2, used: 2 } },
      pactSlots: { '1': { total: 1, used: 1 } },
    });
    const result = isFeatureAvailable(spellFeature(1), entity);
    expect(result.available).toBe(false);
    expect(result.reason).toMatch(/no spell slots/i);
  });

  it('is unavailable when there are no pactSlots at all and regular slots are exhausted', () => {
    const entity = casterWithSlots({ slots: { '1': { total: 2, used: 2 } } });
    expect(isFeatureAvailable(spellFeature(1), entity).available).toBe(false);
  });
});

describe('isLargeCreature — reads Race.size/Subrace.size content instead of a hardcoded id allowlist (architecture review E6)', () => {
  afterEach(() => {
    useHomebrewStore.setState({ races: [] });
  });

  function entityWithRace(raceId: string, subRaceId: string | null = null): Entity {
    const e = makeEmptyEntity('e1');
    return { ...e, identity: { ...e.identity, raceId, subRaceId } };
  }

  it('is false for a Medium official race (Human)', () => {
    expect(isLargeCreature(entityWithRace('human'))).toBe(false);
  });

  it('is true for the "Giant" skeleton subrace, tagged size:Large as part of this fix', () => {
    // raceSkeleton is intentionally not in the default library (content-
    // honesty — see its own comment), but it's real, existing content a
    // homebrew pack can surface; seed it directly to prove the size:'Large'
    // tag this fix added to its skeleton_giant subrace is actually read.
    useHomebrewStore.setState({ races: [raceSkeleton] });
    expect(isLargeCreature(entityWithRace('skeleton', 'skeleton_giant'))).toBe(true);
    expect(isLargeCreature(entityWithRace('skeleton'))).toBe(false); // base Skeleton race is Medium
  });

  it('is true for a brand-new homebrew Large race — no allowlist edit required', () => {
    const homebrewOgrish: Race = { id: 'ogrish', name: 'Ogrish', size: 'Large', features: [] };
    useHomebrewStore.setState({ races: [homebrewOgrish] });
    expect(isLargeCreature(entityWithRace('ogrish'))).toBe(true);
  });

  it('a Large-race subrace can override back down to Medium', () => {
    const smallSubrace: Subrace = { id: 'ogrish_runt', name: 'Runt', parentId: 'ogrish', size: 'Medium', features: [] };
    const homebrewOgrish: Race = { id: 'ogrish', name: 'Ogrish', size: 'Large', features: [], subraces: [smallSubrace] };
    useHomebrewStore.setState({ races: [homebrewOgrish] });
    expect(isLargeCreature(entityWithRace('ogrish', 'ogrish_runt'))).toBe(false);
    expect(isLargeCreature(entityWithRace('ogrish'))).toBe(true); // base race, no subrace picked
  });

  it('falls back to the skeleton_giant_remains feature marker when race content can\'t be resolved (e.g. a stale/deleted homebrew race)', () => {
    const e = makeEmptyEntity('e1');
    const entity: Entity = {
      ...e,
      identity: { ...e.identity, raceId: 'deleted_homebrew_race', subRaceId: null },
      features: [{
        id: 'skeleton_giant_remains', name: 'Giant Remains', description: '', source: { kind: 'race', refId: 'x' },
        level: null, effects: [], actions: [], choices: [], passive: true, isActive: true,
      }],
    };
    expect(isLargeCreature(entity)).toBe(true);
  });
});
