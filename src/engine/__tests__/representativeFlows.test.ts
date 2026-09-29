// src/engine/__tests__/representativeFlows.test.ts
// Pre-device closed-alpha readiness, Part 6: representative CREATE -> PLAY ->
// REST -> EXPORT/IMPORT flows for 7 character archetypes. No existing test
// exercises this full chain end-to-end for any archetype — coverage was
// fragmented across single-concern files. Every mutation below goes through
// a REAL exported engine function (never hand-simulated), and the one real,
// non-mocked persistence round-trip available in this test environment is
// serializePortableCharacter -> resolvePortableCharacterImport
// (characterPortable.ts) — the same "reload scenario" precedent used by
// extraAttackMultiattack.test.ts's F8/F9/B6 block, which this file follows
// in style: hand-rolled fixtures inline, no shared test helper/framework.
import {
  Entity, Item, ItemInstance, FeatureInstance, SpellSlots, EntitlementRecord,
  ChoiceDefinition, Spell, asClassId,
} from '../types';
import { recomputeDerived } from '../pipeline';
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { takeRest } from '../rest';
import { applyDamage } from '../combat';
import { equipItem } from '../inventory';
import { applyCondition } from '../conditions';
import { queueChoice, applyExpertiseChoiceToEntity } from '../leveling';
import { setManualEntitlement } from '../entitlements';
import { commitSpellPayment } from '../spellPayment';
import { generateSpellCard } from '../actionCards';
import { applyActionCardUse } from '../actionUse';
import { getClassLevels } from '../multiclass';
import { ALL_CHAR_CLASSES } from '../../content/classes';
import { serializePortableCharacter, resolvePortableCharacterImport } from '../../io/characterPortable';

function emptySlots(overrides: Partial<Record<keyof SpellSlots, { total: number; used: number }>> = {}): SpellSlots {
  const tiers = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
  const slots = {} as SpellSlots;
  for (const t of tiers) slots[t] = { total: 0, used: 0 };
  return { ...slots, ...overrides };
}

function ent(kind: 'spell_access' | 'cantrip_access', key: string, sourceKind: EntitlementRecord['sourceKind'], sourceId?: string): EntitlementRecord {
  return { kind, key, sourceKind, sourceId };
}

function leveledSpell(id: string, level: number, overrides: Partial<Spell> = {}): Spell {
  return {
    id, name: id, level, school: 'Evocation', castingTime: '1 action', range: '60 feet',
    components: ['V', 'S'], duration: 'Instantaneous', description: 'Test spell.',
    upcast: null, ritual: false, concentration: false,
    ...overrides,
  };
}

async function reload(entity: Entity) {
  const text = serializePortableCharacter(entity);
  return resolvePortableCharacterImport(text, [], jest.fn().mockResolvedValue(false));
}

// ============================================================================
// 1. Simple martial (Fighter-shaped, no spells)
// ============================================================================
describe('1. Simple martial (Fighter-shaped, no spells)', () => {
  it('take damage -> long rest fully heals -> HP survives export/import', async () => {
    const extraAttack: FeatureInstance = {
      id: 'fighter_extra_attack', name: 'Extra Attack', description: '',
      source: { kind: 'class', refId: 'fighter' }, level: 5,
      effects: [{ type: 'stat_modifier', target: 'extra_attack', operation: 'set', value: 1, condition: null }],
      actions: [], choices: [], passive: true, isActive: true,
    };
    let e: Entity = {
      ...makeEmptyEntity('martial-e1'),
      identity: { ...makeEmptyEntity('martial-e1').identity, classId: 'fighter', level: 5 },
      features: [extraAttack],
      resources: {
        ...makeEmptyEntity('martial-e1').resources,
        hp: { current: 30, maximum: 30, temp: 0 },
        hitDice: { die: 10, total: 5, remaining: 5 },
      },
    };
    e = recomputeDerived(e, DEFAULT_RULES);
    expect(e.derived.attackActionAttacks).toBe(2); // defining feature actually wired up

    // PLAY: take damage via the real combat primitive.
    e = applyDamage(e, 12, DEFAULT_RULES, 'slashing');
    expect(e.resources.hp.current).toBe(18);

    // REST: a long rest fully heals HP (rest.ts step 1 — verified in rest.test.ts).
    e = takeRest(e, 'long', DEFAULT_RULES);
    expect(e.resources.hp).toEqual({ current: 30, maximum: 30, temp: 0 });

    // EXPORT/IMPORT: HP survives a real serialize/parse round trip.
    const { entity: reloaded } = await reload(e);
    expect(reloaded.resources.hp).toEqual({ current: 30, maximum: 30, temp: 0 });
  });
});

// ============================================================================
// 2. Prepared caster (Cleric-shaped)
// ============================================================================
describe('2. Prepared caster (Cleric-shaped)', () => {
  it('prepared spell + slot spend -> long rest restores slots -> prepared state and slots survive export/import', async () => {
    let e: Entity = {
      ...makeEmptyEntity('cleric-e1'),
      identity: { ...makeEmptyEntity('cleric-e1').identity, classId: 'cleric', level: 3 },
      entitlements: [ent('spell_access', 'cure_wounds', 'class', 'cleric')],
      spellcasting: {
        ability: 'wis', slots: emptySlots({ '1': { total: 2, used: 0 } }),
        cantrips: [], known: ['cure_wounds'], prepared: ['cure_wounds'], concentrating: null,
      },
    };
    e = recomputeDerived(e, DEFAULT_RULES);
    // known is re-derived from the spell_access entitlement every recompute
    // (pipeline.ts); prepared is separate bookkeeping, untouched by that.
    expect(e.spellcasting!.known).toEqual(['cure_wounds']);
    expect(e.spellcasting!.prepared).toEqual(['cure_wounds']);

    // PLAY: cast the prepared spell by paying its real slot cost
    // (spellPayment.ts's own commit primitive — cheap, realistic stand-in
    // per the task's own fallback allowance).
    e = commitSpellPayment(e, { kind: 'normal', tier: '1' });
    expect(e.spellcasting!.slots['1'].used).toBe(1);

    // REST: long rest restores all spell slots (rest.ts step 4).
    e = takeRest(e, 'long', DEFAULT_RULES);
    expect(e.spellcasting!.slots['1'].used).toBe(0);

    // EXPORT/IMPORT
    const { entity: reloaded } = await reload(e);
    expect(reloaded.spellcasting!.prepared).toEqual(['cure_wounds']);
    expect(reloaded.spellcasting!.slots['1'].used).toBe(0);
  });
});

// ============================================================================
// 3. Wizard ritual casting
// ============================================================================
describe('3. Wizard ritual casting', () => {
  it('a ritual cast never consumes a slot -> the invariant holds through rest and export/import', async () => {
    const ritualSpell = leveledSpell('detect_magic', 1, { ritual: true, concentration: true });
    let e: Entity = {
      ...makeEmptyEntity('wizard-e1'),
      identity: { ...makeEmptyEntity('wizard-e1').identity, classId: 'wizard', level: 3 },
      entitlements: [ent('spell_access', 'detect_magic', 'class', 'wizard')],
      spellcasting: {
        ability: 'int', slots: emptySlots({ '1': { total: 2, used: 0 } }),
        cantrips: [], known: ['detect_magic'], prepared: [], concentrating: null,
      },
    };
    e = recomputeDerived(e, DEFAULT_RULES);
    const content = { classDefs: ALL_CHAR_CLASSES, homebrewSpells: [ritualSpell] };
    const card = generateSpellCard('detect_magic', e, content)!;
    expect(card.ritualEligible).toBe(true);

    // PLAY: a real ritual cast (A8 pattern, ritualUpcastHitDice.test.ts) —
    // legal straight from the spellbook, unprepared, no Cast Anyway needed.
    const afterCast = applyActionCardUse(e, card, DEFAULT_RULES, undefined, undefined, undefined, undefined, content, undefined, 'ritual');
    expect(afterCast).not.toBe(e);
    // Defining invariant: ritual casting never consumes a spell slot.
    expect(afterCast.spellcasting!.slots['1'].used).toBe(0);
    e = afterCast;

    // REST: long rest — nothing to restore, but exercised for the full flow.
    e = takeRest(e, 'long', DEFAULT_RULES);
    expect(e.spellcasting!.slots['1'].used).toBe(0);

    // EXPORT/IMPORT: the slot-count invariant still holds after reload.
    const { entity: reloaded } = await reload(e);
    expect(reloaded.spellcasting!.slots['1'].used).toBe(0);
  });
});

// ============================================================================
// 4. Duplicate/stateful items (item-instance identity)
// ============================================================================
describe('4. Duplicate/stateful items (item-instance identity)', () => {
  function testRingDef(): Item {
    return { id: 'test_ring_of_protection', name: 'Ring of Protection', weight: 0, cost: '', properties: [], features: [] };
  }

  it('two instances of the same item keep distinct ids and independent attunement through equip, rest, and export/import', async () => {
    const ringDef = testRingDef();
    const ringA: ItemInstance = { id: 'ring-a', itemId: 'test_ring_of_protection', quantity: 1, attuned: true, features: [] };
    const ringB: ItemInstance = { id: 'ring-b', itemId: 'test_ring_of_protection', quantity: 1, attuned: false, features: [] };
    let e: Entity = { ...makeEmptyEntity('item-e1'), inventory: { ...makeEmptyEntity('item-e1').inventory, carried: [ringA, ringB] } };
    e = recomputeDerived(e, DEFAULT_RULES);

    // PLAY: equip ring-b specifically, by instance id (inventory.ts).
    e = equipItem(e, 'test_ring_of_protection', ringDef, DEFAULT_RULES, 'ring-b');
    expect(e.inventory.equipped.map(i => i.id)).toEqual(['ring-b']);
    expect(e.inventory.carried.map(i => i.id)).toEqual(['ring-a']);
    expect(e.inventory.equipped.find(i => i.id === 'ring-b')!.attuned).toBe(false);
    expect(e.inventory.carried.find(i => i.id === 'ring-a')!.attuned).toBe(true);

    // REST: long rest should not disturb inventory at all.
    e = takeRest(e, 'long', DEFAULT_RULES);
    expect(e.inventory.equipped.map(i => i.id)).toEqual(['ring-b']);
    expect(e.inventory.carried.map(i => i.id)).toEqual(['ring-a']);

    // EXPORT/IMPORT: both instance ids preserved exactly, never regenerated
    // or merged, and the attunement flag stays on the correct instance.
    const { entity: reloaded } = await reload(e);
    expect(reloaded.inventory.equipped.map(i => i.id)).toEqual(['ring-b']);
    expect(reloaded.inventory.carried.map(i => i.id)).toEqual(['ring-a']);
    expect(reloaded.inventory.equipped.find(i => i.id === 'ring-b')!.attuned).toBe(false);
    expect(reloaded.inventory.carried.find(i => i.id === 'ring-a')!.attuned).toBe(true);
  });
});

// ============================================================================
// 5. Expertise (bonus skill proficiency)
// ============================================================================
describe('5. Expertise (bonus skill proficiency)', () => {
  it('a trained skill given Expertise keeps expertise:true through play, rest, and export/import', async () => {
    let e = makeEmptyEntity('expertise-e1');
    // Grant training first (setManualEntitlement, entitlements.ts) — a skill
    // must already be trained before Expertise can apply to it.
    e = recomputeDerived(setManualEntitlement(e, 'skill_proficiency', 'arcana', true), DEFAULT_RULES);
    expect(e.skills.skills.arcana.trained).toBe(true);

    // CREATE (cont'd): resolve a real Expertise choice (leveling.ts) onto
    // that trained skill.
    const choiceDef: ChoiceDefinition = {
      id: 'expertise_test', prompt: 'Choose 1 skill for Expertise.', kind: 'expertise',
      count: 1, pool: 'all', grants: [], required: true, resolved: false,
    };
    e = queueChoice(e, choiceDef, 1);
    e = applyExpertiseChoiceToEntity(e, 'expertise_test_1', ['arcana'], DEFAULT_RULES);
    expect(e.skills.skills.arcana.expertise).toBe(true);

    // PLAY: something trivial and real — expertise itself isn't "played".
    e = applyDamage(e, 2, DEFAULT_RULES);

    // REST: long rest should not disturb proficiency state.
    e = takeRest(e, 'long', DEFAULT_RULES);
    expect(e.skills.skills.arcana.expertise).toBe(true);

    // EXPORT/IMPORT
    const { entity: reloaded } = await reload(e);
    expect(reloaded.skills.skills.arcana.expertise).toBe(true);
    expect(reloaded.skills.skills.arcana.trained).toBe(true);
  });
});

// ============================================================================
// 6. Active condition through the flow
// ============================================================================
describe('6. Active condition through the flow', () => {
  it('an until_rest condition is actually removed by the long rest that ends it', () => {
    let e = makeEmptyEntity('cond-e1');
    // CREATE: apply a condition with a real, provable rest-ending duration.
    e = applyCondition(e, 'poisoned', 'trap_test', DEFAULT_RULES, undefined, { unit: 'until_rest', remaining: 0 });
    expect(e.conditionMonitor.active.map(c => c.id)).toEqual(['poisoned']);

    // PLAY: something trivial and real.
    e = applyDamage(e, 3, DEFAULT_RULES);

    // REST: long rest removes until_rest conditions (rest.ts step 6).
    e = takeRest(e, 'long', DEFAULT_RULES);
    expect(e.conditionMonitor.active).toHaveLength(0);
  });

  it('a still-active (permanent) condition applied AFTER a rest survives export/import intact, including its granted feature', async () => {
    let e = makeEmptyEntity('cond-e2');
    e = takeRest(e, 'long', DEFAULT_RULES); // nothing active yet — ordering matters

    const grantedFeature = [{
      id: 'cursed_ac_penalty', name: 'Cursed', description: '',
      source: { kind: 'condition' as const, refId: 'cursed' }, level: null,
      effects: [{ type: 'stat_modifier' as const, target: 'ac', operation: 'add' as const, value: -2, condition: null }],
      actions: [], choices: [], passive: true,
    }];
    e = applyCondition(e, 'cursed', 'curse_item', DEFAULT_RULES, grantedFeature, null); // permanent
    expect(e.conditionMonitor.active).toHaveLength(1);

    const { entity: reloaded } = await reload(e);
    expect(reloaded.conditionMonitor.active).toHaveLength(1);
    const cond = reloaded.conditionMonitor.active[0];
    expect(cond.id).toBe('cursed');
    expect(cond.sourceId).toBe('curse_item');
    expect(cond.duration).toBeNull();
    expect(reloaded.features.some(f => f.id === 'cursed_ac_penalty')).toBe(true);
  });
});

// ============================================================================
// 7. Multiclass
// ============================================================================
describe('7. Multiclass', () => {
  it('a Fighter 5 / Paladin 5 split survives play, rest, and export/import unchanged', async () => {
    let e: Entity = {
      ...makeEmptyEntity('mc-e1'),
      identity: {
        ...makeEmptyEntity('mc-e1').identity,
        classes: [
          { classId: asClassId('fighter'), subclassId: null, level: 5 },
          { classId: asClassId('paladin'), subclassId: null, level: 5 },
        ],
      },
      resources: { ...makeEmptyEntity('mc-e1').resources, hp: { current: 80, maximum: 80, temp: 0 } },
    };
    e = recomputeDerived(e, DEFAULT_RULES);
    expect(getClassLevels(e)).toEqual([
      { classId: 'fighter', subclassId: null, level: 5 },
      { classId: 'paladin', subclassId: null, level: 5 },
    ]);

    // PLAY: something trivial and real.
    e = applyDamage(e, 10, DEFAULT_RULES);
    expect(e.resources.hp.current).toBe(70);

    // REST
    e = takeRest(e, 'long', DEFAULT_RULES);
    expect(e.resources.hp.current).toBe(80);

    // EXPORT/IMPORT: the multiclass level breakdown survives unchanged.
    const { entity: reloaded } = await reload(e);
    expect(reloaded.identity.classes).toEqual([
      { classId: 'fighter', subclassId: null, level: 5 },
      { classId: 'paladin', subclassId: null, level: 5 },
    ]);
  });
});
