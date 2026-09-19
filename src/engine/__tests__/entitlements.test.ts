// src/engine/__tests__/entitlements.test.ts
// Closure pass 2 (source ownership): dedicated coverage for the pure
// entitlement primitives — grantEntitlement/revokeEntitlementsFromSource/
// revokeEntitlementsFromChoice/deriveProficienciesFromEntitlements — the
// building blocks recomputeDerived and leveling.ts's grant/removal
// functions are built on. See EntitlementRecord's own doc comment
// (engine/types.ts) for the full model.
import { makeEmptyEntity } from '../../store/characterStore';
import {
  grantEntitlement, grantEntitlements, revokeEntitlementsFromSource, revokeEntitlementsFromChoice,
  hasEntitlement, deriveProficienciesFromEntitlements, revokeResourceSource,
} from '../entitlements';
import { applyGrant } from '../leveling';

function entity() {
  return makeEmptyEntity('e1', 'character');
}

describe('grantEntitlement', () => {
  it('appends a new record', () => {
    const e = grantEntitlement(entity(), { kind: 'tool_proficiency', key: 'thieves_tools', sourceKind: 'class', sourceId: 'rogue' });
    expect(e.entitlements).toEqual([{ kind: 'tool_proficiency', key: 'thieves_tools', sourceKind: 'class', sourceId: 'rogue' }]);
  });

  it('is a no-op (dedupes) when the exact same record already exists', () => {
    const once = grantEntitlement(entity(), { kind: 'tool_proficiency', key: 'thieves_tools', sourceKind: 'class', sourceId: 'rogue' });
    const twice = grantEntitlement(once, { kind: 'tool_proficiency', key: 'thieves_tools', sourceKind: 'class', sourceId: 'rogue' });
    expect(twice.entitlements).toHaveLength(1);
  });

  it('treats the SAME key from a DIFFERENT source as a distinct record (overlapping sources)', () => {
    let e = grantEntitlement(entity(), { kind: 'tool_proficiency', key: 'smiths_tools', sourceKind: 'race', sourceId: 'dwarf' });
    e = grantEntitlement(e, { kind: 'tool_proficiency', key: 'smiths_tools', sourceKind: 'feat', sourceId: 'crafter' });
    expect(e.entitlements).toHaveLength(2);
  });
});

describe('manual/base grants survive source removal (closure item 2)', () => {
  it.each([
    ['skill_proficiency', 'perception'],
    ['tool_proficiency', 'thieves_tools'],
    ['armor_proficiency', 'heavy'],
    ['weapon_proficiency', 'longsword'],
    ['spell_access', 'chill_touch'],
    ['cantrip_access', 'minor_illusion'],
  ] as const)('%s: manual X + source A X -> remove A -> X remains', (kind, key) => {
    let e = entity();
    e = grantEntitlement(e, { kind, key, sourceKind: 'manual' });
    e = grantEntitlement(e, { kind, key, sourceKind: 'race', sourceId: 'dwarf' });
    e = revokeEntitlementsFromSource(e, 'race', 'dwarf');
    expect(hasEntitlement(e, kind, key)).toBe(true);
  });

  it('manual X + source A X + source B X -> remove A -> X remains -> remove B -> X still remains (manual) -> remove manual -> X disappears', () => {
    let e = entity();
    e = grantEntitlement(e, { kind: 'tool_proficiency', key: 'herbalism_kit', sourceKind: 'manual' });
    e = grantEntitlement(e, { kind: 'tool_proficiency', key: 'herbalism_kit', sourceKind: 'race', sourceId: 'human' });
    e = grantEntitlement(e, { kind: 'tool_proficiency', key: 'herbalism_kit', sourceKind: 'feat', sourceId: 'herbalist' });

    e = revokeEntitlementsFromSource(e, 'race', 'human');
    expect(hasEntitlement(e, 'tool_proficiency', 'herbalism_kit')).toBe(true);

    e = revokeEntitlementsFromSource(e, 'feat', 'herbalist');
    expect(hasEntitlement(e, 'tool_proficiency', 'herbalism_kit')).toBe(true); // manual still grants it

    e = revokeEntitlementsFromSource(e, 'manual');
    expect(hasEntitlement(e, 'tool_proficiency', 'herbalism_kit')).toBe(false);
  });
});

describe('spell/cantrip access ownership (closure pass 3, item 1)', () => {
  it('two sources grant Spell X -> remove A -> X remains -> remove B -> X disappears', () => {
    let e = entity();
    e = grantEntitlement(e, { kind: 'spell_access', key: 'chill_touch', sourceKind: 'race', sourceId: 'skeleton' });
    e = grantEntitlement(e, { kind: 'spell_access', key: 'chill_touch', sourceKind: 'subclass', sourceId: 'necromancer' });
    e = revokeEntitlementsFromSource(e, 'race', 'skeleton');
    expect(hasEntitlement(e, 'spell_access', 'chill_touch')).toBe(true);
    e = revokeEntitlementsFromSource(e, 'subclass', 'necromancer');
    expect(hasEntitlement(e, 'spell_access', 'chill_touch')).toBe(false);
  });

  it('manual Spell X + source A Spell X -> remove A -> manual Spell X remains', () => {
    let e = entity();
    e = grantEntitlement(e, { kind: 'spell_access', key: 'fireball', sourceKind: 'manual' });
    e = grantEntitlement(e, { kind: 'spell_access', key: 'fireball', sourceKind: 'item', sourceId: 'ring_of_fire' });
    e = revokeEntitlementsFromSource(e, 'item', 'ring_of_fire');
    expect(hasEntitlement(e, 'spell_access', 'fireball')).toBe(true);
  });
});

describe('overlapping content sources (closure item 3)', () => {
  it('race grants X + feat grants X -> remove race -> X remains -> remove feat -> X disappears', () => {
    let e = entity();
    e = grantEntitlement(e, { kind: 'language', key: 'elvish', sourceKind: 'race', sourceId: 'half_elf' });
    e = grantEntitlement(e, { kind: 'language', key: 'elvish', sourceKind: 'feat', sourceId: 'linguist' });

    e = revokeEntitlementsFromSource(e, 'race', 'half_elf');
    expect(hasEntitlement(e, 'language', 'elvish')).toBe(true);

    e = revokeEntitlementsFromSource(e, 'feat', 'linguist');
    expect(hasEntitlement(e, 'language', 'elvish')).toBe(false);
  });

  it('class + background overlap, and subclass + feature overlap, resolve independently', () => {
    let e = entity();
    e = grantEntitlement(e, { kind: 'skill_proficiency', key: 'insight', sourceKind: 'class', sourceId: 'monk' });
    e = grantEntitlement(e, { kind: 'skill_proficiency', key: 'insight', sourceKind: 'background', sourceId: 'hermit' });
    e = revokeEntitlementsFromSource(e, 'class', 'monk');
    expect(hasEntitlement(e, 'skill_proficiency', 'insight')).toBe(true); // background still grants it
    e = revokeEntitlementsFromSource(e, 'background', 'hermit');
    expect(hasEntitlement(e, 'skill_proficiency', 'insight')).toBe(false);
  });

  it('revoking a source only removes ITS OWN entries, never a same-key entry from another source', () => {
    let e = entity();
    e = grantEntitlement(e, { kind: 'armor_proficiency', key: 'shield', sourceKind: 'subclass', sourceId: 'battle_master' });
    e = grantEntitlement(e, { kind: 'armor_proficiency', key: 'heavy', sourceKind: 'subclass', sourceId: 'battle_master' });
    e = grantEntitlement(e, { kind: 'armor_proficiency', key: 'shield', sourceKind: 'class', sourceId: 'fighter' });
    e = revokeEntitlementsFromSource(e, 'subclass', 'battle_master');
    expect(hasEntitlement(e, 'armor_proficiency', 'heavy')).toBe(false);
    expect(hasEntitlement(e, 'armor_proficiency', 'shield')).toBe(true); // class's own grant untouched
  });
});

describe('revokeEntitlementsFromChoice (closure item 4)', () => {
  it('removes only the entitlement tagged with that choiceId, leaving an independent overlapping grant intact', () => {
    let e = entity();
    e = grantEntitlement(e, { kind: 'tool_proficiency', key: 'smiths_tools', sourceKind: 'class', sourceId: 'fighter', choiceId: 'c1' });
    e = grantEntitlement(e, { kind: 'tool_proficiency', key: 'smiths_tools', sourceKind: 'background', sourceId: 'guild_artisan' });
    e = revokeEntitlementsFromChoice(e, 'c1');
    expect(hasEntitlement(e, 'tool_proficiency', 'smiths_tools')).toBe(true); // background's independent grant remains
    expect(e.entitlements).toHaveLength(1);
  });

  it('is a no-op for an unrelated choiceId', () => {
    let e = entity();
    e = grantEntitlement(e, { kind: 'tool_proficiency', key: 'smiths_tools', sourceKind: 'class', sourceId: 'fighter', choiceId: 'c1' });
    e = revokeEntitlementsFromChoice(e, 'c2');
    expect(hasEntitlement(e, 'tool_proficiency', 'smiths_tools')).toBe(true);
  });
});

describe('deriveProficienciesFromEntitlements — idempotence (closure item 12)', () => {
  it('produces the same result no matter how many times it is called against the same entitlements', () => {
    let e = entity();
    e = grantEntitlements(e, [
      { kind: 'armor_proficiency', key: 'heavy', sourceKind: 'class', sourceId: 'fighter' },
      { kind: 'skill_proficiency', key: 'athletics', sourceKind: 'background', sourceId: 'soldier' },
      { kind: 'skill_expertise', key: 'athletics', sourceKind: 'feat', sourceId: 'skilled' },
      { kind: 'language', key: 'dwarvish', sourceKind: 'manual' },
    ]);
    const first  = deriveProficienciesFromEntitlements(e);
    const second = deriveProficienciesFromEntitlements(e);
    expect(second.armor).toEqual(first.armor);
    expect(second.languages).toEqual(first.languages);
    expect(Array.from(second.skills.trained)).toEqual(Array.from(first.skills.trained));
    expect(Array.from(second.skills.expertise)).toEqual(Array.from(first.skills.expertise));
  });

  it('dedupes the same key granted by two different sources into one output entry', () => {
    let e = entity();
    e = grantEntitlements(e, [
      { kind: 'tool_proficiency', key: 'thieves_tools', sourceKind: 'class', sourceId: 'rogue' },
      { kind: 'tool_proficiency', key: 'thieves_tools', sourceKind: 'race', sourceId: 'kenku' },
    ]);
    expect(deriveProficienciesFromEntitlements(e).tools).toEqual(['thieves_tools']);
  });
});

describe('revokeResourceSource — CustomResource lifecycle (closure pass 3, item 3)', () => {
  it('source A grants R, source B also grants (same id) R -> remove A -> R survives with its state untouched -> remove B -> R disappears', () => {
    let e = entity();
    e = applyGrant(e, { kind: 'resource', value: { resourceId: 'ki', name: 'Ki', maximum: 4, recharge: 'short_rest' } }, 1, undefined, { kind: 'class', id: 'monk' });
    // A second source "also grants" the SAME resource id — previously a
    // silent untracked no-op; now registers as an additional contributor.
    e = applyGrant(e, { kind: 'resource', value: { resourceId: 'ki', name: 'Ki', maximum: 4, recharge: 'short_rest' } }, 1, undefined, { kind: 'feat', id: 'ki_adept' });
    // Spend some of it — this state must survive removal of either single contributor.
    e = { ...e, resources: { ...e.resources, custom: e.resources.custom.map(r => r.id === 'ki' ? { ...r, current: 1 } : r) } };

    e = revokeResourceSource(e, 'class', 'monk');
    expect(e.resources.custom.find(r => r.id === 'ki')).toEqual({ id: 'ki', name: 'Ki', current: 1, maximum: 4, recharge: 'short_rest', sourceKind: 'class', sourceId: 'monk' });

    e = revokeResourceSource(e, 'feat', 'ki_adept');
    expect(e.resources.custom.find(r => r.id === 'ki')).toBeUndefined();
  });

  it('removing the ONLY source of a resource removes it', () => {
    let e = entity();
    e = applyGrant(e, { kind: 'resource', value: { resourceId: 'second_wind_pool', name: 'Second Wind', maximum: 1, recharge: 'short_rest' } }, 1, undefined, { kind: 'class', id: 'fighter' });
    e = revokeResourceSource(e, 'class', 'fighter');
    expect(e.resources.custom).toEqual([]);
  });

  it('a resource with no resource_grant entitlement at all (legacy/untracked) is left alone by revokeResourceSource', () => {
    const e = {
      ...entity(),
      resources: { ...makeEmptyEntity('e1').resources, custom: [{ id: 'legacy_pool', name: 'Legacy', current: 1, maximum: 1, recharge: 'short_rest', sourceKind: 'class' as const, sourceId: 'fighter' }] },
    };
    const updated = revokeResourceSource(e, 'class', 'fighter');
    expect(updated.resources.custom).toHaveLength(1); // untouched — never registered via a resource_grant entitlement
  });

  it('spent state is preserved (not reset) when a compatible surviving source keeps the resource alive', () => {
    let e = entity();
    e = applyGrant(e, { kind: 'resource', value: { resourceId: 'rage', name: 'Rage', maximum: 3, recharge: 'long_rest' } }, 1, undefined, { kind: 'class', id: 'barbarian' });
    e = applyGrant(e, { kind: 'resource', value: { resourceId: 'rage', name: 'Rage', maximum: 3, recharge: 'long_rest' } }, 1, undefined, { kind: 'subclass', id: 'berserker' });
    e = { ...e, resources: { ...e.resources, custom: e.resources.custom.map(r => r.id === 'rage' ? { ...r, current: 0 } : r) } }; // fully spent
    e = revokeResourceSource(e, 'subclass', 'berserker');
    expect(e.resources.custom.find(r => r.id === 'rage')?.current).toBe(0); // NOT reset to full
  });
});
