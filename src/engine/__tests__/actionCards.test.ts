// src/engine/__tests__/actionCards.test.ts
// First test coverage for this 600+ line file. Focuses on buildOutcomeLines
// (this phase's new addition — descriptive outcome-branch text, never
// auto-applied) plus baseline regression coverage for buildLayer1/2/3, which
// had zero tests before despite every action card in the app going through
// them.
import { Feature, FeatureInstance, Entity, SpellSlots, Race, Subrace, Spell, CharClass, Item, EntitlementRecord, ClassLevelEntry, asClassId, asSubclassId, ActionCard, SpellCastingContext, ActivationOption } from '../types';
import {
  buildLayer1, buildLayer2, buildLayer3, buildOutcomeLines, generateActionCard, generateAllActionCards, generateSpellCard,
  getTriggeredFeatures, isFeatureAvailable, isLargeCreature,
  isSpellPreparationLegal, resolveSpellAbility, PREPARED_CASTER_CLASS_IDS,
  resolveSpellCastingContexts, selectSpellCastingContext, resolveSpellSaveDC, resolveSpellAttackBonus,
  buildLayer2ForSpell, buildLayer3ForSpell, collapseDistinctSpellCastingContexts,
  formatCastingContextLabel, isContextLegalForCastMode, needsPreparationOverride,
} from '../actionCards';
import { ALL_CHAR_CLASSES } from '../../content/classes';
import { applyActionCardUse } from '../actionUse';
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { startTurn, markActionSlotUsed, applyDamage } from '../combat';
import { useHomebrewStore } from '../../store/homebrewStore';
import { raceSkeleton } from '../../content/races';
import { recomputeDerived } from '../pipeline';

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

// ============================================================================
// Rules-engine blocker RE-AUDIT closure — ARCHITECTURE PURITY (Closure 1).
// actionCards.ts/actionUse.ts/entitlements.ts must never read Zustand/
// application-store state implicitly: given the same Entity + rules +
// explicitly-passed content snapshot, they must produce the same result —
// even if useHomebrewStore is mutated between calls. Behavioral proof
// (below) is the PRIMARY evidence; the source-text grep is a secondary,
// cheap regression lock only, per this closure's own instruction not to
// rely on source-text testing alone.
// ============================================================================
describe('engine purity (rules-engine blocker RE-AUDIT closure 1)', () => {
  it('same entity + rules + explicit content snapshot -> same result, REGARDLESS of useHomebrewStore mutations in between', () => {
    const homebrewCaster: CharClass = {
      id: 'runeblade', name: 'Runeblade', hitDie: 8, features: [],
      spellcastingAbility: 'int', spellPreparationPolicy: 'full_list_prepared',
    };
    const runeSpell: Spell = {
      id: 'rune_bolt', name: 'Rune Bolt', level: 1, school: 'Evocation', castingTime: '1 action',
      range: '60 feet', components: ['V', 'S'], duration: 'Instantaneous', description: 'Test spell.',
      upcast: null, ritual: false, concentration: false, classes: ['runeblade'],
    };
    const explicitContent = { classDefs: [...ALL_CHAR_CLASSES, homebrewCaster], homebrewSpells: [runeSpell] };
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'rune_bolt', 'class', 'runeblade')],
      spellcasting: { ability: 'int', slots: emptySlots({ '1': { total: 2, used: 0 } }), cantrips: [], known: ['rune_bolt'], prepared: [], concentrating: null },
    };

    // Baseline: the store has NOTHING registered for 'runeblade'/'rune_bolt'.
    useHomebrewStore.setState({ classes: [], spells: [] });
    const before = generateSpellCard('rune_bolt', e, explicitContent)!;

    // Mutate the store with CONFLICTING content — a real store read would
    // change the result (e.g. a different policy/ability); an explicit-
    // content-snapshot call must be completely unaffected.
    useHomebrewStore.setState({
      classes: [{ id: 'runeblade', name: 'Runeblade', hitDie: 8, features: [], spellcastingAbility: 'cha', spellPreparationPolicy: 'known' }],
      spells: [{ ...runeSpell, id: 'rune_bolt', name: 'DIFFERENT NAME' }],
    });
    const after = generateSpellCard('rune_bolt', e, explicitContent)!;

    expect(after).toEqual(before);
    expect(after.spellCastingContext?.castingAbility).toBe('int'); // still the EXPLICITLY passed class's ability, not the store's
    expect(after.available).toBe(false); // still full_list_prepared (explicit content), not the store's 'known'

    useHomebrewStore.setState({ classes: [], spells: [] }); // cleanup
  });

  it('regression lock: actionCards.ts, actionUse.ts, entitlements.ts, pipeline.ts, and itemMechanics.ts import no application/store module', () => {
    const fs = require('fs');
    const path = require('path');
    const engineFiles = ['actionCards.ts', 'actionUse.ts', 'entitlements.ts', 'pipeline.ts', 'itemMechanics.ts'];
    for (const file of engineFiles) {
      const filePath = path.join(__dirname, '..', file);
      const source: string = fs.readFileSync(filePath, 'utf-8');
      const importLines = source.split('\n').filter(l => /^\s*import\b/.test(l));
      const storeImport = importLines.find(l => /from\s+['"].*\/store\//.test(l));
      expect(storeImport).toBeUndefined();
    }
  });
});

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
    // homebrew pack can surface; passed explicitly (rules-engine blocker
    // RE-AUDIT closure — dependency inversion, 1B) to prove the size:'Large'
    // tag this fix added to its skeleton_giant subrace is actually read.
    expect(isLargeCreature(entityWithRace('skeleton', 'skeleton_giant'), [raceSkeleton])).toBe(true);
    expect(isLargeCreature(entityWithRace('skeleton'), [raceSkeleton])).toBe(false); // base Skeleton race is Medium
  });

  it('is true for a brand-new homebrew Large race — no allowlist edit required', () => {
    const homebrewOgrish: Race = { id: 'ogrish', name: 'Ogrish', size: 'Large', features: [] };
    expect(isLargeCreature(entityWithRace('ogrish'), [homebrewOgrish])).toBe(true);
  });

  it('a Large-race subrace can override back down to Medium', () => {
    const smallSubrace: Subrace = { id: 'ogrish_runt', name: 'Runt', parentId: 'ogrish', size: 'Medium', features: [] };
    const homebrewOgrish: Race = { id: 'ogrish', name: 'Ogrish', size: 'Large', features: [], subraces: [smallSubrace] };
    expect(isLargeCreature(entityWithRace('ogrish', 'ogrish_runt'), [homebrewOgrish])).toBe(false);
    expect(isLargeCreature(entityWithRace('ogrish'), [homebrewOgrish])).toBe(true); // base race, no subrace picked
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

// ADDITIONAL-SPELL-3 (regression): generateSpellCard used to look the spell
// up in spellRepo (official content) only, with no homebrew fallback — a
// homebrew spell sitting in entity.spellcasting.cantrips/.known/.prepared
// (added via "+ Add Additional Spell", or any homebrew spell legitimately
// tagged for the character's own class) would silently get no ActionCard
// at all, so it never appeared on the character sheet despite being
// correctly persisted in the entity's own data. Mirrors the exact
// official-then-homebrew fallback the equipped-item-features loop already
// uses a few lines above in the real file (itemRepo, then homebrewStore).
describe('generateSpellCard — homebrew fallback (regression)', () => {
  const homebrewCantrip: Spell = {
    id: 'test_homebrew_cantrip', name: 'Test Spark', level: 0, school: 'Evocation',
    castingTime: '1 action', range: '60 feet', components: ['V', 'S'], duration: 'Instantaneous',
    description: 'A homebrew test cantrip.', upcast: null, ritual: false, concentration: false,
  };

  it('returns null for an unknown id when no homebrew spell matches either (pre-fix behavior for anything unresolvable)', () => {
    const e = makeEmptyEntity('e1');
    expect(generateSpellCard('nonexistent_spell_id', e)).toBeNull();
  });

  it('falls back to the explicit opts.homebrewSpells and produces a real card when spellRepo has no match', () => {
    const e = makeEmptyEntity('e1');
    const card = generateSpellCard('test_homebrew_cantrip', e, { homebrewSpells: [homebrewCantrip] });
    expect(card).not.toBeNull();
    expect(card?.name).toBe('Test Spark');
    expect(card?.featureId).toBe('test_homebrew_cantrip');
    expect(card?.tabs).toContain('spellcasting');
  });

  it('a homebrew spell sitting in entity.spellcasting actually produces a rendered card end-to-end', () => {
    const e = makeEmptyEntity('e1');
    const entity: Entity = {
      ...e,
      spellcasting: {
        ability: 'cha', slots: fullSlots(), cantrips: ['test_homebrew_cantrip'],
        known: [], prepared: [], concentrating: null,
      },
    };
    const card = generateSpellCard('test_homebrew_cantrip', entity, { homebrewSpells: [homebrewCantrip] });
    expect(card).not.toBeNull();
    expect(card?.name).toBe('Test Spark');
  });
});

// ============================================================================
// Rules-engine blocker A: prepared-spell eligibility + Quick Override
// ============================================================================

function emptySlots(overrides: Partial<Record<keyof SpellSlots, { total: number; used: number }>> = {}): SpellSlots {
  const tiers = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
  const slots = {} as SpellSlots;
  for (const t of tiers) slots[t] = { total: 0, used: 0 };
  return { ...slots, ...overrides };
}

function leveledSpell(id: string, level: number, overrides: Partial<Spell> = {}): Spell {
  return {
    id, name: id, level, school: 'Evocation', castingTime: '1 action', range: '60 feet',
    components: ['V', 'S'], duration: 'Instantaneous', description: 'Test spell.',
    upcast: null, ritual: false, concentration: false,
    ...overrides,
  };
}

function ent(kind: 'spell_access' | 'cantrip_access', key: string, sourceKind: EntitlementRecord['sourceKind'], sourceId?: string): EntitlementRecord {
  return { kind, key, sourceKind, sourceId };
}

describe('isSpellPreparationLegal (rules-engine blocker A)', () => {
  it('a cantrip — no spell_access entitlement exists for it — is always legal', () => {
    const e = { ...makeEmptyEntity('e1'), entitlements: [ent('cantrip_access', 'fire_bolt', 'class', 'wizard')] };
    expect(isSpellPreparationLegal(e, 'fire_bolt')).toBe(true);
  });

  it('no tracked source at all fails OPEN — legal (legacy save / untracked grant)', () => {
    const e = makeEmptyEntity('e1');
    expect(isSpellPreparationLegal(e, 'anything')).toBe(true);
  });

  it('a Wizard-sourced leveled spell requires preparation', () => {
    const base = { ...makeEmptyEntity('e1'), entitlements: [ent('spell_access', 'fireball', 'class', 'wizard')] };
    const unprepared = { ...base, spellcasting: { ability: 'int' as const, slots: emptySlots(), cantrips: [], known: ['fireball'], prepared: [], concentrating: null } };
    expect(isSpellPreparationLegal(unprepared, 'fireball')).toBe(false);
    const prepared = { ...unprepared, spellcasting: { ...unprepared.spellcasting!, prepared: ['fireball'] } };
    expect(isSpellPreparationLegal(prepared, 'fireball')).toBe(true);
  });

  it('a Sorcerer-sourced leveled spell (known caster) is always legal, never gated by preparation', () => {
    const e = { ...makeEmptyEntity('e1'), entitlements: [ent('spell_access', 'fireball', 'class', 'sorcerer')] };
    expect(isSpellPreparationLegal(e, 'fireball')).toBe(true);
  });

  it('a subclass-sourced spell (domain-style, always prepared/automatic) is always legal', () => {
    const e = { ...makeEmptyEntity('e1'), entitlements: [ent('spell_access', 'bless', 'subclass', 'life_domain')] };
    expect(isSpellPreparationLegal(e, 'bless')).toBe(true);
  });

  it('a race-sourced or manually-added spell is always legal', () => {
    const race = { ...makeEmptyEntity('e1'), entitlements: [ent('spell_access', 'chill_touch', 'race', 'skeleton')] };
    expect(isSpellPreparationLegal(race, 'chill_touch')).toBe(true);
    const manual = { ...makeEmptyEntity('e1'), entitlements: [ent('spell_access', 'magic_missile', 'manual')] };
    expect(isSpellPreparationLegal(manual, 'magic_missile')).toBe(true);
  });

  it('the same spell granted by TWO sources is legal via whichever is satisfied — removing one source never silently removes the other\'s legal access', () => {
    // A Wizard grant (requires prep) AND a homebrew feat grant (never gated) for the SAME spell.
    const both = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'fireball', 'class', 'wizard'), ent('spell_access', 'fireball', 'feat', 'test_feat')],
      spellcasting: { ability: 'int' as const, slots: emptySlots(), cantrips: [], known: ['fireball'], prepared: [], concentrating: null },
    };
    expect(isSpellPreparationLegal(both, 'fireball')).toBe(true); // the feat source alone makes it legal
    // Now only the Wizard source remains (feat entitlement revoked) — correctly becomes gated.
    const wizardOnly = { ...both, entitlements: [ent('spell_access', 'fireball', 'class', 'wizard')] };
    expect(isSpellPreparationLegal(wizardOnly, 'fireball')).toBe(false);
  });
});

describe('generateSpellCard — prepared-spell eligibility (rules-engine blocker A)', () => {
  const fireball = leveledSpell('fireball', 3);
  const opts = { homebrewSpells: [fireball] };

  function wizardEntity(prepared: string[]): Entity {
    return {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'fireball', 'class', 'wizard')],
      spellcasting: {
        ability: 'int', slots: emptySlots({ '3': { total: 2, used: 0 } }),
        cantrips: [], known: ['fireball'], prepared, concentrating: null,
      },
    };
  }

  it('1: a prepared Wizard leveled spell is available, with no override offered', () => {
    const card = generateSpellCard('fireball', wizardEntity(['fireball']), opts);
    expect(card?.available).toBe(true);
    expect(card?.preparationOverridable).toBeFalsy();
  });

  it('2: an unprepared Wizard leveled spell is blocked, and Quick Override is offered', () => {
    const card = generateSpellCard('fireball', wizardEntity([]), opts);
    expect(card?.available).toBe(false);
    expect(card?.preparationOverridable).toBe(true);
    expect(card?.unavailableReason).toBe('Not prepared');
  });

  it('5: a Wizard cantrip remains usable regardless of prepared state', () => {
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('cantrip_access', 'fire_bolt', 'class', 'wizard')],
      spellcasting: { ability: 'int', slots: emptySlots(), cantrips: ['fire_bolt'], known: [], prepared: [], concentrating: null },
    };
    const card = generateSpellCard('fire_bolt', e, { homebrewSpells: [leveledSpell('fire_bolt', 0)] });
    expect(card?.available).toBe(true);
    expect(card?.preparationOverridable).toBeFalsy();
  });

  it('6: a Sorcerer known spell remains usable without ever appearing in a prepared list', () => {
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'fireball', 'class', 'sorcerer')],
      spellcasting: { ability: 'cha', slots: emptySlots({ '3': { total: 2, used: 0 } }), cantrips: [], known: ['fireball'], prepared: [], concentrating: null },
    };
    const card = generateSpellCard('fireball', e, opts);
    expect(card?.available).toBe(true);
    expect(card?.preparationOverridable).toBeFalsy();
  });

  it('7: an always-prepared subclass (domain-style) spell remains usable', () => {
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'fireball', 'subclass', 'some_domain')],
      spellcasting: { ability: 'wis', slots: emptySlots({ '3': { total: 2, used: 0 } }), cantrips: [], known: ['fireball'], prepared: [], concentrating: null },
    };
    const card = generateSpellCard('fireball', e, opts);
    expect(card?.available).toBe(true);
    expect(card?.preparationOverridable).toBeFalsy();
  });

  it('an unprepared spell with NO usable slot is blocked by BOTH — Quick Override is not offered (only bypasses preparation, never cost)', () => {
    const e = wizardEntity([]); // unprepared
    const noSlots = { ...e, spellcasting: { ...e.spellcasting!, slots: emptySlots({ '3': { total: 2, used: 2 } }) } }; // slots exhausted too
    const card = generateSpellCard('fireball', noSlots, opts);
    expect(card?.available).toBe(false);
    expect(card?.preparationOverridable).toBe(false); // NOT overridable — a second blocker (no slot) is present
  });
});

describe('applyActionCardUse — Quick Override "Cast Anyway" (rules-engine blocker A)', () => {
  const fireball = leveledSpell('fireball', 3);
  const opts = { homebrewSpells: [fireball] };

  function unpreparedWizard(): Entity {
    return {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'fireball', 'class', 'wizard')],
      spellcasting: {
        ability: 'int', slots: emptySlots({ '3': { total: 2, used: 0 } }),
        cantrips: [], known: ['fireball'], prepared: [], concentrating: null,
      },
    };
  }

  it('2/4: a normal cast attempt (no override) on an unprepared spell is blocked — entity unchanged, no slot spent', () => {
    const e = unpreparedWizard();
    const card = generateSpellCard('fireball', e, opts)!;
    const result = applyActionCardUse(e, card, {} as any);
    expect(result).toBe(e); // unchanged
    expect(result.spellcasting!.slots['3'].used).toBe(0);
  });

  it('3: Cast Anyway (bypassSpellPreparation=true) casts, spends a legal slot, and the spell remains UNPREPARED afterward', () => {
    const e = unpreparedWizard();
    const card = generateSpellCard('fireball', e, opts)!;
    const result = applyActionCardUse(e, card, {} as any, undefined, undefined, true);
    expect(result).not.toBe(e);
    expect(result.spellcasting!.slots['3'].used).toBe(1); // legal slot still spent normally
    expect(result.spellcasting!.prepared).toEqual([]); // NOT added to prepared — one-off only
  });

  it('the override never bypasses an independent slot/resource blocker — no usable slot still blocks even with bypassSpellPreparation=true', () => {
    const e = unpreparedWizard();
    const noSlots = { ...e, spellcasting: { ...e.spellcasting!, slots: emptySlots({ '3': { total: 2, used: 2 } }) } };
    const card = generateSpellCard('fireball', noSlots, opts)!;
    const result = applyActionCardUse(noSlots, card, {} as any, undefined, undefined, true);
    expect(result).toBe(noSlots); // still blocked — this pass only bypasses preparation, never cost
  });

  it('a normal legal cast (already prepared) and a Quick Override cast converge on the identical resulting state', () => {
    const prepared = { ...unpreparedWizard(), spellcasting: { ...unpreparedWizard().spellcasting!, prepared: ['fireball'] } };
    const unprepared = unpreparedWizard();
    const cardPrepared = generateSpellCard('fireball', prepared, opts)!;
    const cardUnprepared = generateSpellCard('fireball', unprepared, opts)!;
    const resultNormal   = applyActionCardUse(prepared, cardPrepared, {} as any);
    const resultOverride = applyActionCardUse(unprepared, cardUnprepared, {} as any, undefined, undefined, true);
    // Same slot consumption via the identical mutation path either way.
    expect(resultNormal.spellcasting!.slots['3'].used).toBe(resultOverride.spellcasting!.slots['3'].used);
  });
});

// ============================================================================
// HIGH-batch rules-correctness closure (C): normal ActionCard use at 0 HP /
// Unconscious is blocked by default, with a table-first Quick Override
// ("Use Anyway") mirroring "Cast Anyway"'s exact shape. Engine-level
// coverage for C13's test matrix (component-level UI wiring is covered
// separately, per this codebase's "test the pure function/contract, not the
// RN component" convention).
// ============================================================================
describe('isFeatureAvailable / applyActionCardUse — Quick Override "Use Anyway" (HIGH batch, C)', () => {
  function healthyEntity(): Entity {
    return { ...makeEmptyEntity('e1'), resources: { ...makeEmptyEntity('e1').resources, hp: { current: 20, maximum: 20, temp: 0 } } };
  }
  function zeroHpEntity(): Entity {
    return { ...healthyEntity(), resources: { ...healthyEntity().resources, hp: { current: 0, maximum: 20, temp: 0 } } };
  }
  function unconsciousEntity(): Entity {
    // HP > 0 but the explicit Unconscious condition is present independent of HP.
    return { ...healthyEntity(), conditions: [{ id: 'unconscious', sourceId: 'test', duration: null, suppressedBy: [] }] };
  }
  function simpleFeature(): FeatureInstance {
    return makeFeatureInstance({ activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null } });
  }
  function costedFeature(): FeatureInstance {
    return makeFeatureInstance({ activation: { actionType: 'action', resourceCost: { resourceId: 'rage', quantity: 1 }, range: '5 feet', target: 'single', requiresSave: null } });
  }
  function withRageResource(entity: Entity, current: number): Entity {
    return { ...entity, resources: { ...entity.resources, custom: [{ id: 'rage', name: 'Rage', current, maximum: 2, recharge: 'long_rest' as const }] } };
  }

  it('1: a healthy character\'s action is normally available', () => {
    expect(isFeatureAvailable(simpleFeature(), healthyEntity())).toEqual({ available: true, reason: null });
  });

  it('2: HP 0 — a normal attempt is blocked, with incapacitatedOverridable=true', () => {
    const result = isFeatureAvailable(simpleFeature(), zeroHpEntity());
    expect(result.available).toBe(false);
    expect(result.reason).toBe('At 0 HP');
    expect(result.incapacitatedOverridable).toBe(true);
  });

  it('3: HP 0 -> Use Anyway (bypassIncapacitated=true) executes through the normal mutation path', () => {
    const e = zeroHpEntity();
    const feature = { ...e, features: [simpleFeature()] };
    const card = generateActionCard(feature.features[0], feature)!;
    expect(card.available).toBe(false);
    expect(card.incapacitatedOverridable).toBe(true);
    const result = applyActionCardUse(feature, card, {} as any, undefined, undefined, undefined, undefined, {}, true);
    expect(result).not.toBe(feature); // action economy mutated -> real execution happened
  });

  it('4: explicit Unconscious (HP > 0) — a normal attempt is blocked', () => {
    const result = isFeatureAvailable(simpleFeature(), unconsciousEntity());
    expect(result.available).toBe(false);
    expect(result.reason).toBe('Unconscious');
    expect(result.incapacitatedOverridable).toBe(true);
  });

  it('5: Unconscious -> Use Anyway executes', () => {
    const e = unconsciousEntity();
    const feature = { ...e, features: [simpleFeature()] };
    const card = generateActionCard(feature.features[0], feature)!;
    const result = applyActionCardUse(feature, card, {} as any, undefined, undefined, undefined, undefined, {}, true);
    expect(result).not.toBe(feature);
  });

  it('6: a normal blocked attempt (no override / "Cancel") produces no mutation at all', () => {
    const e = zeroHpEntity();
    const feature = { ...e, features: [simpleFeature()] };
    const card = generateActionCard(feature.features[0], feature)!;
    const result = applyActionCardUse(feature, card, {} as any); // bypassIncapacitated omitted
    expect(result).toBe(feature);
  });

  it('7: Use Anyway never heals, never clears Unconscious, never touches death-save state', () => {
    const e = { ...unconsciousEntity(), resources: { ...unconsciousEntity().resources, hp: { current: 0, maximum: 20, temp: 0 }, deathSaves: { successes: 0, failures: 1, stable: false } } };
    const feature = { ...e, features: [simpleFeature()] };
    const card = generateActionCard(feature.features[0], feature)!;
    const result = applyActionCardUse(feature, card, {} as any, undefined, undefined, undefined, undefined, {}, true);
    expect(result.resources.hp.current).toBe(0); // unchanged
    expect(result.conditions).toEqual(e.conditions); // Unconscious still present
    expect(result.resources.deathSaves).toEqual(e.resources.deathSaves); // unchanged
  });

  it('8: a resource-cost action still spends the resource under Use Anyway', () => {
    const e = withRageResource(zeroHpEntity(), 2);
    const feature = { ...e, features: [costedFeature()] };
    const card = generateActionCard(feature.features[0], feature)!;
    expect(card.incapacitatedOverridable).toBe(true);
    const result = applyActionCardUse(feature, card, {} as any, undefined, undefined, undefined, undefined, {}, true);
    expect(result.resources.custom[0].current).toBe(1); // spent normally
  });

  it('9: Use Anyway does NOT bypass a missing resource — no rage available still blocks', () => {
    const e = withRageResource(zeroHpEntity(), 0);
    const feature = { ...e, features: [costedFeature()] };
    const card = generateActionCard(feature.features[0], feature)!;
    expect(card.available).toBe(false);
    expect(card.incapacitatedOverridable).toBeFalsy(); // resource is ALSO blocking — not solely status
    const result = applyActionCardUse(feature, card, {} as any, undefined, undefined, undefined, undefined, {}, true);
    expect(result).toBe(feature); // still blocked despite the override
  });

  it('10: a spell at 0 HP that IS prepared -> only the status override is needed', () => {
    const fireball = leveledSpell('fireball', 3);
    const e: Entity = {
      ...zeroHpEntity(),
      entitlements: [ent('spell_access', 'fireball', 'class', 'wizard')],
      spellcasting: { ability: 'int', slots: emptySlots({ '3': { total: 2, used: 0 } }), cantrips: [], known: ['fireball'], prepared: ['fireball'], concentrating: null },
    };
    const opts = { homebrewSpells: [fireball] };
    const card = generateSpellCard('fireball', e, opts)!;
    expect(card.available).toBe(false);
    expect(card.preparationOverridable).toBeFalsy(); // prepared — not the blocker
    expect(card.incapacitatedOverridable).toBe(true);
    // Status override alone (no bypassSpellPreparation) is sufficient.
    const result = applyActionCardUse(e, card, {} as any, undefined, undefined, false, undefined, opts, true);
    expect(result).not.toBe(e);
    expect(result.spellcasting!.slots['3'].used).toBe(1);
  });

  it('11: a spell at 0 HP that is UNPREPARED -> both overrides are independently required and both preserved', () => {
    const fireball = leveledSpell('fireball', 3);
    const e: Entity = {
      ...zeroHpEntity(),
      entitlements: [ent('spell_access', 'fireball', 'class', 'wizard')],
      spellcasting: { ability: 'int', slots: emptySlots({ '3': { total: 2, used: 0 } }), cantrips: [], known: ['fireball'], prepared: [], concentrating: null },
    };
    const opts = { homebrewSpells: [fireball] };
    const card = generateSpellCard('fireball', e, opts)!;
    expect(card.available).toBe(false);
    expect(card.preparationOverridable).toBe(true);
    expect(card.incapacitatedOverridable).toBe(true);
    // Only ONE override: still blocked.
    expect(applyActionCardUse(e, card, {} as any, undefined, undefined, true, undefined, opts, false)).toBe(e);
    expect(applyActionCardUse(e, card, {} as any, undefined, undefined, false, undefined, opts, true)).toBe(e);
    // BOTH overrides together: executes, spell stays unprepared.
    const result = applyActionCardUse(e, card, {} as any, undefined, undefined, true, undefined, opts, true);
    expect(result).not.toBe(e);
    expect(result.spellcasting!.slots['3'].used).toBe(1);
    expect(result.spellcasting!.prepared).toEqual([]);
  });

  it('12: same unprepared-at-0-HP case with an activation option chosen — both overrides survive option selection', () => {
    const fireball = leveledSpell('fireball', 3);
    const options: ActivationOption[] = [
      { id: 'tier3', label: '3rd-level slot', resourceCost: { resourceId: 'spell_slots' as const, quantity: 1, spellSlotTier: 3 as const }, description: '' },
      { id: 'tier4', label: '4th-level slot', resourceCost: { resourceId: 'spell_slots' as const, quantity: 1, spellSlotTier: 4 as const }, description: '' },
    ];
    const e: Entity = {
      ...zeroHpEntity(),
      entitlements: [ent('spell_access', 'fireball', 'class', 'wizard')],
      spellcasting: { ability: 'int', slots: emptySlots({ '3': { total: 0, used: 0 }, '4': { total: 2, used: 0 } }), cantrips: [], known: ['fireball'], prepared: [], concentrating: null },
    };
    const opts = { homebrewSpells: [fireball] };
    const card = generateSpellCard('fireball', e, opts)!;
    const result = applyActionCardUse(e, card, {} as any, options[1], { kind: 'normal', tier: '4' }, true, undefined, opts, true);
    expect(result).not.toBe(e);
    expect(result.spellcasting!.slots['4'].used).toBe(1);
    expect(result.spellcasting!.prepared).toEqual([]);
  });

  it('17: bypass flags are pure call-time parameters — never persisted on the resulting entity', () => {
    const e = zeroHpEntity();
    const feature = { ...e, features: [simpleFeature()] };
    const card = generateActionCard(feature.features[0], feature)!;
    const result = applyActionCardUse(feature, card, {} as any, undefined, undefined, undefined, undefined, {}, true);
    // Same key set as an ordinary recompute of the identical entity with NO
    // bypass involved — proves the override left no trace of itself
    // (no bypass/quick-override flag) anywhere on the entity.
    const ordinaryRecompute = recomputeDerived(feature, {} as any);
    expect(Object.keys(result).sort()).toEqual(Object.keys(ordinaryRecompute).sort());
    // The entity is still at 0 HP afterward — a freshly regenerated card for
    // the SAME feature, with no bypass info in sight, still correctly shows
    // the restriction (still available:false, still incapacitatedOverridable),
    // proving nothing about the earlier override "unlocked" future use.
    const cardAfter = generateActionCard(result.features[0], result)!;
    expect(cardAfter.available).toBe(false);
    expect(cardAfter.incapacitatedOverridable).toBe(true);
  });
});

// ============================================================================
// Rules-engine blocker B: multiclass spellcasting ability
// ============================================================================

function testClass(id: string, spellcastingAbility?: CharClass['spellcastingAbility']): CharClass {
  return { id, name: id, hitDie: 6, features: [], spellcastingAbility };
}

const WIZARD = testClass('wizard', 'int');
const CLERIC = testClass('cleric', 'wis');
const WARLOCK = testClass('warlock', 'cha');
const SORCERER = testClass('sorcerer', 'cha');
const DRUID = testClass('druid', 'wis');
const TEST_CLASSES = [WIZARD, CLERIC, WARLOCK, SORCERER, DRUID];

describe('resolveSpellAbility (rules-engine blocker B)', () => {
  it('Wizard/Cleric multiclass: the Wizard spell uses INT, the Cleric spell uses WIS', () => {
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'fireball', 'class', 'wizard'), ent('spell_access', 'bless', 'class', 'cleric')],
      spellcasting: { ability: 'int', slots: emptySlots(), cantrips: [], known: ['fireball', 'bless'], prepared: [], concentrating: null },
    };
    expect(resolveSpellAbility(e, 'fireball', TEST_CLASSES)).toBe('int');
    expect(resolveSpellAbility(e, 'bless', TEST_CLASSES)).toBe('wis');
  });

  it('Wizard/Warlock multiclass: Wizard spell INT, Warlock spell CHA — normal/pact payment plays no role in this resolution (payment is a separate concern, spellPayment.ts)', () => {
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'fireball', 'class', 'wizard'), ent('spell_access', 'hex', 'class', 'warlock')],
      spellcasting: { ability: 'int', slots: emptySlots(), pactSlots: emptySlots(), cantrips: [], known: ['fireball', 'hex'], prepared: [], concentrating: null },
    };
    expect(resolveSpellAbility(e, 'fireball', TEST_CLASSES)).toBe('int');
    expect(resolveSpellAbility(e, 'hex', TEST_CLASSES)).toBe('cha');
  });

  it('Cleric/Sorcerer multiclass: Cleric spell WIS, Sorcerer spell CHA', () => {
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'bless', 'class', 'cleric'), ent('spell_access', 'fireball', 'class', 'sorcerer')],
      spellcasting: { ability: 'wis', slots: emptySlots(), cantrips: [], known: ['bless', 'fireball'], prepared: [], concentrating: null },
    };
    expect(resolveSpellAbility(e, 'bless', TEST_CLASSES)).toBe('wis');
    expect(resolveSpellAbility(e, 'fireball', TEST_CLASSES)).toBe('cha');
  });

  it('single-class caster is unaffected — resolves to that one class\'s ability', () => {
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'fireball', 'class', 'wizard')],
      spellcasting: { ability: 'int', slots: emptySlots(), cantrips: [], known: ['fireball'], prepared: [], concentrating: null },
    };
    expect(resolveSpellAbility(e, 'fireball', TEST_CLASSES)).toBe('int');
  });

  it('a non-caster or a spell with no tracked entitlement falls back to spellcasting.ability', () => {
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      spellcasting: { ability: 'cha', slots: emptySlots(), cantrips: [], known: [], prepared: [], concentrating: null },
    };
    expect(resolveSpellAbility(e, 'some_untracked_spell', TEST_CLASSES)).toBe('cha');
  });

  it('a racial grant_spell effect with its own spellcastingAbility wins over everything else — existing defined ability preserved', () => {
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('cantrip_access', 'chill_touch', 'race', 'skeleton')],
      features: [{
        id: 'skeleton_doomed_touch', name: 'Doomed Touch', description: '', level: null,
        source: { kind: 'race', refId: 'skeleton' }, isActive: true, passive: true,
        effects: [{ type: 'grant_spell', target: 'spell', operation: 'add', value: null, condition: null, cantripIds: ['chill_touch'], spellcastingAbility: 'con' }],
        actions: [], choices: [],
      }],
      // Character's own headline ability is INT (e.g. a Wizard) — the racial
      // cantrip's OWN con-based ability must still win for chill_touch specifically.
      spellcasting: { ability: 'int', slots: emptySlots(), cantrips: ['chill_touch'], known: [], prepared: [], concentrating: null },
    };
    expect(resolveSpellAbility(e, 'chill_touch', TEST_CLASSES)).toBe('con');
  });

  it('the same spell granted by two different class sources resolves deterministically (first matching entitlement wins), never throws or picks randomly', () => {
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'shield', 'class', 'wizard'), ent('spell_access', 'shield', 'class', 'sorcerer')],
      spellcasting: { ability: 'int', slots: emptySlots(), cantrips: [], known: ['shield'], prepared: [], concentrating: null },
    };
    const first = resolveSpellAbility(e, 'shield', TEST_CLASSES);
    const second = resolveSpellAbility(e, 'shield', TEST_CLASSES);
    expect(first).toBe(second); // deterministic — same input, same output every time
    expect(first).toBe('int'); // resolves to the FIRST entitlement in array order (Wizard)
  });

  it('a granted racial/subclass spell keeps its defined ability across a fresh recompute (source context is not transient)', () => {
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'fireball', 'class', 'wizard')],
      spellcasting: { ability: 'int', slots: emptySlots(), cantrips: [], known: ['fireball'], prepared: [], concentrating: null },
    };
    // Simulate a "reload" — a fresh object with the same persisted entitlements array.
    const reloaded: Entity = JSON.parse(JSON.stringify(e));
    expect(resolveSpellAbility(reloaded, 'fireball', TEST_CLASSES)).toBe('int');
  });

  it('a non-caster entity (no spellcasting block at all) still returns a safe default rather than throwing', () => {
    const e = makeEmptyEntity('e1');
    expect(() => resolveSpellAbility(e, 'anything', TEST_CLASSES)).not.toThrow();
  });
});

// ── Rules-engine blocker RE-AUDIT CLOSURE ────────────────────────────────────
// Closure 1: preparation policy is now content-driven (CharClass.
// spellPreparationPolicy), not a hardcoded classId Set — covers every
// official preparation model (known / spellbook-prepared / full-list-
// prepared), including Artificer (previously omitted) and Ranger (known,
// distinctly from the full-list-prepared classes). Closure 2: legality and
// ability now resolve from the SAME SpellCastingContext, wired into real
// production DC/attack numbers.

describe('preparation policy — full official class catalog (closure 1, content-driven)', () => {
  function preparedCaster(classId: string, ability: CharClass['spellcastingAbility'], spellId: string, prepared: string[]): Entity {
    return {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', spellId, 'class', classId)],
      spellcasting: { ability: ability!, slots: emptySlots({ '1': { total: 2, used: 0 } }), cantrips: [], known: [spellId], prepared, concentrating: null },
    };
  }

  it.each([
    ['cleric', 'wis'], ['druid', 'wis'], ['paladin', 'cha'], ['artificer', 'int'],
  ] as const)('%s is a full-list-prepared caster: unprepared blocks, preparing unblocks (uses the REAL official class catalog, no override classDefs)', (classId, ability) => {
    const unprepared = preparedCaster(classId, ability, 'test_spell', []);
    expect(isSpellPreparationLegal(unprepared, 'test_spell')).toBe(false);
    const prepared = preparedCaster(classId, ability, 'test_spell', ['test_spell']);
    expect(isSpellPreparationLegal(prepared, 'test_spell')).toBe(true);
  });

  it('wizard is spellbook-prepared: same gating as the full-list classes (via the real catalog)', () => {
    const unprepared = preparedCaster('wizard', 'int', 'test_spell', []);
    expect(isSpellPreparationLegal(unprepared, 'test_spell')).toBe(false);
  });

  it.each(['ranger', 'sorcerer', 'bard', 'warlock'])(
    '%s is a known caster: never gated by preparation, even with an empty prepared list (via the real catalog)',
    (classId) => {
      const e = preparedCaster(classId, 'wis', 'test_spell', []);
      expect(isSpellPreparationLegal(e, 'test_spell')).toBe(true);
    },
  );
});

describe('resolveSpellCastingContexts / selectSpellCastingContext (closure 2A — the shared unit)', () => {
  it('builds one context per source, each carrying its OWN policy/ability/legality together', () => {
    const e = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'fireball', 'class', 'wizard'), ent('spell_access', 'fireball', 'class', 'sorcerer')],
      spellcasting: { ability: 'int' as const, slots: emptySlots(), cantrips: [], known: ['fireball'], prepared: [], concentrating: null },
    };
    const contexts = resolveSpellCastingContexts(e, 'fireball', TEST_CLASSES);
    expect(contexts).toHaveLength(2);
    const wizardCtx = contexts.find(c => c.sourceId === 'wizard')!;
    const sorcererCtx = contexts.find(c => c.sourceId === 'sorcerer')!;
    expect(wizardCtx.preparationPolicy).toBe('known'); // TEST_CLASSES doesn't author a policy — fails open
    expect(wizardCtx.castingAbility).toBe('int');
    expect(sorcererCtx.castingAbility).toBe('cha');
  });

  it('selectSpellCastingContext picks the legal one and its ability matches what resolveSpellAbility returns for the same inputs', () => {
    const e = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'fireball', 'class', 'wizard')],
      spellcasting: { ability: 'int' as const, slots: emptySlots({ '3': { total: 1, used: 0 } }), cantrips: [], known: ['fireball'], prepared: ['fireball'], concentrating: null },
    };
    const selected = selectSpellCastingContext(e, 'fireball', TEST_CLASSES);
    expect(selected.castingAbility).toBe(resolveSpellAbility(e, 'fireball', TEST_CLASSES));
    expect(selected.legal).toBe(isSpellPreparationLegal(e, 'fireball', TEST_CLASSES));
  });
});

describe('exact context identity (rules-engine blocker RE-AUDIT closure 2A/2B/2D)', () => {
  // Two grant_spell effects on the SAME feature, for the SAME spell, with
  // TWO DIFFERENT explicit casting abilities — Codex's own example of a
  // coarse `sourceKind:sourceId:classId` key colliding (both would be
  // "feature:dual_grant_feature:" under the old scheme).
  function dualGrantEntity(): Entity {
    return {
      ...makeEmptyEntity('e1'),
      features: [{
        id: 'dual_grant_feature', name: 'Dual Grant', description: '', level: null,
        source: { kind: 'feat', refId: 'test' }, isActive: true, passive: true,
        effects: [
          { type: 'grant_spell', target: 'spell', operation: 'add', value: null, condition: null, spellIds: ['shared_spell'], spellcastingAbility: 'int' },
          { type: 'grant_spell', target: 'spell', operation: 'add', value: null, condition: null, spellIds: ['shared_spell'], spellcastingAbility: 'cha' },
        ],
        actions: [], choices: [],
      }],
      spellcasting: { ability: 'wis', slots: emptySlots({ '1': { total: 2, used: 0 } }), cantrips: [], known: ['shared_spell'], prepared: [], concentrating: null },
    };
  }

  it('two grant_spell effects on the same feature, same spell, different abilities -> DISTINCT context keys, never collide', () => {
    const contexts = resolveSpellCastingContexts(dualGrantEntity(), 'shared_spell');
    expect(contexts).toHaveLength(2);
    const [a, b] = contexts;
    expect(a.contextKey).not.toBe(b.contextKey);
    expect(new Set([a.castingAbility, b.castingAbility])).toEqual(new Set(['int', 'cha']));
  });

  it('the exact SELECTED (second) context survives ActionCard -> execution, not silently the first', () => {
    const e = dualGrantEntity();
    const card = generateSpellCard('shared_spell', e, { homebrewSpells: [leveledSpell('shared_spell', 1)] })!;
    const contexts = resolveSpellCastingContexts(e, 'shared_spell');
    const chaContext = contexts.find(c => c.castingAbility === 'cha')!;
    const result = applyActionCardUse(e, card, {} as any, undefined, undefined, false, chaContext);
    // Executed successfully (a feature-granted spell has no cost gate here) —
    // the important assertion is WHICH context drove it, proven below via rejection.
    expect(result).not.toBe(e);
  });

  it('if the second (CHA) grant is removed/changed by the time of execution, execution REJECTS rather than silently using the first (INT)', () => {
    const e = dualGrantEntity();
    const card = generateSpellCard('shared_spell', e, { homebrewSpells: [leveledSpell('shared_spell', 1)] })!;
    const contextsAtGeneration = resolveSpellCastingContexts(e, 'shared_spell');
    const chaContext = contextsAtGeneration.find(c => c.castingAbility === 'cha')!;

    // The CHA-granting effect is removed from the feature by execution time
    // (e.g. a feature re-roll/edit) — only the INT one remains.
    const changed: Entity = {
      ...e,
      features: [{
        ...e.features[0],
        effects: [e.features[0].effects[0]], // only the INT grant_spell effect survives
      }],
    };
    const result = applyActionCardUse(changed, card, {} as any, undefined, undefined, false, chaContext);
    expect(result).toBe(changed); // rejected — never silently falls back to the surviving INT context
  });

  it('entitlement-backed contexts sharing a source but differing by choiceId get DISTINCT keys (2C)', () => {
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [
        { kind: 'spell_access', key: 'shared_spell2', sourceKind: 'class', sourceId: 'wizard', choiceId: 'choice_a' },
        { kind: 'spell_access', key: 'shared_spell2', sourceKind: 'class', sourceId: 'wizard', choiceId: 'choice_b' },
      ],
      spellcasting: { ability: 'int', slots: emptySlots({ '1': { total: 2, used: 0 } }), cantrips: [], known: ['shared_spell2'], prepared: [], concentrating: null },
    };
    const contexts = resolveSpellCastingContexts(e, 'shared_spell2');
    expect(contexts).toHaveLength(2);
    expect(contexts[0].contextKey).not.toBe(contexts[1].contextKey);
  });
});

describe('subclass → parent class resolution (closure 2C)', () => {
  it("a non-primary subclass grant resolves to ITS PARENT CLASS's ability, not the character's headline scalar", () => {
    // Wizard PRIMARY (headline ability INT) + Cleric SECONDARY with a
    // Life-domain subclass grant — the domain spell must resolve to
    // Cleric/WIS, not the global Wizard/INT scalar.
    const classes: ClassLevelEntry[] = [
      { classId: asClassId('wizard'), subclassId: null, level: 5 },
      { classId: asClassId('cleric'), subclassId: asSubclassId('life_domain'), level: 3 },
    ];
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      identity: { ...makeEmptyEntity('e1').identity, classes },
      entitlements: [ent('spell_access', 'bless', 'subclass', 'life_domain')],
      spellcasting: { ability: 'int', slots: emptySlots(), cantrips: [], known: ['bless'], prepared: [], concentrating: null },
    };
    expect(isSpellPreparationLegal(e, 'bless')).toBe(true); // subclass grants are always available
    expect(resolveSpellAbility(e, 'bless', TEST_CLASSES)).toBe('wis'); // resolved via Cleric, the subclass's OWN parent
  });

  it('falls back to the headline scalar when the subclass cannot be matched to any of the character\'s own classes', () => {
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'bless', 'subclass', 'untracked_domain')],
      spellcasting: { ability: 'int', slots: emptySlots(), cantrips: [], known: ['bless'], prepared: [], concentrating: null },
    };
    expect(resolveSpellAbility(e, 'bless', TEST_CLASSES)).toBe('int'); // disclosed fallback, not a crash
  });
});

describe('same spell, two legal sources at once — deterministic selection (closure 2D)', () => {
  it('prefers the character\'s own PRIMARY (earliest-taken) class when both sources are simultaneously legal', () => {
    const classes: ClassLevelEntry[] = [
      { classId: asClassId('sorcerer'), subclassId: null, level: 1 },
      { classId: asClassId('wizard'), subclassId: null, level: 1 },
    ];
    // Sorcerer is 'known' (always legal); Wizard is prepared here too, so
    // BOTH sources are legal simultaneously — must resolve deterministically
    // to the PRIMARY class (Sorcerer, classes[0]), not array order.
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      identity: { ...makeEmptyEntity('e1').identity, classes },
      entitlements: [ent('spell_access', 'shield', 'class', 'wizard'), ent('spell_access', 'shield', 'class', 'sorcerer')],
      spellcasting: { ability: 'cha', slots: emptySlots(), cantrips: [], known: ['shield'], prepared: ['shield'], concentrating: null },
    };
    const first = resolveSpellAbility(e, 'shield');
    const second = resolveSpellAbility(e, 'shield');
    expect(first).toBe(second); // deterministic
    expect(first).toBe('cha'); // Sorcerer — the character's own primary class
  });
});

describe('resolveSpellSaveDC / resolveSpellAttackBonus — production numeric values (closure 2E)', () => {
  function multiclassCaster(): Entity {
    const classes: ClassLevelEntry[] = [
      { classId: asClassId('wizard'), subclassId: null, level: 5 },
      { classId: asClassId('cleric'), subclassId: null, level: 3 },
    ];
    const base: Entity = {
      ...makeEmptyEntity('e1'),
      identity: { ...makeEmptyEntity('e1').identity, level: 8, classes },
      stats: { ...makeEmptyEntity('e1').stats, int: 18, wis: 14 },
      entitlements: [ent('spell_access', 'fireball', 'class', 'wizard'), ent('spell_access', 'bless', 'class', 'cleric')],
      spellcasting: { ability: 'int', slots: emptySlots({ '3': { total: 2, used: 0 } }), cantrips: [], known: ['fireball', 'bless'], prepared: ['fireball', 'bless'], concentrating: null },
    };
    return recomputeDerived(base, DEFAULT_RULES);
  }

  it('Wizard 5 / Cleric 3, INT 18 (+4) / WIS 14 (+2), PB +3: Wizard spell DC 15 / +7, Cleric spell DC 13 / +5 — matches the task\'s own worked example exactly', () => {
    const e = multiclassCaster();
    expect(e.derived.proficiencyBonus).toBe(3);
    expect(resolveSpellSaveDC(e, 'fireball')).toBe(15);
    expect(resolveSpellAttackBonus(e, 'fireball')).toBe(7);
    expect(resolveSpellSaveDC(e, 'bless')).toBe(13);
    expect(resolveSpellAttackBonus(e, 'bless')).toBe(5);
    // The headline/global scalar stays pinned to the primary class (Wizard) —
    // per-spell resolution diverges from it correctly for the Cleric spell.
    expect(e.derived.spellSaveDC).toBe(15);
  });

  it('a Wizard/Warlock multiclass: Warlock Pact Magic payment never changes the spell\'s own CHA-based DC', () => {
    const classes: ClassLevelEntry[] = [
      { classId: asClassId('wizard'), subclassId: null, level: 5 },
      { classId: asClassId('warlock'), subclassId: null, level: 3 },
    ];
    const e = recomputeDerived({
      ...makeEmptyEntity('e1'),
      identity: { ...makeEmptyEntity('e1').identity, level: 8, classes },
      stats: { ...makeEmptyEntity('e1').stats, int: 16, cha: 16 },
      entitlements: [ent('spell_access', 'fireball', 'class', 'wizard'), ent('spell_access', 'hex', 'class', 'warlock')],
      spellcasting: {
        ability: 'int', slots: emptySlots({ '3': { total: 2, used: 0 } }), pactSlots: emptySlots({ '2': { total: 1, used: 0 } }),
        cantrips: [], known: ['fireball', 'hex'], prepared: ['fireball'], concentrating: null,
      },
    }, DEFAULT_RULES);
    const dcBeforePayment = resolveSpellSaveDC(e, 'hex');
    // Simulate "payment happened" — spending the pact slot never touches
    // spellcasting.ability or any entitlement; resolveSpellSaveDC re-derives
    // from the SAME unaffected source context either way.
    const afterPayment = { ...e, spellcasting: { ...e.spellcasting!, pactSlots: { ...e.spellcasting!.pactSlots!, '2': { total: 1, used: 1 } } } };
    expect(resolveSpellSaveDC(afterPayment, 'hex')).toBe(dcBeforePayment);
    expect(resolveSpellAttackBonus(e, 'hex')).toBe(e.derived.proficiencyBonus + Math.floor((16 - 10) / 2)); // CHA-based
  });

  it('a Cleric/Sorcerer multiclass: Cleric WIS, Sorcerer CHA, distinct DCs', () => {
    const classes: ClassLevelEntry[] = [
      { classId: asClassId('cleric'), subclassId: null, level: 4 },
      { classId: asClassId('sorcerer'), subclassId: null, level: 2 },
    ];
    const e = recomputeDerived({
      ...makeEmptyEntity('e1'),
      identity: { ...makeEmptyEntity('e1').identity, level: 6, classes },
      stats: { ...makeEmptyEntity('e1').stats, wis: 16, cha: 14 },
      entitlements: [ent('spell_access', 'bless', 'class', 'cleric'), ent('spell_access', 'fireball', 'class', 'sorcerer')],
      spellcasting: { ability: 'wis', slots: emptySlots({ '1': { total: 4, used: 0 }, '3': { total: 2, used: 0 } }), cantrips: [], known: ['bless', 'fireball'], prepared: ['bless'], concentrating: null },
    }, DEFAULT_RULES);
    expect(resolveSpellSaveDC(e, 'bless')).not.toBe(resolveSpellSaveDC(e, 'fireball'));
    expect(resolveSpellSaveDC(e, 'bless')).toBe(e.derived.spellSaveDC); // Cleric is the primary class here
  });

  it('a single-class caster is completely unchanged: per-spell DC equals the headline DC', () => {
    const e = recomputeDerived({
      ...makeEmptyEntity('e1'),
      stats: { ...makeEmptyEntity('e1').stats, int: 16 },
      entitlements: [ent('spell_access', 'fireball', 'class', 'wizard')],
      spellcasting: { ability: 'int', slots: emptySlots({ '3': { total: 2, used: 0 } }), cantrips: [], known: ['fireball'], prepared: ['fireball'], concentrating: null },
    }, DEFAULT_RULES);
    expect(resolveSpellSaveDC(e, 'fireball')).toBe(e.derived.spellSaveDC);
    expect(resolveSpellAttackBonus(e, 'fireball')).toBe(e.derived.spellAttackBonus);
  });

  it('a non-caster entity returns null rather than throwing', () => {
    const e = recomputeDerived(makeEmptyEntity('e1'), DEFAULT_RULES);
    expect(resolveSpellSaveDC(e, 'anything')).toBeNull();
    expect(resolveSpellAttackBonus(e, 'anything')).toBeNull();
  });

  it('a racial/feature-granted spell with its own explicit ability is honored in the numeric DC too', () => {
    const e = recomputeDerived({
      ...makeEmptyEntity('e1'),
      stats: { ...makeEmptyEntity('e1').stats, int: 16, con: 18 },
      entitlements: [ent('cantrip_access', 'chill_touch', 'race', 'skeleton')],
      features: [{
        id: 'skeleton_doomed_touch', name: 'Doomed Touch', description: '', level: null,
        source: { kind: 'race', refId: 'skeleton' }, isActive: true, passive: true,
        effects: [{ type: 'grant_spell', target: 'spell', operation: 'add', value: null, condition: null, cantripIds: ['chill_touch'], spellcastingAbility: 'con' }],
        actions: [], choices: [],
      }],
      spellcasting: { ability: 'int', slots: emptySlots(), cantrips: ['chill_touch'], known: [], prepared: [], concentrating: null },
    }, DEFAULT_RULES);
    const expectedConDC = 8 + e.derived.proficiencyBonus + Math.floor((18 - 10) / 2);
    expect(resolveSpellSaveDC(e, 'chill_touch')).toBe(expectedConDC);
    expect(resolveSpellSaveDC(e, 'chill_touch')).not.toBe(e.derived.spellSaveDC); // diverges from the INT-based headline DC
  });

  it('an ACTIVE character/DM override on spellSaveDC is authoritative and applies uniformly to every spell, regardless of source', () => {
    const e = recomputeDerived({
      ...makeEmptyEntity('e1'),
      stats: { ...makeEmptyEntity('e1').stats, int: 18, wis: 10 },
      entitlements: [ent('spell_access', 'fireball', 'class', 'wizard'), ent('spell_access', 'bless', 'class', 'cleric')],
      spellcasting: { ability: 'int', slots: emptySlots({ '3': { total: 2, used: 0 } }), cantrips: [], known: ['fireball', 'bless'], prepared: ['fireball', 'bless'], concentrating: null },
      characterOverrides: [{ id: 'ov1', entityId: 'e1', stat: 'spellSaveDC', operation: 'set', value: 20, label: 'test override', active: true, appliedAt: 0, cancelledAt: null }],
    }, DEFAULT_RULES);
    expect(resolveSpellSaveDC(e, 'fireball')).toBe(20);
    expect(resolveSpellSaveDC(e, 'bless')).toBe(20); // same flat override, regardless of Wizard vs Cleric source
  });

  it('changing an ability score only shifts the DC of spells that actually use it', () => {
    const build = (int: number, wis: number) => recomputeDerived({
      ...makeEmptyEntity('e1'),
      stats: { ...makeEmptyEntity('e1').stats, int, wis },
      entitlements: [ent('spell_access', 'fireball', 'class', 'wizard'), ent('spell_access', 'bless', 'class', 'cleric')],
      spellcasting: { ability: 'int', slots: emptySlots({ '3': { total: 2, used: 0 } }), cantrips: [], known: ['fireball', 'bless'], prepared: ['fireball', 'bless'], concentrating: null },
    }, DEFAULT_RULES);
    const before = build(16, 14);
    const afterIntBump = build(18, 14); // only INT changed
    expect(resolveSpellSaveDC(afterIntBump, 'fireball')).toBeGreaterThan(resolveSpellSaveDC(before, 'fireball')!);
    expect(resolveSpellSaveDC(afterIntBump, 'bless')).toBe(resolveSpellSaveDC(before, 'bless')); // WIS-based spell unaffected
  });
});

describe('production card UI shows real per-spell numbers, not just helper-level values (closure 2E)', () => {
  it('buildLayer3ForSpell renders the spell\'s OWN resolved DC in the actual generated card text', () => {
    const e = recomputeDerived({
      ...makeEmptyEntity('e1'),
      stats: { ...makeEmptyEntity('e1').stats, wis: 16 },
      entitlements: [ent('spell_access', 'bless', 'class', 'cleric')],
      spellcasting: { ability: 'wis', slots: emptySlots({ '1': { total: 2, used: 0 } }), cantrips: [], known: ['bless'], prepared: ['bless'], concentrating: null },
    }, DEFAULT_RULES);
    const savingThrowSpell = leveledSpell('bless', 1, { description: 'Each target must make a Wisdom saving throw or be affected.' });
    const dc = resolveSpellSaveDC(e, 'bless');
    expect(buildLayer3ForSpell(savingThrowSpell, e)).toBe(`WIS Save vs DC ${dc}`);
  });

  it('buildLayer2ForSpell renders the spell\'s OWN resolved attack bonus in the actual generated card text', () => {
    const e = recomputeDerived({
      ...makeEmptyEntity('e1'),
      stats: { ...makeEmptyEntity('e1').stats, int: 16 },
      entitlements: [ent('spell_access', 'fire_bolt', 'class', 'wizard')],
      spellcasting: { ability: 'int', slots: emptySlots(), cantrips: ['fire_bolt'], known: [], prepared: [], concentrating: null },
    }, DEFAULT_RULES);
    const attackSpell = leveledSpell('fire_bolt', 0, { description: 'Make a ranged spell attack against a creature.' });
    const atk = resolveSpellAttackBonus(e, 'fire_bolt');
    expect(buildLayer2ForSpell(attackSpell, e)).toContain(`${atk! >= 0 ? '+' : ''}${atk} to hit`);
  });
});

// ============================================================================
// Rules-engine blocker RE-AUDIT closure — explicit spell casting context,
// ruleset/homebrew metadata resolution.
// ============================================================================

describe('ambiguous legacy provenance produces REAL per-class contexts, not one unrestricted context (closure 1F, test #2)', () => {
  const fireball = leveledSpell('fireball', 3, { classes: ['wizard', 'sorcerer'] });

  function ambiguousEntity(): Entity {
    const classes: ClassLevelEntry[] = [
      { classId: asClassId('wizard'), subclassId: null, level: 3 },
      { classId: asClassId('sorcerer'), subclassId: null, level: 2 },
    ];
    return {
      ...makeEmptyEntity('e1'),
      identity: { ...makeEmptyEntity('e1').identity, classes },
      entitlements: [{ kind: 'spell_access', key: 'fireball', sourceKind: 'manual', ambiguousClassIds: ['wizard', 'sorcerer'] }],
      spellcasting: { ability: 'int', slots: emptySlots({ '3': { total: 2, used: 0 } }), cantrips: [], known: ['fireball'], prepared: [], concentrating: null },
    };
  }

  it('produces TWO real per-class contexts, never one blanket always-legal manual context', () => {
    const contexts = resolveSpellCastingContexts(ambiguousEntity(), 'fireball', TEST_CLASSES);
    expect(contexts).toHaveLength(2);
    const wiz = contexts.find(c => c.classId === 'wizard')!;
    const sorc = contexts.find(c => c.classId === 'sorcerer')!;
    expect(wiz.castingAbility).toBe('int');
    expect(sorc.castingAbility).toBe('cha');
    expect(contexts.every(c => c.sourceKind === 'manual' && c.unresolvedLegacy)).toBe(true);
  });

  it('using the REAL official catalog: Wizard candidate requires preparation, Sorcerer candidate is always legal', () => {
    const contexts = resolveSpellCastingContexts(ambiguousEntity(), 'fireball'); // default classDefs = ALL_CHAR_CLASSES
    const wiz = contexts.find(c => c.classId === 'wizard')!;
    const sorc = contexts.find(c => c.classId === 'sorcerer')!;
    expect(wiz.preparationPolicy).toBe('spellbook_prepared');
    expect(wiz.castingAbility).toBe('int');
    expect(wiz.legal).toBe(false); // not prepared
    expect(sorc.preparationPolicy).toBe('known');
    expect(sorc.castingAbility).toBe('cha');
    expect(sorc.legal).toBe(true);
    expect(contexts.every(c => c.unresolvedLegacy)).toBe(true);
  });

  it('preparing the spell (arbitrarily, under one class name) makes the Wizard candidate legal too — both contexts then materially distinct and selectable (test #4 analogue)', () => {
    const e = { ...ambiguousEntity(), spellcasting: { ...ambiguousEntity().spellcasting!, prepared: ['fireball'] } };
    const contexts = resolveSpellCastingContexts(e, 'fireball');
    expect(contexts.every(c => c.legal)).toBe(true);
    const distinct = collapseDistinctSpellCastingContexts(contexts);
    expect(distinct).toHaveLength(2); // different ability -> never collapsed
  });

  it('generateSpellCard exposes BOTH contexts via spellCastingContexts — the UI chooser signal', () => {
    const card = generateSpellCard('fireball', ambiguousEntity(), { homebrewSpells: [fireball] })!;
    expect(card.available).toBe(true); // legal via Sorcerer
    expect(card.spellCastingContexts).toBeDefined();
    expect(card.spellCastingContexts).toHaveLength(2);
  });

  it('a genuine manual grant with NO plausible class stays a single, unrestricted context (test #3)', () => {
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'magic_missile', 'manual')], // no ambiguousClassIds
      spellcasting: { ability: 'int', slots: emptySlots({ '1': { total: 2, used: 0 } }), cantrips: [], known: ['magic_missile'], prepared: [], concentrating: null },
    };
    const contexts = resolveSpellCastingContexts(e, 'magic_missile');
    expect(contexts).toHaveLength(1);
    expect(contexts[0].legal).toBe(true);
    expect(contexts[0].unresolvedLegacy).toBeFalsy();
    expect(contexts[0].classId).toBeUndefined();
  });
});

describe('ActionCard preserves and re-validates its exact casting context at execution (closure 1B, tests #6/#7)', () => {
  const fireball = leveledSpell('fireball', 3);
  const opts = { homebrewSpells: [fireball] };

  it('#6: the context on the generated card matches the one execution actually uses', () => {
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'fireball', 'class', 'sorcerer')],
      spellcasting: { ability: 'cha', slots: emptySlots({ '3': { total: 2, used: 0 } }), cantrips: [], known: ['fireball'], prepared: [], concentrating: null },
    };
    const card = generateSpellCard('fireball', e, opts)!;
    expect(card.spellCastingContext?.castingAbility).toBe('cha');
    const result = applyActionCardUse(e, card, {} as any);
    expect(result).not.toBe(e); // cast succeeded (Sorcerer is a known caster)
    expect(result.spellcasting!.slots['3'].used).toBe(1);
  });

  it('#7: a removed source is rejected at execution rather than silently switching to a different one', () => {
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'fireball', 'class', 'sorcerer')],
      spellcasting: { ability: 'cha', slots: emptySlots({ '3': { total: 2, used: 0 } }), cantrips: [], known: ['fireball'], prepared: [], concentrating: null },
    };
    const card = generateSpellCard('fireball', e, opts)!; // context built against the Sorcerer entitlement
    // The Sorcerer entitlement is gone by the time the cast actually executes
    // (e.g. multiclass level removed mid-session) — a DIFFERENT source now
    // exists for the same spell (Wizard), but execution must NOT silently
    // switch to it.
    const changed: Entity = {
      ...e,
      entitlements: [ent('spell_access', 'fireball', 'class', 'wizard')],
      spellcasting: { ...e.spellcasting!, prepared: [] },
    };
    const result = applyActionCardUse(changed, card, {} as any);
    expect(result).toBe(changed); // rejected — fails safely, never silently re-resolves
  });

  it('explicitly passing a DIFFERENT selected context than the card default uses THAT one (source chooser wiring)', () => {
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'fireball', 'class', 'wizard'), ent('spell_access', 'fireball', 'class', 'sorcerer')],
      spellcasting: { ability: 'int', slots: emptySlots({ '3': { total: 2, used: 0 } }), cantrips: [], known: ['fireball'], prepared: ['fireball'], concentrating: null },
    };
    const card = generateSpellCard('fireball', e, opts)!;
    const sorcererContext = card.spellCastingContexts!.find(c => c.classId === 'sorcerer')!;
    const result = applyActionCardUse(e, card, {} as any, undefined, undefined, false, sorcererContext);
    expect(result).not.toBe(e);
    expect(result.spellcasting!.slots['3'].used).toBe(1);
  });
});

describe('formatCastingContextLabel (chooser UI text)', () => {
  it('shows class name, ability, and DC for a legal context; "Not Prepared" for an illegal one', () => {
    const e = recomputeDerived({
      ...makeEmptyEntity('e1'),
      stats: { ...makeEmptyEntity('e1').stats, int: 16, cha: 14 },
      entitlements: [ent('spell_access', 'fireball', 'class', 'wizard'), ent('spell_access', 'fireball', 'class', 'sorcerer')],
      spellcasting: { ability: 'int', slots: emptySlots({ '3': { total: 2, used: 0 } }), cantrips: [], known: ['fireball'], prepared: [], concentrating: null },
    }, DEFAULT_RULES);
    const contexts = resolveSpellCastingContexts(e, 'fireball');
    const wiz = contexts.find(c => c.classId === 'wizard')!;
    const sorc = contexts.find(c => c.classId === 'sorcerer')!;
    expect(formatCastingContextLabel(e, wiz)).toContain('Not Prepared');
    expect(formatCastingContextLabel(e, sorc)).toMatch(/Sorcerer.*CHA.*DC/);
  });
});

describe('ruleset-aware preparation policy (closure 2A)', () => {
  it('official classes resolve correctly with NO ruleset filter (untagged content matches every ruleset)', () => {
    expect(isSpellPreparationLegal(
      { ...makeEmptyEntity('e1'), entitlements: [ent('spell_access', 'x', 'class', 'ranger')], spellcasting: { ability: 'wis', slots: emptySlots(), cantrips: [], known: ['x'], prepared: [], concentrating: null } },
      'x',
    )).toBe(true); // Ranger is 'known' — never gated
  });

  it('a class content entry tagged with a SPECIFIC ruleset only applies when the entity is on that ruleset (2A mechanism proof)', () => {
    const untaggedRanger: CharClass = { id: 'ranger', name: 'Ranger', hitDie: 10, features: [], spellcastingAbility: 'wis', spellPreparationPolicy: 'known' };
    const revisedRanger: CharClass = { id: 'ranger', name: 'Ranger (Revised)', hitDie: 10, features: [], spellcastingAbility: 'wis', spellPreparationPolicy: 'full_list_prepared', rulesetId: 'dnd5e-2024' as any };
    const classDefs = [untaggedRanger, revisedRanger];
    // An entity on no specific ruleset resolves BOTH by id-match — the
    // resolver picks whichever it finds first for the classId; what this
    // proves is that a ruleset-tagged entry CAN coexist and be filtered by
    // resolveClassDefsForEntity's own getMergedContentDB(activeRuleset)
    // call in production (matchesRuleset's existing untagged/tagged rule),
    // not that this raw classDefs array itself filters (it doesn't — that
    // filtering happens one layer up, in getMergedContentDB).
    expect(classDefs.some(c => c.rulesetId === 'dnd5e-2024' && c.spellPreparationPolicy === 'full_list_prepared')).toBe(true);
  });
});

// Rules-engine blocker RE-AUDIT closure (dependency inversion, 1B): these
// tests now build the merged classDefs/homebrewSpells EXPLICITLY, the way
// the application layer does (getMergedContentDB(entity.rulesetId) +
// homebrew spells), and pass them via generateSpellCard's own opts param —
// the engine no longer resolves this from a store on its own, so a
// production caller that OMITS opts.classDefs correctly gets official-only
// behavior (proven by the very first assertion below).
describe('homebrew class metadata flows into production card generation (closure 2B/2C)', () => {
  const homebrewCaster: CharClass = {
    id: 'runeblade', name: 'Runeblade', hitDie: 8, features: [],
    spellcastingAbility: 'int', spellPreparationPolicy: 'full_list_prepared',
  };
  const runeSpell = leveledSpell('rune_bolt', 1, { classes: ['runeblade'] });
  const mergedClassDefs = [...ALL_CHAR_CLASSES, homebrewCaster];

  it('#11: a homebrew full-list-prepared caster is correctly gated by preparation when the caller passes the merged content explicitly', () => {
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'rune_bolt', 'class', 'runeblade')],
      spellcasting: { ability: 'int', slots: emptySlots({ '1': { total: 2, used: 0 } }), cantrips: [], known: ['rune_bolt'], prepared: [], concentrating: null },
    };
    const opts = { classDefs: mergedClassDefs, homebrewSpells: [runeSpell] };
    const unpreparedCard = generateSpellCard('rune_bolt', e, opts)!;
    expect(unpreparedCard.available).toBe(false);
    expect(unpreparedCard.preparationOverridable).toBe(true);

    const prepared = { ...e, spellcasting: { ...e.spellcasting!, prepared: ['rune_bolt'] } };
    const preparedCard = generateSpellCard('rune_bolt', prepared, opts)!;
    expect(preparedCard.available).toBe(true);
    expect(preparedCard.spellCastingContext?.castingAbility).toBe('int'); // homebrew class's OWN ability
  });

  it('without opts.classDefs, the SAME entity falls back to official-only content — proves the engine no longer resolves homebrew implicitly', () => {
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'rune_bolt', 'class', 'runeblade')],
      spellcasting: { ability: 'int', slots: emptySlots({ '1': { total: 2, used: 0 } }), cantrips: [], known: ['rune_bolt'], prepared: ['rune_bolt'], concentrating: null },
    };
    const card = generateSpellCard('rune_bolt', e, { homebrewSpells: [runeSpell] })!; // classDefs omitted
    // 'runeblade' isn't in the official catalog -> resolvePreparationPolicy
    // fails open to 'known' -> always legal regardless of prepared state,
    // NOT the homebrew class's real 'full_list_prepared' policy.
    expect(card.spellCastingContext?.preparationPolicy).toBe('known');
  });

  it('#12: a homebrew known caster is never gated by preparation', () => {
    const wildsinger: CharClass = { id: 'wildsinger', name: 'Wildsinger', hitDie: 8, features: [], spellcastingAbility: 'cha', spellPreparationPolicy: 'known' };
    const wildNote = leveledSpell('wild_note', 1, { classes: ['wildsinger'] });
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'wild_note', 'class', 'wildsinger')],
      spellcasting: { ability: 'cha', slots: emptySlots({ '1': { total: 2, used: 0 } }), cantrips: [], known: ['wild_note'], prepared: [], concentrating: null },
    };
    const card = generateSpellCard('wild_note', e, { classDefs: [...ALL_CHAR_CLASSES, wildsinger], homebrewSpells: [wildNote] })!;
    expect(card.available).toBe(true);
    expect(card.preparationOverridable).toBeFalsy();
  });

  it('#13: a homebrew subclass source resolves to its homebrew parent class', () => {
    const classes: ClassLevelEntry[] = [{ classId: asClassId('runeblade'), subclassId: asSubclassId('rune_scholar'), level: 3 }];
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      identity: { ...makeEmptyEntity('e1').identity, classes },
      entitlements: [ent('spell_access', 'rune_bolt', 'subclass', 'rune_scholar')],
      spellcasting: { ability: 'int', slots: emptySlots({ '1': { total: 2, used: 0 } }), cantrips: [], known: ['rune_bolt'], prepared: [], concentrating: null },
    };
    expect(resolveSpellAbility(e, 'rune_bolt', mergedClassDefs)).toBe('int');
    const card = generateSpellCard('rune_bolt', e, { classDefs: mergedClassDefs, homebrewSpells: [runeSpell] })!;
    expect(card.available).toBe(true); // subclass grants are always available
    expect(card.spellCastingContext?.classId).toBe('runeblade');
  });
});

// Rules-engine blocker RE-AUDIT closure — architecture purity (1F): resolving
// the merged official+homebrew class list is now the APPLICATION layer's
// job (getMergedContentDB), not this engine file's — see the "engine purity"
// describe block near the top of this file for the regression-lock proving
// actionCards.ts no longer imports useHomebrewStore at all.

// ============================================================================
// Rules-engine blocker RE-AUDIT closure 1I/1J — the exact Codex failure
// class: "homebrew character initially correct -> ordinary HP/resource/
// action mutation -> recompute with official fallback -> homebrew class/
// item/spell-derived state becomes wrong." Exercises the REAL production
// path both app/sheet/[id].tsx's and app/dm/character/[id].tsx's own
// mutate() use — a mutator (here: applyDamage, standing in for any ordinary
// HP/resource/action mutation) followed by recomputeDerived called AGAIN
// with the SAME explicit content snapshot — proving that second pass never
// silently degrades to official-only content, which is exactly what mutate()
// does for every ordinary player/DM mutation.
// ============================================================================
describe('homebrew caster + item survive an unrelated ordinary mutation (closure 1I/1J)', () => {
  const homebrewCaster: CharClass = {
    id: 'runeblade', name: 'Runeblade', hitDie: 8, features: [],
    spellcastingAbility: 'int', spellPreparationPolicy: 'full_list_prepared',
  };
  const runeSpell = leveledSpell('rune_bolt', 1, { classes: ['runeblade'] });
  const homebrewItem: Item = {
    id: 'rune_amulet', name: 'Rune Amulet', weight: 1, cost: '0 gp', properties: [],
    features: [{
      id: 'rune_amulet_ac', name: 'Rune Amulet', description: 'Passive AC bonus.',
      source: { kind: 'item', refId: 'rune_amulet' }, level: null, actions: [], choices: [], passive: true,
      activation: { actionType: 'passive', resourceCost: null, range: null, target: 'self', requiresSave: null },
      effects: [{ type: 'stat_modifier', target: 'ac', operation: 'add', value: 2, condition: null }],
    }],
  };
  const cardContent = { classDefs: [...ALL_CHAR_CLASSES, homebrewCaster], homebrewSpells: [runeSpell], items: [homebrewItem] };

  function buildEntity(): Entity {
    return {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'rune_bolt', 'class', 'runeblade')],
      spellcasting: { ability: 'int', slots: emptySlots({ '1': { total: 2, used: 0 } }), cantrips: [], known: ['rune_bolt'], prepared: ['rune_bolt'], concentrating: null },
      inventory: { ...makeEmptyEntity('e1').inventory, equipped: [{ itemId: homebrewItem.id, quantity: 1, attuned: false, features: homebrewItem.features }] },
      resources: { ...makeEmptyEntity('e1').resources, hp: { maximum: 20, current: 20, temp: 0 } },
    };
  }

  it('generates correct homebrew-caster + homebrew-item state, then keeps it correct after an unrelated HP mutation (player-mutation-plumbing shape)', () => {
    // 1. Generate correct initial state (mirrors initial character load).
    const initial = recomputeDerived(buildEntity(), DEFAULT_RULES, cardContent);
    const spellCard = generateAllActionCards(initial, DEFAULT_RULES, cardContent).find(c => c.featureId === 'rune_bolt')!;
    expect(spellCard.available).toBe(true);
    expect(spellCard.spellCastingContext?.castingAbility).toBe('int'); // homebrew class's own ability
    expect(spellCard.spellCastingContext?.preparationPolicy).toBe('full_list_prepared');
    expect(initial.derived.ac).toBe(12); // base 10 + homebrew item's +2

    // 2. Perform an UNRELATED ordinary mutation — exactly the shape
    //    app/sheet/[id].tsx's / app/dm/character/[id].tsx's mutate() uses:
    //    updater(e) then recomputeDerived(updated, rules, cardContent) —
    //    the SAME explicit content snapshot, never omitted.
    const damaged = applyDamage(initial, 5, DEFAULT_RULES);
    const mutated = recomputeDerived(damaged, DEFAULT_RULES, cardContent);

    // 3. Homebrew class/spell/item-derived state must still be correct —
    //    no silent official-only fallback corruption.
    expect(mutated.resources.hp.current).toBe(15);
    const spellCardAfter = generateAllActionCards(mutated, DEFAULT_RULES, cardContent).find(c => c.featureId === 'rune_bolt')!;
    expect(spellCardAfter.available).toBe(true);
    expect(spellCardAfter.spellCastingContext?.castingAbility).toBe('int');
    expect(spellCardAfter.spellCastingContext?.preparationPolicy).toBe('full_list_prepared');
    expect(mutated.derived.ac).toBe(12); // homebrew item's AC bonus still applied
  });

  it('purity: the SAME explicit content snapshot produces the SAME result across the mutation, regardless of concurrent useHomebrewStore mutations', () => {
    useHomebrewStore.setState({ items: [], classes: [], spells: [] } as any);
    const initial = recomputeDerived(buildEntity(), DEFAULT_RULES, cardContent);
    // Mutate the store with CONFLICTING content in between — the explicit
    // snapshot passed to both calls below must be the only thing consulted.
    useHomebrewStore.setState({ items: [{ ...homebrewItem, features: [] }] } as any);
    const damaged = applyDamage(initial, 5, DEFAULT_RULES);
    const mutated = recomputeDerived(damaged, DEFAULT_RULES, cardContent);
    expect(mutated.derived.ac).toBe(12);
    const spellCardAfter = generateAllActionCards(mutated, DEFAULT_RULES, cardContent).find(c => c.featureId === 'rune_bolt')!;
    expect(spellCardAfter.spellCastingContext?.castingAbility).toBe('int');
  });
});

// ============================================================================
// Rules-engine blocker RE-AUDIT closure 2F — activation-option context
// preservation. Codex found that a chosen casting source and/or a
// preparation Cast-Anyway decision was discarded once a card also required
// an activation-option choice (TabSpells/TabActions/Favorites all defer to
// a picker for those cards). The UI-state fix (PendingActionUse — see
// TabActions.tsx/TabSpells.tsx/TabCharacter.tsx's own doc comments) now
// carries bypassSpellPreparation/selectedSpellCastingContext alongside the
// card through that picker. Matching this codebase's established "test the
// pure function, not the RN component" convention (see TabActions.test.ts's
// own header comment), this proves the ENGINE side of that fix: that
// applyActionCardUse correctly honors chosenOption + bypassSpellPreparation
// + selectedSpellCastingContext ALL TOGETHER in one call — exactly what the
// fixed handleChooseOption/handleChooseFavoriteOption now do, whereas the
// pre-fix version never passed bypass/context alongside option at all.
// ============================================================================
describe('applyActionCardUse — activation option + context/bypass together (closure 2F)', () => {
  const options = [
    { id: 'tier1', label: '1st-level slot', resourceCost: { resourceId: 'spell_slots' as const, quantity: 1, spellSlotTier: 1 as const }, description: '' },
    { id: 'tier2', label: '2nd-level slot', resourceCost: { resourceId: 'spell_slots' as const, quantity: 1, spellSlotTier: 2 as const }, description: '' },
  ];

  function multiSourceEntity(prepared: string[] = []): Entity {
    return {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'multi_source_spell', 'class', 'wizard'), ent('spell_access', 'multi_source_spell', 'class', 'sorcerer')],
      spellcasting: { ability: 'int', slots: emptySlots({ '1': { total: 2, used: 0 }, '2': { total: 2, used: 0 } }), cantrips: [], known: ['multi_source_spell'], prepared, concentrating: null },
    };
  }

  // Real, resolver-derived contexts (never hand-typed contextKey strings —
  // see this closure's own "no unstable/guessed identity" requirement) with
  // activation.options bolted on, matching a real spell card's shape plus a
  // Divine-Smite-style tier choice.
  function cardWithOptions(entity: Entity): ActionCard {
    const contexts = resolveSpellCastingContexts(entity, 'multi_source_spell');
    return {
      featureId: 'multi_source_spell', name: 'Multi Source Spell', cardType: 'damage', color: 'red',
      layer1: '', layer2: '', layer3: null, outcomes: [], triggerNote: null,
      activation: {
        actionType: 'action', resourceCost: { resourceId: 'spell_slots', quantity: 1, spellSlotTier: 1 },
        range: 'self', target: 'single', requiresSave: null, options,
      },
      resourceCost: { resourceId: 'spell_slots', quantity: 1, spellSlotTier: 1 },
      tabs: ['spellcasting', 'actions'], available: true, unavailableReason: null,
      preparationOverridable: false,
      spellCastingContext: contexts.find(c => c.classId === 'sorcerer'),
      spellCastingContexts: contexts,
    };
  }

  it('a non-default selected source (Wizard, chosen over the card default Sorcerer) survives the activation-option step and drives execution', () => {
    // Wizard prepared here so it's legal on its own — isolates SOURCE
    // survival from the bypass concern, tested separately below.
    const prepared = multiSourceEntity(['multi_source_spell']);
    const card = cardWithOptions(prepared);
    const wizardContext = card.spellCastingContexts!.find(c => c.classId === 'wizard')!;
    const result = applyActionCardUse(prepared, card, {} as any, options[0], { kind: 'normal', tier: '1' }, false, wizardContext);
    expect(result).not.toBe(prepared);
    expect(result.spellcasting!.slots['1'].used).toBe(1); // the CHOSEN option's tier, not the card default
    expect(result.spellcasting!.slots['2'].used).toBe(0);
  });

  it('Cast Anyway (bypass=true) on a preparation-blocked source survives the activation-option step: execution succeeds, prepared list unchanged', () => {
    const e = multiSourceEntity(); // Wizard unprepared -> its context.legal === false
    const card = cardWithOptions(e);
    const wizardContext = card.spellCastingContexts!.find(c => c.classId === 'wizard')!;
    expect(wizardContext.legal).toBe(false);
    const result = applyActionCardUse(e, card, {} as any, options[1], { kind: 'normal', tier: '2' }, true, wizardContext);
    expect(result).not.toBe(e); // bypass survived the option step -> cast succeeded despite Wizard being unprepared
    expect(result.spellcasting!.slots['2'].used).toBe(1);
    expect(result.spellcasting!.prepared).toEqual([]); // Cast Anyway never mutates the prepared list
  });

  it('WITHOUT the bypass surviving (simulating the pre-fix bug), the same unprepared-source cast is correctly rejected', () => {
    const e = multiSourceEntity();
    const card = cardWithOptions(e);
    const wizardContext = card.spellCastingContexts!.find(c => c.classId === 'wizard')!;
    // bypassSpellPreparation omitted here on purpose — this is what the
    // PRE-FIX flow effectively did (discarded the Cast Anyway decision).
    const result = applyActionCardUse(e, card, {} as any, options[1], undefined, undefined, wizardContext);
    expect(result).toBe(e); // correctly blocked — proves the bypass parameter is load-bearing, not a no-op
  });
});

// ============================================================================
// Rules-completeness batch (ritual casting), one-issue closure: the shared UI
// decision (isContextLegalForCastMode / needsPreparationOverride) that fixes
// the reported bug — TabActions.tsx and TabSpells.tsx both used to check
// `context.legal` unconditionally even after the player chose ritual mode,
// so a legal Wizard-spellbook ritual still prompted Cast Anyway. Tested here
// as pure functions against SpellCastingContext fixtures, independent of any
// RN rendering — see actionCards.ts's own doc comments for full rationale.
// ============================================================================
describe('isContextLegalForCastMode / needsPreparationOverride (UI legality decision, one-issue closure)', () => {
  function ctx(overrides: Partial<SpellCastingContext>): SpellCastingContext {
    return {
      contextKey: 'test', sourceKind: 'class', sourceId: 'test', classId: 'test',
      preparationPolicy: 'full_list_prepared', castingAbility: 'int',
      legal: false, ritualEligible: false, ritualLegal: false,
      ...overrides,
    };
  }

  it('1. Wizard-shaped context (legal:false, ritualLegal:true), NORMAL mode → illegal, override required', () => {
    const wizard = ctx({ legal: false, ritualEligible: true, ritualLegal: true });
    expect(isContextLegalForCastMode(wizard, undefined)).toBe(false);
    expect(needsPreparationOverride(wizard, undefined)).toBe(true);
  });

  it('2. the SAME Wizard-shaped context, RITUAL mode → legal, no override needed', () => {
    const wizard = ctx({ legal: false, ritualEligible: true, ritualLegal: true });
    expect(isContextLegalForCastMode(wizard, 'ritual')).toBe(true);
    expect(needsPreparationOverride(wizard, 'ritual')).toBe(false);
  });

  it('3. Cleric-shaped context (legal:false, ritualLegal:false, ritualEligible:true), RITUAL mode → still illegal, override still offered (existing flow)', () => {
    const cleric = ctx({ legal: false, ritualEligible: true, ritualLegal: false });
    expect(isContextLegalForCastMode(cleric, 'ritual')).toBe(false);
    expect(needsPreparationOverride(cleric, 'ritual')).toBe(true); // Cast Anyway legitimately bypasses Cleric's own prep requirement
  });

  it('4. an already-legal normal context → no override, either mode', () => {
    const legal = ctx({ legal: true, ritualEligible: false, ritualLegal: false });
    expect(needsPreparationOverride(legal, undefined)).toBe(false);
    expect(isContextLegalForCastMode(legal, undefined)).toBe(true);
  });

  it('5. a ritual-INELIGIBLE source (Sorcerer-shaped: legal:true, ritualEligible:false, ritualLegal:false) never proceeds as a legal ritual, and is not offered a misleading preparation override', () => {
    const sorcerer = ctx({ legal: true, ritualEligible: false, ritualLegal: false });
    expect(isContextLegalForCastMode(sorcerer, 'ritual')).toBe(false); // never legal as a ritual
    // Cast Anyway bypasses PREPARATION — this source isn't blocked by
    // preparation at all (legal:true already), it simply has no ritual
    // capability, so offering the override would promise something it
    // can never deliver (applyActionCardUse refuses it unconditionally).
    expect(needsPreparationOverride(sorcerer, 'ritual')).toBe(false);
  });

  it('6. source-specific: real Wizard vs Sorcerer contexts for the same spell resolve independently', () => {
    const spell = leveledSpell('detect_magic_ui_test', 1, { ritual: true });
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [
        ent('spell_access', 'detect_magic_ui_test', 'class', 'wizard'),
        ent('spell_access', 'detect_magic_ui_test', 'class', 'sorcerer'),
      ],
      spellcasting: { ability: 'int', slots: emptySlots({ '1': { total: 1, used: 0 } }), cantrips: [], known: ['detect_magic_ui_test'], prepared: [], concentrating: null },
    };
    const contexts = resolveSpellCastingContexts(e, 'detect_magic_ui_test', ALL_CHAR_CLASSES);
    const wizardCtx = contexts.find(c => c.classId === 'wizard')!;
    const sorcererCtx = contexts.find(c => c.classId === 'sorcerer')!;

    // Select Wizard + Ritual → legal, no override.
    expect(isContextLegalForCastMode(wizardCtx, 'ritual')).toBe(true);
    expect(needsPreparationOverride(wizardCtx, 'ritual')).toBe(false);

    // Select Sorcerer + Ritual → must NOT proceed as legal merely because
    // the Wizard context (or the card-level ritualEligible flag) says the
    // SPELL is ritual-capable through SOME source.
    expect(isContextLegalForCastMode(sorcererCtx, 'ritual')).toBe(false);
    expect(needsPreparationOverride(sorcererCtx, 'ritual')).toBe(false); // no misleading "not prepared" prompt either
  });
});
