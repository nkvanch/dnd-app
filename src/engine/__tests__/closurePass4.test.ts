import { makeEmptyEntity, DEFAULT_RULES, useCharacterStore } from '../../store/characterStore';
import { acquireClass, levelUpClass, applyGrant, resetCreationClass, resolveChoice, removeFeature, swapBackground } from '../leveling';
import { grantEntitlement, revokeEntitlementsFromSource, revokeResourceSource, setManualEntitlement } from '../entitlements';
import { recomputeDerived } from '../pipeline';
import { migrateEntity } from '../multiclass';
import { ALL_CHAR_CLASSES } from '../../content/classes';
import { getProgressionForClass } from '../../content/classes/progressions';
import { slotsFromCountArray, multiclassCasterLevel } from '../../content/classes/spellSlotTables';
import { legalSpellPaymentOptions, resolveDefaultPayment, commitSpellPayment } from '../spellPayment';
import { applyActionCardUse } from '../actionUse';
import { isFeatureAvailable } from '../actionCards';
import { Entity, EntitlementKind, CharClass, ActionCard, FeatureInstance, ChoiceDefinition, Background } from '../types';
import { startTurn } from '../combat';

const rules = { ...DEFAULT_RULES, hpMode: 'max' as const };
const cls = (id: string) => ALL_CHAR_CLASSES.find(c => c.id === id)!;
const advance = (e: Entity, c: CharClass, defs: readonly CharClass[] = ALL_CHAR_CLASSES) =>
  levelUpClass(e, c.id, getProgressionForClass(c), rules, c, defs);
function caster(): Entity {
  return { ...makeEmptyEntity('closure4'), spellcasting: { ability: 'int', slots: slotsFromCountArray(null),
    known: [], cantrips: [], prepared: [], concentrating: null } };
}
const recompute = (e: Entity) => recomputeDerived(e, rules);

describe('Closure 4 authoritative grants', () => {
  it.each([
    ['skill_proficiency', 'athletics'], ['skill_expertise', 'athletics'],
    ['tool_proficiency', 'Smith tools'], ['armor_proficiency', 'heavy'],
    ['weapon_proficiency', 'martial'], ['language', 'Elvish'],
    ['spell_access', 'magic_missile'], ['cantrip_access', 'fire_bolt'],
  ] as [EntitlementKind, string][])('%s is independent of intervening recompute', (kind, key) => {
    const granted = grantEntitlement(caster(), { kind, key, sourceKind: 'class', sourceId: 'source' });
    const once = recompute(revokeEntitlementsFromSource(granted, 'class', 'source'));
    const twice = recompute(revokeEntitlementsFromSource(recompute(granted), 'class', 'source'));
    expect(once).toEqual(twice);
    let repeated = recompute(granted);
    const expected = repeated;
    for (let i = 0; i < 5; i++) repeated = recompute(repeated);
    expect(repeated).toEqual(expected);
    // Compatibility output cannot reintroduce ownership after initialization.
    const corrupted = { ...granted, proficiencies: { ...granted.proficiencies, armor: ['invented'] } };
    expect(recompute(corrupted)).toEqual(expected);
  });
  it('resource removal is order-independent and retains another owner', () => {
    const grant = { kind: 'resource' as const, value: { resourceId: 'pool', name: 'Pool', maximum: 3, recharge: 'long_rest' } };
    const a = applyGrant(caster(), grant, 1, 'a');
    const both = applyGrant(a, grant, 1, 'b');
    expect(recompute(revokeResourceSource(a, 'class', 'a')))
      .toEqual(recompute(revokeResourceSource(recompute(a), 'class', 'a')));
    expect(revokeResourceSource(both, 'class', 'a').resources.custom).toHaveLength(1);
    expect(revokeResourceSource(revokeResourceSource(both, 'class', 'a'), 'class', 'b').resources.custom).toHaveLength(0);
  });
  it('manual edits remain authoritative and cannot erase another owner', () => {
    let e = recompute(caster());
    e = setManualEntitlement(e, 'skill_proficiency', 'athletics', true);
    expect(recompute(e).skills.skills.athletics.trained).toBe(true);
    e = grantEntitlement(e, { kind: 'skill_proficiency', key: 'athletics', sourceKind: 'class', sourceId: 'fighter' });
    e = setManualEntitlement(e, 'skill_proficiency', 'athletics', false);
    expect(recompute(e).skills.skills.athletics.trained).toBe(true);
    expect(recompute(revokeEntitlementsFromSource(e, 'class', 'fighter')).skills.skills.athletics.trained).toBe(false);
  });
  it('applyGrant proficiency projections do not create hidden ownership', () => {
    const e = applyGrant(caster(), { kind: 'proficiency', value: { armor: ['heavy'], weapons: ['martial'], tools: ['Smith tools'], languages: ['Elvish'] } }, 1, 'source');
    const immediate = recompute(revokeEntitlementsFromSource(e, 'class', 'source'));
    expect(immediate).toEqual(recompute(revokeEntitlementsFromSource(recompute(e), 'class', 'source')));
    expect(immediate.proficiencies.armor).toEqual([]);
  });
  it('preserves unknown historical grants as manual without adding class ownership', () => {
    const e = caster();
    e.proficiencies.armor = ['heavy'];
    e.spellcasting!.known = ['magic_missile'];
    const migrated = recompute(migrateEntity(e));
    expect(migrated.entitlements).toEqual(expect.arrayContaining([
      { kind: 'armor_proficiency', key: 'heavy', sourceKind: 'manual' },
      { kind: 'spell_access', key: 'magic_missile', sourceKind: 'manual' },
    ]));
    expect(recompute(migrateEntity(JSON.parse(JSON.stringify(migrated))))).toEqual(migrated);
  });
});

describe('Closure 4 micro-fix: generic choice provenance', () => {
  const genericChoice = (grant: ChoiceDefinition['grants'][number], kind: ChoiceDefinition['kind'] = 'tool'): ChoiceDefinition => ({
    id: 'generic_pick', prompt: 'Pick', kind, count: 1,
    pool: [{ id: 'pick', label: 'Pick', value: 'pick' }], grants: [grant], required: true, resolved: false,
  });
  const feature: FeatureInstance = { id: 'choice_feature', name: 'Choice Feature', description: '',
    source: { kind: 'feat' as const, refId: 'choice_feature' }, level: null,
    effects: [], actions: [], choices: [], passive: true, isActive: true };

  function featureChoice(grant: ChoiceDefinition['grants'][number], entity = caster()) {
    return { ...entity, features: [...entity.features, feature], choices: [...entity.choices, {
      id: 'choice_feature:generic_pick_1', definition: genericChoice(grant), grantedAt: 1,
      resolved: false, selections: [], sourceKind: 'feature' as const, sourceId: feature.id,
    }] };
  }

  it.each([
    ['proficiency', { kind: 'proficiency' as const, value: { tools: ['Choice Tool'] } }, 'tool_proficiency', 'Choice Tool'],
    ['known spell', { kind: 'known_spells' as const, value: { spellIds: ['choice_spell'] } }, 'spell_access', 'choice_spell'],
  ])('records and revokes feature-choice %s provenance', (_label, grant, entitlementKind, key) => {
    const resolved = resolveChoice(featureChoice(grant), 'choice_feature:generic_pick_1', ['pick'], rules);
    expect(resolved.entitlements).toContainEqual(expect.objectContaining({
      kind: entitlementKind, key, sourceKind: 'feature', sourceId: feature.id,
      choiceId: 'choice_feature:generic_pick_1',
    }));
    expect(removeFeature(resolved, feature.id).entitlements).not.toContainEqual(expect.objectContaining({ kind: entitlementKind, key }));
  });

  it('removes a generic feature-choice resource but preserves an overlapping independent grant', () => {
    let e = applyGrant(featureChoice({ kind: 'resource', value: { resourceId: 'choice_pool', name: 'Pool', maximum: 3, recharge: 'long_rest' } }),
      { kind: 'resource', value: { resourceId: 'choice_pool', name: 'Pool', maximum: 3, recharge: 'long_rest' } }, 1, undefined,
      { kind: 'class', id: 'survivor' });
    e = resolveChoice(e, 'choice_feature:generic_pick_1', ['pick'], rules);
    expect(e.entitlements).toContainEqual(expect.objectContaining({ kind: 'resource_grant', key: 'choice_pool',
      sourceKind: 'feature', sourceId: feature.id, choiceId: 'choice_feature:generic_pick_1' }));
    const removed = removeFeature(e, feature.id);
    expect(removed.resources.custom).toHaveLength(1);
    expect(removed.entitlements).toContainEqual(expect.objectContaining({ kind: 'resource_grant', sourceId: 'survivor' }));
  });

  it('revokes class-origin generic grants through creation class reset', () => {
    let e = acquireClass(caster(), cls('fighter'), rules);
    const choice = genericChoice({ kind: 'proficiency', value: { tools: ['Class Choice Tool'] } });
    e = { ...e, choices: [...e.choices, { id: 'fighter:generic_pick_1', definition: { ...choice, forClassId: 'fighter' },
      grantedAt: 1, resolved: false, selections: [], sourceKind: 'class', sourceId: 'fighter' }] };
    e = resolveChoice(e, 'fighter:generic_pick_1', ['pick'], rules);
    expect(e.proficiencies.tools).toContain('Class Choice Tool');
    expect(resetCreationClass(e, 6).entitlements).not.toContainEqual(expect.objectContaining({ key: 'Class Choice Tool' }));
  });

  it('revokes background-origin generic grants on background swap while retaining history', () => {
    const oldBg: Background = { id: 'old_bg', name: 'Old', features: [] };
    const newBg: Background = { id: 'new_bg', name: 'New', features: [] };
    let e: Entity = { ...caster(), identity: { ...caster().identity, backgroundId: oldBg.id }, choices: [{
      id: 'background_choice_tool_0', definition: genericChoice({ kind: 'proficiency', value: { tools: ['Background Tool'] } }),
      grantedAt: 0, resolved: false, selections: [], sourceKind: 'background' as const, sourceId: oldBg.id,
    }] };
    e = resolveChoice(e, 'background_choice_tool_0', ['pick'], rules);
    const swapped = swapBackground(e, newBg, rules);
    expect(swapped.proficiencies.tools).not.toContain('Background Tool');
    expect(swapped.choices.find(c => c.id === 'background_choice_tool_0')?.resolved).toBe(true);
  });
});

describe('Closure 4 micro-fix: resource upgrade ownership', () => {
  const resourceGrant = { kind: 'resource' as const, value: { resourceId: 'focus', name: 'Focus', maximum: 3, recharge: 'long_rest' } };
  const upgrade = (maximum: number) => ({ kind: 'resource_upgrade' as const, value: { resourceId: 'focus', newMaximum: maximum } });

  function baseResource() {
    const e = applyGrant(caster(), resourceGrant, 1, undefined, { kind: 'manual' });
    return { ...e, resources: { ...e.resources, custom: e.resources.custom.map(r => ({ ...r, current: 1 })) } };
  }

  it('derives base plus two owned upgrades and removes either without restoring spent state', () => {
    let e = applyGrant(baseResource(), upgrade(5), 2, undefined, { kind: 'feat', id: 'a' });
    e = applyGrant(e, upgrade(6), 3, undefined, { kind: 'feat', id: 'b' });
    expect(e.resources.custom[0]).toEqual(expect.objectContaining({ baseMaximum: 3, maximum: 6, current: 4 }));
    expect(e.entitlements).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'resource_upgrade', key: 'focus', sourceId: 'a', amount: 2 }),
      expect.objectContaining({ kind: 'resource_upgrade', key: 'focus', sourceId: 'b', amount: 1 }),
    ]));
    e = revokeResourceSource(e, 'feat', 'a');
    expect(e.resources.custom[0]).toEqual(expect.objectContaining({ maximum: 4, current: 2 }));
    e = revokeResourceSource(e, 'feat', 'b');
    expect(e.resources.custom[0]).toEqual(expect.objectContaining({ maximum: 3, current: 1 }));
  });

  it('clamps safely when removing an upgrade below the number already spent', () => {
    let e = applyGrant(baseResource(), upgrade(5), 2, undefined, { kind: 'feat', id: 'a' });
    e = { ...e, resources: { ...e.resources, custom: e.resources.custom.map(r => ({ ...r, current: 0 })) } };
    expect(revokeResourceSource(e, 'feat', 'a').resources.custom[0]).toEqual(expect.objectContaining({ maximum: 3, current: 0 }));
  });

  it('keeps a source-granted resource and upgrades while another compatible grant survives', () => {
    let e = applyGrant(caster(), resourceGrant, 1, undefined, { kind: 'class', id: 'owner_a' });
    e = applyGrant(e, resourceGrant, 1, undefined, { kind: 'class', id: 'owner_b' });
    e = applyGrant(e, upgrade(5), 2, undefined, { kind: 'feat', id: 'upgrade' });
    e = revokeResourceSource(e, 'class', 'owner_a');
    expect(e.resources.custom[0].maximum).toBe(5);
    e = revokeResourceSource(e, 'feat', 'upgrade');
    expect(e.resources.custom[0].maximum).toBe(3);
    expect(e.resources.custom).toHaveLength(1);
  });

  it('is recompute/JSON idempotent', () => {
    const e = applyGrant(baseResource(), upgrade(5), 2, undefined, { kind: 'feat', id: 'a' });
    expect(recompute(JSON.parse(JSON.stringify(e)))).toEqual(recompute(e));
    expect(recompute(recompute(e))).toEqual(recompute(e));
  });

  it('preserves upgrade ownership through undo and redo', () => {
    jest.useFakeTimers();
    const before = baseResource();
    const after = applyGrant(before, upgrade(5), 2, undefined, { kind: 'feat', id: 'a', choiceId: 'upgrade_choice' });
    useCharacterStore.setState({ characters: [before], undoStack: [], redoStack: [] });
    useCharacterStore.getState().updateCharacter(before.id, () => after);
    useCharacterStore.getState().undo();
    expect(useCharacterStore.getState().characters[0].resources.custom[0].maximum).toBe(3);
    useCharacterStore.getState().redo();
    expect(useCharacterStore.getState().characters[0]).toEqual(expect.objectContaining({
      entitlements: expect.arrayContaining([expect.objectContaining({
        kind: 'resource_upgrade', sourceId: 'a', choiceId: 'upgrade_choice', amount: 2,
      })]),
    }));
    jest.clearAllTimers(); jest.useRealTimers();
  });
});

describe('Closure 4 class acquisition and caster contribution', () => {
  it('Fighter first class has its full source-owned package, same as direct level operation', () => {
    const fighter = cls('fighter');
    const acquired = acquireClass(makeEmptyEntity('closure4'), fighter, rules);
    expect(acquired).toEqual(advance(makeEmptyEntity('closure4'), fighter));
    expect(acquired.proficiencies.armor).toEqual(expect.arrayContaining(['light', 'medium', 'heavy', 'shield']));
    expect(acquired.entitlements).toContainEqual({ kind: 'armor_proficiency', key: 'heavy', sourceKind: 'class', sourceId: 'fighter', choiceId: undefined });
    expect(acquireClass(acquired, fighter, rules)).toBe(acquired);
    expect(recompute(migrateEntity(JSON.parse(JSON.stringify(acquired))))).toEqual(acquired);
  });
  it('Wizard to Fighter grants only the reduced Fighter package', () => {
    const e = acquireClass(acquireClass(makeEmptyEntity('closure4'), cls('wizard'), rules), cls('fighter'), rules);
    expect(e.proficiencies.armor).toEqual(expect.arrayContaining(['light', 'medium', 'shield']));
    expect(e.proficiencies.armor).not.toContain('heavy');
    expect(e.choices.filter(c => c.sourceId === 'fighter' && ['skill', 'tool', 'equipment'].includes(c.definition.kind))).toEqual([]);
    expect(e.proficiencies.savingThrows).toEqual(['int', 'wis']);
  });
  it('creation reselection revokes only class-owned grants and retains racial spell access', () => {
    let e = acquireClass(caster(), cls('fighter'), rules);
    e = grantEntitlement(e, { kind: 'cantrip_access', key: 'fire_bolt', sourceKind: 'race', sourceId: 'elf' });
    e = grantEntitlement(e, { kind: 'armor_proficiency', key: 'heavy', sourceKind: 'manual' });
    e = acquireClass(resetCreationClass(e, 6), cls('wizard'), rules);
    expect(e.entitlements?.some(r => r.sourceId === 'fighter')).toBe(false);
    expect(e.proficiencies.armor).toEqual(['heavy']);
    expect(e.spellcasting!.cantrips).toContain('fire_bolt');
  });
  it('Fighter to Wizard adds no Wizard proficiency package', () => {
    const fighter = acquireClass(makeEmptyEntity('closure4'), cls('fighter'), rules);
    const e = acquireClass(fighter, cls('wizard'), rules);
    expect(e.proficiencies).toEqual(fighter.proficiencies);
    expect(e.entitlements?.filter(x => x.sourceId === 'wizard' && x.kind.includes('proficiency'))).toEqual([]);
  });
  it.each(['full', 'half'] as const)('existing homebrew %s contribution survives Fighter acquisition and leveling', style => {
    const homebrew: CharClass = { id: 'homebrew', name: 'Homebrew', hitDie: 8, features: [], spellcastingStyle: style, spellcastingAbility: 'int' };
    const definitions = [...ALL_CHAR_CLASSES, homebrew];
    let e = acquireClass(makeEmptyEntity('closure4'), homebrew, rules, definitions);
    for (let i = 1; i < 4; i++) e = advance(e, homebrew, definitions);
    e.spellcasting!.slots['1'].used = 2;
    e = acquireClass(e, cls('fighter'), rules, definitions);
    expect(e.spellcasting!.slots['1']).toEqual({ total: style === 'full' ? 4 : 3, used: 2 });
    expect(advance(e, cls('fighter'), definitions).spellcasting).toEqual(e.spellcasting);
    const mixed = acquireClass(e, cls('wizard'), rules, definitions);
    expect(mixed.spellcasting!.slots['1'].total).toBe(4);
  });
  it('official caster plus homebrew caster uses both current definitions', () => {
    const homebrew: CharClass = { id: 'homebrew', name: 'Homebrew', hitDie: 8, features: [], spellcastingStyle: 'full', spellcastingAbility: 'int' };
    const defs = [...ALL_CHAR_CLASSES, homebrew];
    const wizard = acquireClass(makeEmptyEntity('closure4'), cls('wizard'), rules, defs);
    const e = acquireClass(wizard, homebrew, rules, defs);
    expect(e.spellcasting!.slots['1'].total).toBe(3);
    expect(advance(e, cls('wizard'), defs).spellcasting!.slots['2'].total).toBe(2);
  });
  it('fixed starting tools and named weapons are source-owned', () => {
    const rogue = acquireClass(makeEmptyEntity('closure4'), cls('rogue'), rules);
    expect(rogue.proficiencies.tools).toContain("Thieves' Tools");
    expect(rogue.proficiencies.weapons).toContain('Rapier');
    expect(rogue.entitlements).toContainEqual(expect.objectContaining({ kind: 'tool_proficiency', sourceId: 'rogue' }));
  });
  it('noncaster plus noncaster has no normal slots', () => {
    const e = acquireClass(acquireClass(caster(), cls('fighter'), rules), cls('rogue'), rules);
    expect(Object.values(e.spellcasting!.slots).every(s => s.total === 0)).toBe(true);
  });
  it('official subclass third-caster fallback and explicit metadata precedence', () => {
    expect(multiclassCasterLevel([{ classId: 'fighter', subclassId: 'eldritch_knight', level: 6 }, { classId: 'wizard', level: 2 }])).toBe(4);
    expect(multiclassCasterLevel([{ classId: 'rogue', subclassId: 'arcane_trickster', level: 6 }])).toBe(2);
    expect(multiclassCasterLevel([{ classId: 'wizard', spellcastingStyle: 'half', level: 4 }])).toBe(2);
  });
});

describe('Closure 4 slot preservation', () => {
  it.each([1, 2])('Warlock with %i used keeps that count on Fighter acquisition and JSON reload', used => {
    let e = acquireClass(makeEmptyEntity('closure4'), cls('warlock'), rules);
    e = advance(e, cls('warlock'));
    e.spellcasting!.pactSlots!['1'].used = used;
    e = acquireClass(e, cls('fighter'), rules);
    expect(e.spellcasting!.pactSlots!['1']).toEqual({ total: 2, used });
    expect(migrateEntity(JSON.parse(JSON.stringify(e))).spellcasting).toEqual(e.spellcasting);
    expect(advance(e, cls('warlock')).spellcasting!.pactSlots!['2']).toEqual({ total: 2, used });
  });
  it('pact maximum reduction clamps rather than restoring', () => {
    let e = acquireClass(makeEmptyEntity('closure4'), cls('warlock'), rules);
    e.spellcasting!.pactSlots!['1'] = { total: 4, used: 4 };
    e = acquireClass(e, cls('fighter'), rules);
    expect(e.spellcasting!.pactSlots!['1']).toEqual({ total: 1, used: 1 });
  });
  it('normal same maximum preserves partial and exhausted spending', () => {
    for (const used of [3, 4]) {
      let e = acquireClass(makeEmptyEntity('closure4'), cls('wizard'), rules);
      e = advance(advance(e, cls('wizard')), cls('wizard'));
      e.spellcasting!.slots['1'].used = used;
      expect(advance(e, cls('wizard')).spellcasting!.slots['1']).toEqual({ total: 4, used });
    }
  });
  it('pact maximum growth does not restore spent slots', () => {
    let e = acquireClass(makeEmptyEntity('closure4'), cls('warlock'), rules);
    for (let i = 1; i < 10; i++) e = advance(e, cls('warlock'));
    e.spellcasting!.pactSlots!['5'].used = 1;
    expect(advance(e, cls('warlock')).spellcasting!.pactSlots!['5']).toEqual({ total: 3, used: 1 });
  });
  it.each([1, 2])('normal slots retain %i used during leveling and new tier acquisition', used => {
    let e = acquireClass(makeEmptyEntity('closure4'), cls('wizard'), rules);
    e.spellcasting!.slots['1'].used = used;
    e = advance(advance(e, cls('wizard')), cls('wizard'));
    expect(e.spellcasting!.slots['1']).toEqual({ total: 4, used });
    expect(e.spellcasting!.slots['2']).toEqual({ total: 2, used: 0 });
    expect(acquireClass(e, cls('fighter'), rules).spellcasting!.slots['1']).toEqual({ total: 4, used });
  });
  it.each([4, 5])('normal recalculation to maximum %i preserves three spent slots', total => {
    const previous = slotsFromCountArray([4, 0, 0, 0, 0, 0, 0, 0, 0]);
    previous['1'].used = 3;
    expect(slotsFromCountArray([total, 0, 0, 0, 0, 0, 0, 0, 0], previous)['1']).toEqual({ total, used: 3 });
  });
  it('normal maximum reduction and malformed negative spent counts clamp safely', () => {
    const previous = slotsFromCountArray([4, 0, 0, 0, 0, 0, 0, 0, 0]);
    previous['1'].used = 3; previous['2'].used = -2;
    const next = slotsFromCountArray([2, 1, 0, 0, 0, 0, 0, 0, 0], previous);
    expect(next['1']).toEqual({ total: 2, used: 2 });
    expect(next['2']).toEqual({ total: 1, used: 0 });
  });
});

function card(): ActionCard {
  return { featureId: 'test', name: 'Test', cardType: 'damage', color: 'red', layer1: '', layer2: '', layer3: null,
    outcomes: [], triggerNote: null, activation: { actionType: 'action', range: null, target: 'single', requiresSave: null,
      resourceCost: { resourceId: 'spell_slots', quantity: 1, spellSlotTier: 1 } },
    resourceCost: { resourceId: 'spell_slots', quantity: 1, spellSlotTier: 1 }, tabs: ['actions'], available: true, unavailableReason: null };
}
describe('Closure 4 selected payment', () => {
  it.each(['normal', 'pact'] as const)('selected %s debits exactly that pool with both available', kind => {
    const e = startTurn(caster());
    e.spellcasting!.slots['2'] = { total: 2, used: 0 };
    e.spellcasting!.pactSlots = slotsFromCountArray([0, 2, 0, 0, 0, 0, 0, 0, 0]);
    expect(legalSpellPaymentOptions(e.spellcasting!, 1)).toHaveLength(2);
    expect(resolveDefaultPayment(e.spellcasting!, 1)).toBeNull();
    expect(applyActionCardUse(e, card(), rules)).toBe(e);
    const next = applyActionCardUse(e, card(), rules, undefined, { kind, tier: '2' });
    expect(next.spellcasting!.slots['2'].used).toBe(kind === 'normal' ? 1 : 0);
    expect(next.spellcasting!.pactSlots!['2'].used).toBe(kind === 'pact' ? 1 : 0);
    expect(next.turnState!.actionUsed).toBe(true);
  });
  it('activation requirement accepts pact or higher normal payments', () => {
    const e = caster();
    e.spellcasting!.pactSlots = slotsFromCountArray([0, 2, 0, 0, 0, 0, 0, 0, 0]);
    const activation = { id: 'smite', label: 'Smite', resourceCost: card().resourceCost! };
    expect(applyActionCardUse(e, card(), rules, activation).spellcasting!.pactSlots!['2'].used).toBe(1);
    e.spellcasting!.slots['3'] = { total: 1, used: 0 };
    expect(applyActionCardUse(e, card(), rules, activation)).toBe(e);
    expect(applyActionCardUse(e, card(), rules, activation, { kind: 'normal', tier: '3' }).spellcasting!.slots['3'].used).toBe(1);
  });
  it('multiple higher normal tiers require selection; initiating exact tier is honored', () => {
    const e = caster();
    e.spellcasting!.slots['2'] = { total: 1, used: 0 };
    e.spellcasting!.slots['3'] = { total: 1, used: 0 };
    expect(resolveDefaultPayment(e.spellcasting!, 1)).toBeNull();
    const paid = commitSpellPayment(e, { kind: 'normal', tier: '3' });
    expect(paid.spellcasting!.slots['3'].used).toBe(1);
    expect(paid.spellcasting!.slots['2'].used).toBe(0);
    expect(commitSpellPayment(paid, { kind: 'normal', tier: '3' })).toBe(paid);
  });
  it('no legal payment blocks availability and commit without fallback', () => {
    const e = caster();
    expect(legalSpellPaymentOptions(e.spellcasting!, 1)).toEqual([]);
    const feature = { activation: card().activation } as FeatureInstance;
    expect(isFeatureAvailable(feature, e).available).toBe(false);
    expect(applyActionCardUse(e, card(), rules)).toBe(e);
    e.spellcasting!.slots['1'] = { total: 1, used: 0 };
    expect(isFeatureAvailable(feature, e).available).toBe(true);
    expect(commitSpellPayment(e, { kind: 'pact', tier: '1' })).toBe(e);
    expect(applyActionCardUse(e, card(), rules).spellcasting!.slots['1'].used).toBe(1);
  });
  it('Warlock/Fighter uses its pact payment and never a nonexistent normal pool', () => {
    const e = acquireClass(acquireClass(makeEmptyEntity('closure4'), cls('warlock'), rules), cls('fighter'), rules);
    const next = applyActionCardUse(e, card(), rules);
    expect(next.spellcasting!.pactSlots!['1'].used).toBe(1);
    expect(next.spellcasting!.slots['1'].used).toBe(0);
  });
  it('ordinary undo and redo preserve canonical inputs and spent pools', () => {
    jest.useFakeTimers();
    let before = acquireClass(acquireClass(makeEmptyEntity('closure4'), cls('warlock'), rules), cls('wizard'), rules);
    before = grantEntitlement(before, { kind: 'spell_access', key: 'magic_missile', sourceKind: 'class', sourceId: 'wizard' });
    before = applyGrant(before, { kind: 'resource', value: { resourceId: 'undo_pool', name: 'Pool', maximum: 2, recharge: 'long_rest' } }, 1, 'wizard');
    const after = commitSpellPayment(commitSpellPayment(acquireClass(before, cls('fighter'), rules),
      { kind: 'normal', tier: '1' }), { kind: 'pact', tier: '1' });
    useCharacterStore.setState({ characters: [before], undoStack: [], redoStack: [] });
    useCharacterStore.getState().updateCharacter(before.id, () => after);
    const saved = useCharacterStore.getState().characters[0];
    useCharacterStore.getState().undo();
    expect(useCharacterStore.getState().characters[0]).toEqual(before);
    useCharacterStore.getState().redo();
    expect(useCharacterStore.getState().characters[0]).toEqual(saved);
    jest.clearAllTimers(); jest.useRealTimers();
  });
});
