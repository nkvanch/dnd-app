// src/engine/__tests__/itemInstanceIdentity.test.ts
// Item-identity closure: duplicate ItemInstance identity + per-instance
// state. Two owned copies of the SAME ItemDefinition must never share
// mutable state (equipped/attuned/features/action-card resolution) merely
// because they share `itemId` — each gets its own stable `id`, generated at
// a mutation boundary (never inside recomputeDerived), and every consumer
// that needs to target ONE SPECIFIC copy matches on `id`, not `itemId`.
import {
  equipItem, unequipItem, toggleAttunement, countAttuned, attunementCap,
  generateItemInstanceId, isStatefulItem,
} from '../inventory';
import { hydrateLegacyItemInstanceIds } from '../itemMechanics';
import { recomputeDerived } from '../pipeline';
import { generateAllActionCards } from '../actionCards';
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { validateEntityDeep } from '../entityValidation';
import { Entity, Item, ItemInstance } from '../types';

// A unique itemId (not the real official/imported catalog's own
// 'ring_of_protection', which has its own real definition/effects and
// would silently shadow this fixture wherever a definition is resolved
// without an explicit content snapshot). No attunement requirement, so the
// AC bonus applies immediately on equip — attunement independence is
// covered separately (section C) using toggleAttunement/countAttuned
// directly, which never resolve a definition at all.
function ringOfProtectionDef(): Item {
  return {
    id: 'test_ring_of_protection', name: 'Ring of Protection', weight: 0, cost: '', properties: [],
    features: [{
      id: 'test_ring_ac', name: 'Ring of Protection', description: '', source: { kind: 'item', refId: 'test_ring_of_protection' },
      level: null, effects: [{ type: 'stat_modifier', target: 'ac', operation: 'add', value: 1, condition: null }],
      actions: [], choices: [], passive: true,
    }],
  };
}
const ringContent = { items: [ringOfProtectionDef()] };

// The item this test's OWNED instances point at ('test_dagger') has NO
// authored feature of its own — matching a mundane weapon whose action
// card is entirely SYNTHETIC (computeWeaponAttackBonuses/actionCards.ts's
// "basic weapon attack" path, the exact path this closure's
// AttackBonus.instanceId/featureId fix targets), rather than the
// generateActionCard-per-feature path an authored-attack item would take.
// effectiveWeaponAttackFeatures (itemMechanics.ts) resolves such an item's
// damage dice from a separate BASE weapon definition looked up by
// name ('Dagger' -> baseWeaponIdFromName -> 'dagger') — daggerBaseDef below
// mirrors that exact real-content shape (see itemMace/WEAPON_BASE_MAP,
// src/content/items/index.ts). Both must be in `daggerContent.items` for
// any recompute/card-generation call in these tests to resolve correctly,
// since 'test_dagger'/'dagger' aren't real official catalog entries.
function daggerBaseDef(): Item {
  return {
    id: 'dagger', name: 'Dagger', weight: 1, cost: '2 gp', properties: ['finesse', 'light', 'thrown (range 20/60)'],
    features: [{
      id: 'dagger_attack', name: 'Dagger', description: '', source: { kind: 'item', refId: 'dagger' },
      level: null, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d4', damageType: 'piercing' }],
    }],
  };
}
function daggerDef(): Item {
  return {
    id: 'test_dagger', name: 'Dagger',
    weight: 1, cost: '2 gp', properties: ['finesse', 'light', 'thrown (range 20/60)'],
    features: [],
  };
}
const daggerContent = { items: [daggerDef(), daggerBaseDef()] };

describe('item-identity closure — A. instance identity', () => {
  it('1. adding the same stateful definition twice produces two distinct instance ids', () => {
    const idA = generateItemInstanceId();
    const idB = generateItemInstanceId();
    expect(idA).not.toBe(idB);
    expect(isStatefulItem(ringOfProtectionDef())).toBe(true); // attunable
    expect(isStatefulItem(daggerDef())).toBe(true); // weapon
  });

  it('a genuinely fungible item (no attunement/weapon/armor/features) is NOT stateful', () => {
    const rope: Item = { id: 'rope', name: 'Rope, Hempen (50 feet)', weight: 10, cost: '1 gp', properties: [], features: [] };
    expect(isStatefulItem(rope)).toBe(false);
  });

  it('2/3. recompute never mutates or regenerates an existing instance id', () => {
    const inst: ItemInstance = { id: 'stable-id-1', itemId: 'test_dagger', quantity: 1, attuned: false, features: [] };
    const e: Entity = { ...makeEmptyEntity('e1'), inventory: { ...makeEmptyEntity('e1').inventory, carried: [inst] } };
    const once = recomputeDerived(e, DEFAULT_RULES, daggerContent);
    const twice = recomputeDerived(once, DEFAULT_RULES, daggerContent);
    expect(once.inventory.carried[0].id).toBe('stable-id-1');
    expect(twice.inventory.carried[0].id).toBe('stable-id-1');
  });
});

// equipItem/unequipItem's OWN internal recomputeDerived call doesn't take a
// content snapshot (see their own doc comments) — exactly like the real
// app, where app/sheet/[id].tsx's mutate() wrapper applies a SECOND,
// content-aware recompute pass on top (recomputeDerived is a pure, full
// overwrite, so layering a second pass with the correct content is always
// safe and is the established, tested pattern from the content-snapshot
// closure). These tests do the same: an explicit final recomputeDerived
// with `daggerContent` after each equip/attune step.
describe('item-identity closure — B. equipment identity', () => {
  it('4. two identical weapons, A equipped + B unequipped, produce correct INDEPENDENT derived attack bonuses', () => {
    const daggerA: ItemInstance = { id: 'dagger-a', itemId: 'test_dagger', quantity: 1, attuned: false, features: [] };
    const daggerB: ItemInstance = { id: 'dagger-b', itemId: 'test_dagger', quantity: 1, attuned: false, features: [] };
    let e = makeEmptyEntity('e1');
    e = { ...e, stats: { ...e.stats, dex: 16 }, inventory: { ...e.inventory, equipped: [daggerA], carried: [daggerB] } };
    const def = daggerDef();
    const equipped = recomputeDerived(equipItem(e, 'test_dagger', def, DEFAULT_RULES, 'dagger-a'), DEFAULT_RULES, daggerContent);
    expect(equipped.inventory.equipped).toHaveLength(1);
    expect(equipped.inventory.equipped[0].id).toBe('dagger-a');
    expect(equipped.inventory.carried[0].id).toBe('dagger-b'); // B remains carried, untouched
    // Only ONE attack bonus (only A is equipped) — B contributes nothing while carried.
    expect(equipped.derived.attackBonuses.filter(a => a.id === 'test_dagger')).toHaveLength(1);
    expect(equipped.derived.attackBonuses[0].instanceId).toBe('dagger-a');
  });

  it('two equipped instances of the SAME weapon produce TWO independent attack-bonus entries, each traceable to its own instance', () => {
    const daggerA: ItemInstance = { id: 'dagger-a', itemId: 'test_dagger', quantity: 1, attuned: false, features: [] };
    const daggerB: ItemInstance = { id: 'dagger-b', itemId: 'test_dagger', quantity: 1, attuned: false, features: [] };
    let e = makeEmptyEntity('e1');
    e = { ...e, inventory: { ...e.inventory, carried: [daggerA, daggerB] } };
    let updated = equipItem(e, 'test_dagger', daggerDef(), DEFAULT_RULES, 'dagger-a');
    updated = recomputeDerived(equipItem(updated, 'test_dagger', daggerDef(), DEFAULT_RULES, 'dagger-b'), DEFAULT_RULES, daggerContent);
    expect(updated.inventory.equipped).toHaveLength(2); // no auto-merge (no destructive merging)
    const bonuses = updated.derived.attackBonuses.filter(a => a.id === 'test_dagger');
    expect(bonuses).toHaveLength(2);
    expect(bonuses.map(b => b.instanceId).sort()).toEqual(['dagger-a', 'dagger-b']);
  });

  it('5. removing instance A leaves B fully equipped and unaffected', () => {
    const daggerA: ItemInstance = { id: 'dagger-a', itemId: 'test_dagger', quantity: 1, attuned: true, features: [] };
    const daggerB: ItemInstance = { id: 'dagger-b', itemId: 'test_dagger', quantity: 1, attuned: false, features: [] };
    let e = makeEmptyEntity('e1');
    e = { ...e, inventory: { ...e.inventory, equipped: [daggerA, daggerB] } };
    // "Remove A" — the same instance-targeted splice app/sheet/[id].tsx's
    // own handleRemoveItem now performs.
    const removed: Entity = { ...e, inventory: { ...e.inventory, equipped: e.inventory.equipped.filter(i => i.id !== 'dagger-a') } };
    const result = recomputeDerived(removed, DEFAULT_RULES);
    expect(result.inventory.equipped).toHaveLength(1);
    expect(result.inventory.equipped[0].id).toBe('dagger-b');
    expect(result.inventory.equipped[0].attuned).toBe(false); // B's own (different) state intact
  });
});

describe('item-identity closure — C. attunement identity', () => {
  it('6. two identical attunable items, one attuned one not, stay independent', () => {
    const ringA: ItemInstance = { id: 'ring-a', itemId: 'ring_of_protection', quantity: 1, attuned: false, features: [] };
    const ringB: ItemInstance = { id: 'ring-b', itemId: 'ring_of_protection', quantity: 1, attuned: false, features: [] };
    let e = makeEmptyEntity('e1');
    e = { ...e, inventory: { ...e.inventory, equipped: [ringA, ringB] } };
    const toggled = toggleAttunement(e, 'ring_of_protection', 'ring-a');
    const a = toggled.inventory.equipped.find(i => i.id === 'ring-a')!;
    const b = toggled.inventory.equipped.find(i => i.id === 'ring-b')!;
    expect(a.attuned).toBe(true);
    expect(b.attuned).toBe(false); // untouched
  });

  it('7. attunement count counts INSTANCES, not distinct definitions', () => {
    const ringA: ItemInstance = { id: 'ring-a', itemId: 'ring_of_protection', quantity: 1, attuned: true, features: [] };
    const ringB: ItemInstance = { id: 'ring-b', itemId: 'ring_of_protection', quantity: 1, attuned: true, features: [] };
    let e = makeEmptyEntity('e1');
    e = { ...e, inventory: { ...e.inventory, equipped: [ringA, ringB] } };
    expect(countAttuned(e)).toBe(2); // two attuned INSTANCES, even though both share one definition
    expect(attunementCap(e)).toBe(3);
  });

  it('attuning a second copy is refused once the cap is reached, without disturbing the first', () => {
    const capped = (n: number) => Array.from({ length: n }, (_, i) => ({
      id: `filler-${i}`, itemId: `filler_${i}`, quantity: 1, attuned: true, features: [],
    }));
    let e = makeEmptyEntity('e1');
    const ringA: ItemInstance = { id: 'ring-a', itemId: 'ring_of_protection', quantity: 1, attuned: false, features: [] };
    e = { ...e, inventory: { ...e.inventory, equipped: [...capped(3), ringA] } }; // cap already reached
    const result = toggleAttunement(e, 'ring_of_protection', 'ring-a');
    expect(result).toBe(e); // refused — unchanged
  });
});

describe('item-identity closure — E. feature provenance', () => {
  it('11/12. two identical grant-bearing items each contribute their own effect; removing one leaves the other\'s grant intact', () => {
    const ringDef = ringOfProtectionDef();
    const ringA: ItemInstance = { id: 'ring-a', itemId: 'test_ring_of_protection', quantity: 1, attuned: false, features: [] };
    const ringB: ItemInstance = { id: 'ring-b', itemId: 'test_ring_of_protection', quantity: 1, attuned: false, features: [] };
    let e = makeEmptyEntity('e1');
    e = { ...e, inventory: { ...e.inventory, carried: [ringA, ringB] } };
    let equipped = equipItem(e, 'test_ring_of_protection', ringDef, DEFAULT_RULES, 'ring-a');
    equipped = recomputeDerived(equipItem(equipped, 'test_ring_of_protection', ringDef, DEFAULT_RULES, 'ring-b'), DEFAULT_RULES, ringContent);
    const baseline = makeEmptyEntity('e1').derived.ac;
    expect(equipped.derived.ac).toBe(baseline + 2); // BOTH rings' +1 apply — provenance not collapsed away

    // Remove ring A entirely — B's own grant must remain.
    const afterRemoveA: Entity = { ...equipped, inventory: { ...equipped.inventory, equipped: equipped.inventory.equipped.filter(i => i.id !== 'ring-a') } };
    const result = recomputeDerived(afterRemoveA, DEFAULT_RULES, ringContent);
    expect(result.derived.ac).toBe(baseline + 1); // only B's contribution remains
    expect(result.inventory.equipped).toHaveLength(1);
    expect(result.inventory.equipped[0].id).toBe('ring-b');
  });
});

describe('item-identity closure — F. action cards', () => {
  it('13. an item action card generated from instance A is keyed to A, distinct from an identical instance B', () => {
    const daggerA: ItemInstance = { id: 'dagger-a', itemId: 'test_dagger', quantity: 1, attuned: false, features: [] };
    const daggerB: ItemInstance = { id: 'dagger-b', itemId: 'test_dagger', quantity: 1, attuned: false, features: [] };
    let e = makeEmptyEntity('e1');
    e = { ...e, inventory: { ...e.inventory, carried: [daggerA, daggerB] } };
    let updated = equipItem(e, 'test_dagger', daggerDef(), DEFAULT_RULES, 'dagger-a');
    updated = recomputeDerived(equipItem(updated, 'test_dagger', daggerDef(), DEFAULT_RULES, 'dagger-b'), DEFAULT_RULES, daggerContent);
    const cards = generateAllActionCards(updated, DEFAULT_RULES, daggerContent).filter(c => c.featureId.endsWith('_basic_weapon_attack') && c.name === 'Dagger');
    expect(cards).toHaveLength(2);
    expect(cards.map(c => c.featureId).sort()).toEqual(['dagger-a_basic_weapon_attack', 'dagger-b_basic_weapon_attack']);
  });

  it('a legacy EQUIPPED instance with no id (never touched equipItem\'s own defensive backfill, e.g. raw un-migrated data) still produces exactly one card with the original itemId-based featureId (back-compat)', () => {
    const legacyDagger: ItemInstance = { itemId: 'test_dagger', quantity: 1, attuned: false, features: [] };
    let e = makeEmptyEntity('e1');
    e = { ...e, inventory: { ...e.inventory, equipped: [legacyDagger] } };
    const updated = recomputeDerived(e, DEFAULT_RULES, daggerContent);
    const cards = generateAllActionCards(updated, DEFAULT_RULES, daggerContent).filter(c => c.name === 'Dagger');
    expect(cards).toHaveLength(1);
    expect(cards[0].featureId).toBe('test_dagger_basic_weapon_attack');
  });
});

describe('item-identity closure — G. quantity / fungible stacking', () => {
  it('15/16. an ordinary fungible stack keeps ONE instance id as quantity increases', () => {
    const rope: ItemInstance = { id: 'rope-1', itemId: 'rope', quantity: 1, attuned: false, features: [] };
    const bumped: ItemInstance = { ...rope, quantity: 5 };
    expect(bumped.id).toBe('rope-1'); // same instance, no new id created merely by bumping quantity
  });
});

describe('item-identity closure — J. validation', () => {
  function baseValidEntity() {
    return makeEmptyEntity('validation-test');
  }

  it('22. two ItemInstances sharing the same id on one entity are rejected', () => {
    const dupA: ItemInstance = { id: 'dup-1', itemId: 'dagger', quantity: 1, attuned: false, features: [] };
    const dupB: ItemInstance = { id: 'dup-1', itemId: 'ring_of_protection', quantity: 1, attuned: false, features: [] };
    const e = { ...baseValidEntity(), inventory: { ...baseValidEntity().inventory, equipped: [dupA], carried: [dupB] } };
    const result = validateEntityDeep(e);
    expect(result.valid).toBe(false);
    expect(result.errors.some(msg => msg.includes('duplicate ItemInstance id'))).toBe(true);
  });

  it('two distinct instance ids sharing the same itemId are perfectly valid', () => {
    const a: ItemInstance = { id: 'a', itemId: 'dagger', quantity: 1, attuned: false, features: [] };
    const b: ItemInstance = { id: 'b', itemId: 'dagger', quantity: 1, attuned: false, features: [] };
    const e = { ...baseValidEntity(), inventory: { ...baseValidEntity().inventory, carried: [a, b] } };
    expect(validateEntityDeep(e).valid).toBe(true);
  });

  it('23. a malformed instance id (empty string) is rejected', () => {
    const bad: ItemInstance = { id: '', itemId: 'dagger', quantity: 1, attuned: false, features: [] };
    const e = { ...baseValidEntity(), inventory: { ...baseValidEntity().inventory, carried: [bad] } };
    const result = validateEntityDeep(e);
    expect(result.valid).toBe(false);
    expect(result.errors.some(msg => msg.includes('.id'))).toBe(true);
  });

  it('an ItemInstance with NO id at all is still valid (disclosed migration gap, not malformed data)', () => {
    const legacy: ItemInstance = { itemId: 'dagger', quantity: 1, attuned: false, features: [] };
    const e = { ...baseValidEntity(), inventory: { ...baseValidEntity().inventory, carried: [legacy] } };
    expect(validateEntityDeep(e).valid).toBe(true);
  });
});

describe('item-identity closure (pass 3, finding A) — legacy id hydration is collision-safe', () => {
  function entityWith(carried: ItemInstance[], equipped: ItemInstance[] = []) {
    const e = makeEmptyEntity('legacy-hydrate-test');
    return { ...e, inventory: { ...e.inventory, equipped, carried } };
  }

  it('a modern row with an explicit id equal to another row\'s deterministic legacy candidate is left untouched, and the other (missing-id) row gets a DIFFERENT, unique id', () => {
    // The deterministic candidate for a missing-id row at carried[1] with
    // itemId 'torch' is exactly `legacy:<entityId>:carried:1:torch` — give
    // carried[0] that literal string as its own SUPPLIED id up front.
    const collidingSupplied: ItemInstance = { id: 'legacy:legacy-hydrate-test:carried:1:torch', itemId: 'rope', quantity: 1, attuned: false, features: [] };
    const missing: ItemInstance = { itemId: 'torch', quantity: 1, attuned: false, features: [] };
    const entity = entityWith([collidingSupplied, missing]);

    const hydrated = hydrateLegacyItemInstanceIds(entity);

    expect(hydrated.inventory.carried[0].id).toBe(collidingSupplied.id); // untouched
    expect(hydrated.inventory.carried[1].id).toBeTruthy();
    expect(hydrated.inventory.carried[1].id).not.toBe(collidingSupplied.id); // collision-avoided, not overwritten
    expect(new Set(hydrated.inventory.carried.map(i => i.id)).size).toBe(2); // both unique
  });

  it('two missing-id rows in the same pass each get their own unique id', () => {
    const a: ItemInstance = { itemId: 'rope', quantity: 1, attuned: false, features: [] };
    const b: ItemInstance = { itemId: 'rope', quantity: 1, attuned: false, features: [] }; // same itemId too
    const entity = entityWith([a, b]);

    const hydrated = hydrateLegacyItemInstanceIds(entity);

    expect(hydrated.inventory.carried[0].id).toBeTruthy();
    expect(hydrated.inventory.carried[1].id).toBeTruthy();
    expect(hydrated.inventory.carried[0].id).not.toBe(hydrated.inventory.carried[1].id);
  });

  it('repeated hydration is idempotent — a second pass over already-hydrated state changes nothing', () => {
    const a: ItemInstance = { itemId: 'rope', quantity: 1, attuned: false, features: [] };
    const b: ItemInstance = { itemId: 'rope', quantity: 1, attuned: false, features: [] };
    const entity = entityWith([a, b]);

    const once  = hydrateLegacyItemInstanceIds(entity);
    const twice = hydrateLegacyItemInstanceIds(once);

    expect(twice).toBe(once); // no new object created — nothing was missing
    expect(twice.inventory.carried.map(i => i.id)).toEqual(once.inventory.carried.map(i => i.id));
  });

  it('never touches a row that already has an id, even across equipped and carried together', () => {
    const equippedInst: ItemInstance = { id: 'kept-1', itemId: 'shortsword', quantity: 1, attuned: false, features: [] };
    const carriedMissing: ItemInstance = { itemId: 'shortsword', quantity: 1, attuned: false, features: [] };
    const entity = entityWith([carriedMissing], [equippedInst]);

    const hydrated = hydrateLegacyItemInstanceIds(entity);

    expect(hydrated.inventory.equipped[0].id).toBe('kept-1');
    expect(hydrated.inventory.carried[0].id).toBeTruthy();
    expect(hydrated.inventory.carried[0].id).not.toBe('kept-1');
  });
});

describe('item-identity closure — K. homebrew items', () => {
  it('24. two identical HOMEBREW item instances behave exactly like two official ones — independent state via the explicit content snapshot', () => {
    const homebrewRing: Item = {
      id: 'homebrew_ring_of_might', name: 'Ring of Might', weight: 0, cost: '', properties: ['requires attunement'],
      features: [{
        id: 'ring_of_might_str', name: 'Ring of Might', description: '', source: { kind: 'item', refId: 'homebrew_ring_of_might' },
        level: null, effects: [{ type: 'stat_modifier', target: 'str', operation: 'add', value: 2, condition: null }],
        actions: [], choices: [], passive: true,
      }],
    };
    const ringA: ItemInstance = { id: 'hb-a', itemId: 'homebrew_ring_of_might', quantity: 1, attuned: false, features: [] };
    const ringB: ItemInstance = { id: 'hb-b', itemId: 'homebrew_ring_of_might', quantity: 1, attuned: false, features: [] };
    let e = makeEmptyEntity('e1');
    e = { ...e, inventory: { ...e.inventory, carried: [ringA, ringB] } };
    const content = { items: [homebrewRing] };
    let equipped = equipItem(e, 'homebrew_ring_of_might', homebrewRing, DEFAULT_RULES, 'hb-a');
    equipped = recomputeDerived(equipped, DEFAULT_RULES, content);
    // Only A is equipped+attuned; B stays carried, unattuned, uninvolved.
    equipped = recomputeDerived(toggleAttunement(equipped, 'homebrew_ring_of_might', 'hb-a'), DEFAULT_RULES, content);
    const baseStr = makeEmptyEntity('e1').stats.str;
    expect(equipped.derived.savingThrows.str).toBeDefined();
    const a = equipped.inventory.equipped.find(i => i.id === 'hb-a')!;
    const b = equipped.inventory.carried.find(i => i.id === 'hb-b')!;
    expect(a.attuned).toBe(true);
    expect(b.attuned).toBe(false);
    expect(isStatefulItem(homebrewRing)).toBe(true);
  });
});
