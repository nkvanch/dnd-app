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
  hasEntitlement, deriveProficienciesFromEntitlements, revokeResourceSource, initializeEntitlementInputs,
} from '../entitlements';
import { applyGrant } from '../leveling';
import { isSpellPreparationLegal } from '../actionCards';
import { Entity, ClassLevelEntry, SpellSlots, Spell, asClassId } from '../types';
import { useHomebrewStore } from '../../store/homebrewStore';

function entity() {
  return makeEmptyEntity('e1', 'character');
}

function emptySlots(): SpellSlots {
  const tiers = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
  const slots = {} as SpellSlots;
  for (const t of tiers) slots[t] = { total: 0, used: 0 };
  return slots;
}

/** Registers a fixture spell via homebrewStore's fallback lookup — the same
 *  workaround actionCards.test.ts uses, since spellRepo's native Tier-2
 *  cache starts empty in tests (getSpellSync needs an explicit
 *  ensureLoaded() warm-up this synchronous migration path never performs
 *  by design — see initializeEntitlementInputs's own doc comment). */
function fixtureSpell(id: string, classes: string[]): Spell {
  return {
    id, name: id, level: 3, school: 'Evocation', castingTime: '1 action', range: '150 feet',
    components: ['V', 'S', 'M'], duration: 'Instantaneous', description: 'Test spell.',
    upcast: null, ritual: false, concentration: false, classes,
  };
}

// ── Rules-engine blocker closure (1D — legacy/migrated characters) ──────────
// A save predating the entitlement system (entitlementInputsVersion
// undefined) migrates every flat spellcasting.known/.cantrips id into a
// spell_access/cantrip_access entitlement — previously always stamped
// sourceKind:'manual', which isSpellPreparationLegal then treated as
// permanently exempt from preparation, letting a real Wizard/Cleric spell
// silently bypass prep forever purely because its provenance predates
// entitlement tracking. initializeEntitlementInputs now attempts to recover
// the real class source when it's unambiguous.

describe('initializeEntitlementInputs — legacy spell/cantrip migration (closure 1D)', () => {
  // Rules-engine blocker RE-AUDIT closure (dependency inversion, 1A/1B):
  // initializeEntitlementInputs no longer reads useHomebrewStore itself —
  // this fixture spell is passed explicitly to every call below instead,
  // the same way the application layer resolves it (getMergedContentDB)
  // before calling into the engine.
  const homebrewSpells = [fixtureSpell('fireball', ['wizard', 'sorcerer'])];

  function legacyWizard(spellId: string): Entity {
    const classes: ClassLevelEntry[] = [{ classId: asClassId('wizard'), subclassId: null, level: 5 }];
    return {
      ...entity(),
      identity: { ...entity().identity, classes },
      entitlements: undefined, // predates the entitlement system entirely
      entitlementInputsVersion: undefined,
      spellcasting: { ability: 'int', slots: emptySlots(), cantrips: [], known: [spellId], prepared: [], concentrating: null },
    };
  }

  it('a known Wizard spell that\'s on ONLY the Wizard spell list resolves to sourceKind:class (not manual) — real preparation now applies', () => {
    const migrated = initializeEntitlementInputs(legacyWizard('fireball'), homebrewSpells); // Fireball: wizard + sorcerer, but this character is Wizard-only
    const record = migrated.entitlements!.find(r => r.kind === 'spell_access' && r.key === 'fireball');
    expect(record?.sourceKind).toBe('class');
    expect(record?.sourceId).toBe('wizard');
    // Consequence that actually matters: an unprepared migrated Wizard
    // spell is now correctly gated, not silently exempt forever.
    expect(isSpellPreparationLegal(migrated, 'fireball')).toBe(false);
  });

  it('a spell shared by two of the character\'s OWN classes is genuine ambiguity — stays manual, tagged with BOTH candidates, never guesses a single winner', () => {
    const classes: ClassLevelEntry[] = [
      { classId: asClassId('wizard'), subclassId: null, level: 3 },
      { classId: asClassId('sorcerer'), subclassId: null, level: 2 },
    ];
    const legacy: Entity = {
      ...entity(),
      identity: { ...entity().identity, classes },
      entitlements: undefined,
      entitlementInputsVersion: undefined,
      spellcasting: { ability: 'int', slots: emptySlots(), cantrips: [], known: ['fireball'], prepared: [], concentrating: null },
    };
    const migrated = initializeEntitlementInputs(legacy, homebrewSpells); // Fireball is on BOTH Wizard's and Sorcerer's lists
    const record = migrated.entitlements!.find(r => r.kind === 'spell_access' && r.key === 'fireball');
    expect(record?.sourceKind).toBe('manual'); // genuinely ambiguous — not guessed
    // Rules-engine blocker RE-AUDIT closure (1F): unlike a true unrestricted
    // manual grant, this now carries an explicit signal distinguishing
    // "unresolved" from "genuinely unrestricted" — see resolveSpellCastingContexts
    // (actionCards.test.ts) for how this turns into TWO real per-class
    // contexts (Wizard/INT/prepared-required, Sorcerer/CHA/known) instead
    // of one blanket always-legal context.
    expect(record?.ambiguousClassIds).toEqual(expect.arrayContaining(['wizard', 'sorcerer']));
    expect(record?.ambiguousClassIds).toHaveLength(2);
    // Legal overall because the Sorcerer candidate context is a known
    // caster (always legal) — NOT because "manual" itself is unrestricted;
    // see the dedicated resolveSpellCastingContexts test for the real
    // per-context breakdown this now produces.
    expect(isSpellPreparationLegal(migrated, 'fireball')).toBe(true);
  });

  it('reclassifying an ambiguous entry twice is idempotent — no churn, same candidates', () => {
    const classes: ClassLevelEntry[] = [
      { classId: asClassId('wizard'), subclassId: null, level: 3 },
      { classId: asClassId('sorcerer'), subclassId: null, level: 2 },
    ];
    const legacy: Entity = {
      ...entity(),
      identity: { ...entity().identity, classes },
      entitlements: undefined,
      entitlementInputsVersion: undefined,
      spellcasting: { ability: 'int', slots: emptySlots(), cantrips: [], known: ['fireball'], prepared: [], concentrating: null },
    };
    const once = initializeEntitlementInputs(legacy, homebrewSpells);
    const twice = initializeEntitlementInputs(once, homebrewSpells);
    expect(twice.entitlements).toEqual(once.entitlements);
  });

  it('a spell on no class list at all (untraceable — e.g. a scroll/item grant) stays manual', () => {
    const migrated = initializeEntitlementInputs(legacyWizard('completely_unknown_homebrew_spell_id'), homebrewSpells);
    const record = migrated.entitlements!.find(r => r.kind === 'spell_access' && r.key === 'completely_unknown_homebrew_spell_id');
    expect(record?.sourceKind).toBe('manual');
  });

  it('an ALREADY-migrated entity (entitlementInputsVersion 1) with a stale manual-tagged real class spell still gets reclassified on the next pass', () => {
    // Simulates a character migrated by an OLDER version of this migration
    // (before this fix existed) — already has entitlementInputsVersion: 1
    // with fireball incorrectly stamped manual.
    const classes: ClassLevelEntry[] = [{ classId: asClassId('wizard'), subclassId: null, level: 5 }];
    const staleEntity: Entity = {
      ...entity(),
      identity: { ...entity().identity, classes },
      entitlementInputsVersion: 1,
      entitlements: [{ kind: 'spell_access', key: 'fireball', sourceKind: 'manual' }],
      spellcasting: { ability: 'int', slots: emptySlots(), cantrips: [], known: ['fireball'], prepared: [], concentrating: null },
    };
    expect(isSpellPreparationLegal(staleEntity, 'fireball')).toBe(true); // stale bug: wrongly exempt
    const fixed = initializeEntitlementInputs(staleEntity, homebrewSpells);
    const record = fixed.entitlements!.find(r => r.kind === 'spell_access' && r.key === 'fireball');
    expect(record?.sourceKind).toBe('class');
    expect(record?.sourceId).toBe('wizard');
    expect(isSpellPreparationLegal(fixed, 'fireball')).toBe(false); // now correctly gated
  });

  it('is idempotent: reclassifying twice produces the same result and does not fight itself', () => {
    const classes: ClassLevelEntry[] = [{ classId: asClassId('wizard'), subclassId: null, level: 5 }];
    const staleEntity: Entity = {
      ...entity(),
      identity: { ...entity().identity, classes },
      entitlementInputsVersion: 1,
      entitlements: [{ kind: 'spell_access', key: 'fireball', sourceKind: 'manual' }],
      spellcasting: { ability: 'int', slots: emptySlots(), cantrips: [], known: ['fireball'], prepared: [], concentrating: null },
    };
    const once = initializeEntitlementInputs(staleEntity, homebrewSpells);
    const twice = initializeEntitlementInputs(once, homebrewSpells);
    expect(twice.entitlements).toEqual(once.entitlements);
  });

  it('a deliberately manual entry the player/DM added for a spell not on any of their own classes\' lists is left alone', () => {
    const classes: ClassLevelEntry[] = [{ classId: asClassId('fighter'), subclassId: null, level: 5 }];
    const e: Entity = {
      ...entity(),
      identity: { ...entity().identity, classes },
      entitlementInputsVersion: 1,
      entitlements: [{ kind: 'spell_access', key: 'fireball', sourceKind: 'manual' }], // Fighter has no spellcasting; this is a scroll/DM grant
    };
    const result = initializeEntitlementInputs(e, homebrewSpells);
    expect(result.entitlements).toEqual(e.entitlements); // untouched — Fighter isn't on Fireball's class list
  });
});

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
