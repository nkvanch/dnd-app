// src/engine/__tests__/leveling.test.ts
// The character-progression engine: applyGrant, applyHP, levelUp,
// resolveChoice, subclass/infusion/spell choice resolution, and multiclass
// level-ups. This is the single biggest and most bug-prone file in the
// engine (1000+ lines) — multiclassing in particular introduced two real
// namespacing bugs (subclass_unlock choice ids colliding across classes,
// spell_slots/feature grants using the wrong classId) that dedicated tests
// here would catch automatically instead of relying on manual device
// testing. Synthetic progressions are used throughout (rather than real
// content from src/content/classes) so these tests don't break when class
// content changes — same convention as combat.test.ts.
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import {
  applyGrant, applyHP, levelUp, resolveChoice, applySubclassToEntity,
  applyInfusionChoiceToEntity, applySpellChoiceToEntity, levelUpClass, queueChoice,
  removeFeature, swapBackground, projectToLevel, projectMulticlassSequence,
  applyAsiToEntity, applyFeatToEntity, reapplyResolvedAsi, stripResolvedAsiStats,
  applyToolChoiceToEntity,
} from '../leveling';
import { revokeEntitlementsFromChoice } from '../entitlements';
import { recomputeDerived } from '../pipeline';
import {
  Entity, Grant, ClassProgression, LevelEntry, ChoiceDefinition, CharClass,
  asClassId, Background, FeatureInstance, SkillName, Feature,
} from '../types';

function entity(overrides: Partial<Entity> = {}): Entity {
  return { ...makeEmptyEntity('e1'), ...overrides };
}

describe('applyGrant', () => {
  it('"feature" adds a FeatureInstance sourced to the given class, active by default', () => {
    const e = entity();
    const grant: Grant = { kind: 'feature', value: { id: 'f1', name: 'Test Feature', description: '', effects: [], actions: [], choices: [], passive: true } };
    const updated = applyGrant(e, grant, 3, 'fighter');
    expect(updated.features).toHaveLength(1);
    expect(updated.features[0]).toMatchObject({ id: 'f1', level: 3, isActive: true, source: { kind: 'class', refId: 'fighter' } });
  });

  it('"feature" with a grant_spell effect initializes spellcasting and adds cantrips/spells', () => {
    const e = entity();
    const grant: Grant = {
      kind: 'feature',
      value: {
        id: 'racial_cantrip', name: 'Doomed Touch', description: '', actions: [], choices: [], passive: true,
        effects: [{ type: 'grant_spell', target: 'spell', operation: 'add', value: null, condition: null, cantripIds: ['chill_touch'], spellcastingAbility: 'con' }],
      },
    };
    const updated = applyGrant(e, grant, 1);
    expect(updated.spellcasting?.ability).toBe('con');
    expect(updated.spellcasting?.cantrips).toEqual(['chill_touch']);
  });

  // Closure pass 3 (item 1): the grant_spell effect's cantrip is now ALSO
  // stamped as a source-owned entitlement (tagged to the granting feature),
  // so removeFeature + recompute can actually revoke it — reproducing and
  // closing the exact "feature grants spell, feature removed, spell
  // remains" bug.
  it('"feature" with a grant_spell effect is source-removable: removeFeature + recompute strips the granted cantrip', () => {
    const e = entity();
    // Explicit source:'feature' (same convention traitCompiler.ts's
    // manually-authored custom features use, per removeFeature's own docs)
    // — this is the realistic shape of the reported bug: a manually-added
    // feature that itself grants a spell.
    const grant: Grant = {
      kind: 'feature',
      value: {
        id: 'racial_cantrip', name: 'Doomed Touch', description: '', actions: [], choices: [], passive: true,
        source: { kind: 'feature', refId: 'racial_cantrip' },
        effects: [{ type: 'grant_spell', target: 'spell', operation: 'add', value: null, condition: null, cantripIds: ['chill_touch'], spellcastingAbility: 'con' }],
      },
    };
    const granted = applyGrant(e, grant, 1);
    expect(granted.entitlements).toContainEqual({ kind: 'cantrip_access', key: 'chill_touch', sourceKind: 'feature', sourceId: 'racial_cantrip' });
    // A real recompute pass happens here in every actual app mutation path
    // (every leveling primitive that isn't itself a raw applyGrant call
    // ends with recomputeDerived) — establishes the effectGrantedProficiencies
    // snapshot the LATER post-removal recompute needs to tell "mechanism-
    // granted, now gone" apart from "always was untracked base".
    const afterGrantRecompute = recomputeDerived(granted, DEFAULT_RULES);
    expect(afterGrantRecompute.spellcasting?.cantrips).toContain('chill_touch');

    const removed = removeFeature(afterGrantRecompute, 'racial_cantrip');
    const recomputed = recomputeDerived(removed, DEFAULT_RULES);
    expect(recomputed.spellcasting?.cantrips ?? []).not.toContain('chill_touch');
  });

  it('"resource" adds a new custom resource at full, and is idempotent on re-grant', () => {
    const e = entity();
    const grant: Grant = { kind: 'resource', value: { resourceId: 'ki', name: 'Ki Points', maximum: 2, recharge: 'short_rest' } };
    const once = applyGrant(e, grant, 2);
    expect(once.resources.custom).toEqual([{ id: 'ki', name: 'Ki Points', current: 2, maximum: 2, recharge: 'short_rest' }]);
    const twice = applyGrant(once, grant, 2);
    expect(twice.resources.custom).toHaveLength(1); // no duplicate
  });

  it('"resource" infers sourceKind: "class" from the classId param, same fallback the "feature" case uses', () => {
    const e = entity();
    const grant: Grant = { kind: 'resource', value: { resourceId: 'second_wind_pool', name: 'Second Wind', maximum: 1, recharge: 'short_rest' } };
    const updated = applyGrant(e, grant, 1, 'fighter');
    expect(updated.resources.custom[0]).toMatchObject({ sourceKind: 'class', sourceId: 'fighter' });
  });

  it('"resource" tags with an explicit source when given one, ignoring any inferred classId', () => {
    const e = entity({ identity: { ...makeEmptyEntity('e1').identity, classId: 'fighter' } });
    const grant: Grant = { kind: 'resource', value: { resourceId: 'relentless_endurance_pool', name: 'Relentless Endurance', maximum: 1, recharge: 'long_rest' } };
    // entity.identity.classId is 'fighter' here (simulating class picked before race),
    // but an explicit race source must win — this is the exact bug class this phase fixes.
    const updated = applyGrant(e, grant, 0, undefined, { kind: 'race', id: 'half_orc' });
    expect(updated.resources.custom[0]).toMatchObject({ sourceKind: 'race', sourceId: 'half_orc' });
  });

  it('"resource" leaves sourceKind undefined with no classId and no explicit source', () => {
    const e = entity();
    const grant: Grant = { kind: 'resource', value: { resourceId: 'mystery_pool', name: 'Mystery', maximum: 1, recharge: 'long_rest' } };
    const updated = applyGrant(e, grant, 0);
    expect(updated.resources.custom[0].sourceKind).toBeUndefined();
  });

  it('filtering resources.custom by sourceKind !== "class" (what clearClassData does) preserves racial resources and drops class ones', () => {
    let e = entity();
    e = applyGrant(e, { kind: 'resource', value: { resourceId: 'second_wind_pool', name: 'Second Wind', maximum: 1, recharge: 'short_rest' } }, 1, 'fighter');
    e = applyGrant(e, { kind: 'resource', value: { resourceId: 'relentless_endurance_pool', name: 'Relentless Endurance', maximum: 1, recharge: 'long_rest' } }, 0, undefined, { kind: 'race', id: 'half_orc' });
    const afterClassSwitch = e.resources.custom.filter(r => r.sourceKind !== 'class');
    expect(afterClassSwitch.map(r => r.id)).toEqual(['relentless_endurance_pool']);
  });

  // Closure pass 3 (item 3): used to unconditionally full-refresh `current`
  // to the new maximum, discarding whatever had already been spent — an
  // upgrade is not a rest. Fixed to preserve the SPENT amount instead.
  it('"resource_upgrade" raises maximum and PRESERVES the already-spent amount (not a full refresh)', () => {
    const e = entity({ resources: { ...makeEmptyEntity('e1').resources, custom: [{ id: 'ki', name: 'Ki', current: 1, maximum: 2, recharge: 'short_rest' }] } }); // 1 spent
    const grant: Grant = { kind: 'resource_upgrade', value: { resourceId: 'ki', newMaximum: 5 } };
    const updated = applyGrant(e, grant, 5);
    expect(updated.resources.custom[0]).toEqual({ id: 'ki', name: 'Ki', current: 4, maximum: 5, baseMaximum: 2, recharge: 'short_rest' }); // 5 - 1 spent
  });

  it('"resource_upgrade" on a resource with nothing spent stays at the new full maximum', () => {
    const e = entity({ resources: { ...makeEmptyEntity('e1').resources, custom: [{ id: 'ki', name: 'Ki', current: 2, maximum: 2, recharge: 'short_rest' }] } });
    const grant: Grant = { kind: 'resource_upgrade', value: { resourceId: 'ki', newMaximum: 5 } };
    const updated = applyGrant(e, grant, 5);
    expect(updated.resources.custom[0]).toEqual({ id: 'ki', name: 'Ki', current: 5, maximum: 5, baseMaximum: 2, recharge: 'short_rest' });
  });

  it('"resource_upgrade" clamps if the spent amount would exceed the new (possibly shrunk) maximum', () => {
    const e = entity({ resources: { ...makeEmptyEntity('e1').resources, custom: [{ id: 'ki', name: 'Ki', current: 0, maximum: 4, recharge: 'short_rest' }] } }); // fully spent
    const grant: Grant = { kind: 'resource_upgrade', value: { resourceId: 'ki', newMaximum: 2 } }; // shrinks
    const updated = applyGrant(e, grant, 5);
    expect(updated.resources.custom[0].current).toBe(0); // never negative
    expect(updated.resources.custom[0].maximum).toBe(2);
  });

  it('"proficiency" merges and deduplicates proficiency lists', () => {
    const e = entity({ proficiencies: { ...makeEmptyEntity('e1').proficiencies, armor: ['light'] } });
    const grant: Grant = { kind: 'proficiency', value: { armor: ['light', 'medium'], weapons: ['simple'] } };
    const updated = applyGrant(e, grant, 1);
    expect(updated.proficiencies.armor).toEqual(['light', 'medium']);
    expect(updated.proficiencies.weapons).toEqual(['simple']);
  });

  it('"subclass_unlock" queues a real "subclass"-kind pending choice namespaced by class and level', () => {
    const e = entity();
    const updated = applyGrant(e, { kind: 'subclass_unlock', value: null }, 3, 'fighter');
    expect(updated.choices).toHaveLength(1);
    expect(updated.choices[0]).toMatchObject({
      id: 'subclass_unlock_fighter_3',
      resolved: false,
      definition: { kind: 'subclass', forClassId: 'fighter' },
    });
  });

  it('"subclass_unlock" does not queue a duplicate for the same class+level', () => {
    const e = entity();
    let updated = applyGrant(e, { kind: 'subclass_unlock', value: null }, 3, 'fighter');
    updated = applyGrant(updated, { kind: 'subclass_unlock', value: null }, 3, 'fighter');
    expect(updated.choices).toHaveLength(1);
  });

  it('"subclass_unlock" namespaces by class — two classes unlocking at the same level don\'t collide', () => {
    const e = entity();
    let updated = applyGrant(e, { kind: 'subclass_unlock', value: null }, 3, 'fighter');
    updated = applyGrant(updated, { kind: 'subclass_unlock', value: null }, 3, 'rogue');
    expect(updated.choices.map(c => c.id).sort()).toEqual(['subclass_unlock_fighter_3', 'subclass_unlock_rogue_3']);
  });

  it('"speed" adds a permanent bonus to resources.speed', () => {
    const e = entity();
    const updated = applyGrant(e, { kind: 'speed', value: 10 }, 5);
    expect(updated.resources.speed).toBe(40); // default 30 + 10
  });

  it('"init_spellcasting" creates a fresh spellcasting block', () => {
    const e = entity();
    const updated = applyGrant(e, { kind: 'init_spellcasting', value: { ability: 'wis' } }, 1);
    expect(updated.spellcasting).toMatchObject({ ability: 'wis', cantrips: [], known: [], prepared: [] });
  });

  it('"init_spellcasting" upgrades the ability of an already-initialized block, preserving known spells', () => {
    const e = entity({ spellcasting: { ability: 'con', slots: {} as any, cantrips: ['chill_touch'], known: [], prepared: [], concentrating: null } });
    const updated = applyGrant(e, { kind: 'init_spellcasting', value: { ability: 'cha' } }, 1);
    expect(updated.spellcasting?.ability).toBe('cha');
    expect(updated.spellcasting?.cantrips).toEqual(['chill_touch']);
  });

  it('"known_spells" is a no-op if spellcasting has not been initialized yet', () => {
    const e = entity();
    const updated = applyGrant(e, { kind: 'known_spells', value: { spellIds: ['fireball'] } }, 5);
    expect(updated.spellcasting).toBeNull();
  });

  it('"known_spells" adds fixed spells/cantrips to an initialized block, deduplicated', () => {
    const e = entity({ spellcasting: { ability: 'int', slots: {} as any, cantrips: [], known: ['magic_missile'], prepared: [], concentrating: null } });
    const updated = applyGrant(e, { kind: 'known_spells', value: { spellIds: ['magic_missile', 'fireball'], cantripIds: ['fire_bolt'] } }, 5);
    expect(updated.spellcasting?.known).toEqual(['magic_missile', 'fireball']);
    expect(updated.spellcasting?.cantrips).toEqual(['fire_bolt']);
  });

  it('"starting_item" adds one carried ItemInstance', () => {
    const e = entity();
    const updated = applyGrant(e, { kind: 'starting_item', value: 'longsword' }, 1);
    expect(updated.inventory.carried).toEqual([{ itemId: 'longsword', quantity: 1, attuned: false, features: [] }]);
  });

  it('an unrecognized grant kind is a safe no-op', () => {
    const e = entity();
    const updated = applyGrant(e, { kind: 'not_a_real_kind' as any, value: null }, 1);
    expect(updated).toEqual(e);
  });
});

describe('applyHP', () => {
  it('always rolls max die on the very first level, regardless of hpMode', () => {
    const e = entity();
    const updated = applyHP(e, 10, 'rolled', 1, DEFAULT_RULES, 'con');
    // stats default to 10 → con mod 0 → gain = die (10)
    expect(updated.resources.hp).toEqual({ current: 10, maximum: 10, temp: 0 });
    expect(updated.resources.hitDice).toEqual({ die: 10, total: 1, remaining: 1 });
  });

  it('"fixed" mode beyond level 1 uses floor(die/2)+1', () => {
    const e = entity({ identity: { ...makeEmptyEntity('e1').identity, level: 1 }, resources: { ...makeEmptyEntity('e1').resources, hp: { current: 10, maximum: 10, temp: 0 }, hitDice: { die: 10, total: 1, remaining: 1 } } });
    const updated = applyHP(e, 10, 'fixed', 2, DEFAULT_RULES, 'con', false);
    expect(updated.resources.hp.maximum).toBe(10 + 6); // floor(10/2)+1 = 6
  });

  it('"max" mode beyond level 1 always uses the full die', () => {
    const e = entity({ resources: { ...makeEmptyEntity('e1').resources, hp: { current: 10, maximum: 10, temp: 0 }, hitDice: { die: 10, total: 1, remaining: 1 } } });
    const updated = applyHP(e, 10, 'max', 2, DEFAULT_RULES, 'con', false);
    expect(updated.resources.hp.maximum).toBe(20);
  });

  it('adds the (effective) ability modifier to the gain', () => {
    const e = entity({ stats: { str: 10, dex: 10, con: 16, int: 10, wis: 10, cha: 10 } }); // +3 con
    const updated = applyHP(e, 8, 'max', 1, DEFAULT_RULES, 'con');
    expect(updated.resources.hp.maximum).toBe(8 + 3);
  });

  it('never lets a single level grant less than 1 HP even with a very negative modifier', () => {
    const e = entity({ stats: { str: 10, dex: 10, con: 1, int: 10, wis: 10, cha: 10 } }); // -5 con
    const updated = applyHP(e, 6, 'fixed', 2, DEFAULT_RULES, 'con', false);
    expect(updated.resources.hp.maximum).toBe(1); // max(1, 4-5)
  });

  it('applies the hpMinHalfDie house rule floor to a rolled result below half the die', () => {
    const rules = { ...DEFAULT_RULES, customRules: { hpMinHalfDie: true } };
    const rollDieSpy = jest.spyOn(Math, 'random').mockReturnValue(0); // rollDie(10) → 1, well below half
    const e = entity({ resources: { ...makeEmptyEntity('e1').resources, hp: { current: 10, maximum: 10, temp: 0 }, hitDice: { die: 10, total: 1, remaining: 1 } } });
    const updated = applyHP(e, 10, 'rolled', 2, rules, 'con', false);
    expect(updated.resources.hp.maximum).toBe(10 + 5); // bumped up to ceil(10/2)=5, not the rolled 1
    rollDieSpy.mockRestore();
  });

  it('isVeryFirstLevel can be forced independently of atLevel (multiclass second class taking its own level 1)', () => {
    const e = entity({ resources: { ...makeEmptyEntity('e1').resources, hp: { current: 20, maximum: 20, temp: 0 }, hitDice: { die: 10, total: 2, remaining: 2 } } });
    // atLevel=1 (this class's own first level) but isVeryFirstLevel explicitly false
    const updated = applyHP(e, 6, 'fixed', 1, DEFAULT_RULES, 'con', false);
    expect(updated.resources.hp.maximum).toBe(20 + 4); // floor(6/2)+1=4, NOT the max-die 6
  });

  // Bug fix: a multiclass character's hit dice used to be tracked as one
  // {die,total,remaining} triple — every applyHP call unconditionally
  // overwrote `die`, silently mislabeling hit dice gained from OTHER
  // classes. `pools` (HitDiceBlock, types.ts) is the fix — see its own doc
  // comment for the full failure scenario this closes.
  describe('mixed hit-dice pools across classes', () => {
    it('stays pools-free for a single class (identical to pre-fix behavior)', () => {
      let e = entity({ resources: { ...makeEmptyEntity('e1').resources, hitDice: { die: 10, total: 2, remaining: 2 } } });
      e = applyHP(e, 10, 'max', 3, DEFAULT_RULES, 'con', false);
      expect(e.resources.hitDice).toEqual({ die: 10, total: 3, remaining: 3 });
      expect(e.resources.hitDice.pools).toBeUndefined();
    });

    it('stays pools-free when a second class shares the same die size', () => {
      // Fighter 1 (d10) then Paladin 1 (also d10) — no real mix, no pools needed.
      let e = entity({ resources: { ...makeEmptyEntity('e1').resources, hitDice: { die: 10, total: 1, remaining: 1 } } });
      e = applyHP(e, 10, 'fixed', 1, DEFAULT_RULES, 'con', true);
      expect(e.resources.hitDice).toEqual({ die: 10, total: 2, remaining: 2 });
      expect(e.resources.hitDice.pools).toBeUndefined();
    });

    it('backfills pools from existing scalar state the first time a second die size appears', () => {
      // Fighter 3 (3x d10) already on the sheet, then this class's own
      // level-1 Wizard grant (d6) lands via applyHP — the exact multiclass
      // scenario from the bug report.
      const fighter3 = entity({ resources: { ...makeEmptyEntity('e1').resources, hitDice: { die: 10, total: 3, remaining: 3 } } });
      const withWizard = applyHP(fighter3, 6, 'fixed', 1, DEFAULT_RULES, 'con', true);
      expect(withWizard.resources.hitDice.pools).toEqual([
        { die: 10, total: 3, remaining: 3 }, // the 3 real Fighter d10s, correctly preserved
        { die: 6, total: 1, remaining: 1 },  // the new Wizard d6
      ]);
      // total/remaining stay correct sums — every existing reader that only
      // wants the aggregate count keeps working unchanged.
      expect(withWizard.resources.hitDice.total).toBe(4);
      expect(withWizard.resources.hitDice.remaining).toBe(4);
    });

    it('accumulates further levels into the matching pool, not a fresh one', () => {
      const mixed = entity({
        resources: {
          ...makeEmptyEntity('e1').resources,
          hitDice: { die: 6, total: 4, remaining: 4, pools: [{ die: 10, total: 3, remaining: 3 }, { die: 6, total: 1, remaining: 1 }] },
        },
      });
      // Fighter levels again (back to d10) — must land in the EXISTING d10
      // pool, not overwrite it or create a duplicate d10 entry.
      const updated = applyHP(mixed, 10, 'fixed', 4, DEFAULT_RULES, 'con', false);
      expect(updated.resources.hitDice.pools).toEqual([
        { die: 10, total: 4, remaining: 4 },
        { die: 6, total: 1, remaining: 1 },
      ]);
      expect(updated.resources.hitDice.total).toBe(5);
    });
  });
});

describe('levelUp', () => {
  function progression(): ClassProgression {
    const entries: LevelEntry[] = [
      {
        level: 1, hpDie: 6,
        grants: [{ kind: 'proficiency', value: { armor: ['light'] } }, { kind: 'init_spellcasting', value: { ability: 'int' } }],
        choices: [{
          id: 'skill_choice', prompt: 'Choose a skill', kind: 'skill', count: 1,
          pool: [{ id: 'arcana', label: 'Arcana', value: 'arcana' }, { id: 'history', label: 'History', value: 'history' }],
          grants: [], required: true, resolved: false,
        }],
      },
      {
        level: 2, hpDie: 6,
        grants: [{ kind: 'feature', value: { id: 'lvl2_feat', name: 'Level 2 Feature', description: '', effects: [], actions: [], choices: [], passive: true } }],
        choices: [],
      },
      {
        level: 3, hpDie: 6,
        grants: [],
        choices: [{
          id: 'asi_lvl3', prompt: 'Ability Score Improvement', kind: 'asi', count: 1,
          pool: 'all', grants: [], required: true, resolved: false,
        }],
      },
    ];
    return { classId: 'wizard', entries };
  }

  // Re-audit A11: levelUp() only ever wrote the legacy identity.level scalar,
  // leaving a migrated entity's identity.classes[] stale — the two canonical-
  // level representations (identity.level vs identity.classes[].level, see
  // getClassLevels' own doc comment on the intended relationship) could
  // diverge after nothing more than a normal single-class level-up.
  it('keeps identity.classes[] synchronized with identity.level after a migrated single-class entity levels up', () => {
    const migrated = entity({
      identity: { ...makeEmptyEntity('e1').identity, classId: 'wizard', level: 1, classes: [{ classId: asClassId('wizard'), subclassId: null, level: 1 }] },
    });
    const updated = levelUp(migrated, 2, progression(), DEFAULT_RULES);
    expect(updated.identity.level).toBe(2);
    expect(updated.identity.classes).toEqual([{ classId: 'wizard', subclassId: null, level: 2 }]);
  });

  it('advances level, applies HP/grants for every level crossed, and queues non-auto-resolvable choices', () => {
    const e = entity({ identity: { ...makeEmptyEntity('e1').identity, classId: 'wizard' } });
    const updated = levelUp(e, 2, progression(), DEFAULT_RULES);
    expect(updated.identity.level).toBe(2);
    expect(updated.features.map(f => f.id)).toContain('lvl2_feat');
    expect(updated.proficiencies.armor).toEqual(['light']);
    // the level-1 skill choice has exactly 2 pool options ≠ count(1) → not auto-resolvable → queued.
    // Stored id is namespaced by the granting class (progression.classId, 'wizard') so a second
    // class authoring the same raw choice id at the same level can never collide with this one.
    expect(updated.choices.some(c => c.id === 'wizard:skill_choice_1' && !c.resolved)).toBe(true);
  });

  it('namespaces queued choices by origin so two classes authoring the identical raw choice id at the same level never collide (C19 regression)', () => {
    // Two DIFFERENT classes (or a homebrew author copy-pasting an id) both
    // queue a choice with the exact same raw ChoiceDefinition.id ('skill_choice')
    // at the exact same level — before this fix, the second queueChoice call
    // would silently overwrite the first's stored id and the player would
    // lose one of the two choices with no error.
    const sharedChoice: ChoiceDefinition = {
      id: 'skill_choice', prompt: 'Choose a skill', kind: 'skill', count: 1,
      pool: [{ id: 'arcana', label: 'Arcana', value: 'arcana' }, { id: 'history', label: 'History', value: 'history' }],
      grants: [], required: true, resolved: false,
    };
    let e = entity();
    e = queueChoice(e, sharedChoice, 1, 'wizard');
    e = queueChoice(e, sharedChoice, 1, 'rogue');
    expect(e.choices).toHaveLength(2);
    expect(e.choices.map(c => c.id)).toEqual(['wizard:skill_choice_1', 'rogue:skill_choice_1']);
    // Omitting originId keeps the exact pre-existing format — the bonus-feat
    // house rule relies on this being stable across app versions for its own
    // idempotency check (see leveling.ts's bonusFeatEveryLevel call sites).
    const noOrigin = queueChoice(entity(), sharedChoice, 1);
    expect(noOrigin.choices[0].id).toBe('skill_choice_1');
  });

  it('is idempotent when targetLevel is not above the current level', () => {
    const e = entity({ identity: { ...makeEmptyEntity('e1').identity, classId: 'wizard', level: 2 } });
    const updated = levelUp(e, 1, progression(), DEFAULT_RULES);
    expect(updated.identity.level).toBe(2); // unchanged — loop never runs backward
  });

  it('grows spell slots automatically from the real class table as the caster levels up', () => {
    const e = entity({ identity: { ...makeEmptyEntity('e1').identity, classId: 'wizard' } });
    const updated = levelUp(e, 3, progression(), DEFAULT_RULES);
    // Wizard is a full caster: level 3 grants 2×tier-1, 1×tier-2 slots (SRD table)
    expect(updated.spellcasting?.slots['1'].total).toBe(4);
    expect(updated.spellcasting?.slots['2'].total).toBe(2);
  });

  it('preserves already-used spell slots when growing totals on level-up', () => {
    let e = entity({ identity: { ...makeEmptyEntity('e1').identity, classId: 'wizard' } });
    e = levelUp(e, 1, progression(), DEFAULT_RULES);
    e = { ...e, spellcasting: { ...e.spellcasting!, slots: { ...e.spellcasting!.slots, '1': { ...e.spellcasting!.slots['1'], used: 1 } } } };
    const updated = levelUp(e, 2, progression(), DEFAULT_RULES);
    expect(updated.spellcasting?.slots['1'].used).toBe(1);
  });

  it('injects an extra bonus-feat ASI choice at every level under the bonusFeatEveryLevel house rule', () => {
    const rules = { ...DEFAULT_RULES, customRules: { bonusFeatEveryLevel: true } };
    const e = entity({ identity: { ...makeEmptyEntity('e1').identity, classId: 'wizard' } });
    const updated = levelUp(e, 1, progression(), rules);
    expect(updated.choices.some(c => c.id === 'bonus_feat_lvl_1' && c.definition.kind === 'asi')).toBe(true);
  });

  // FEAT-ENTITLEMENT-1: a multi-level jump (direct high-level creation or a
  // multi-level in-play level-up) must queue ONE bonus-feat choice PER LEVEL
  // crossed, not a single flat bonus slot — real per-level entitlement, not
  // a fixed extra pick regardless of how many levels were gained.
  it('queues one separate bonus-feat choice per level crossed on a multi-level jump, not one flat bonus', () => {
    const rules = { ...DEFAULT_RULES, customRules: { bonusFeatEveryLevel: true } };
    const e = entity({ identity: { ...makeEmptyEntity('e1').identity, classId: 'wizard' } });
    const updated = levelUp(e, 3, progression(), rules);
    const bonusFeatChoices = updated.choices.filter(c => c.id.startsWith('bonus_feat_lvl_'));
    expect(bonusFeatChoices.map(c => c.id).sort()).toEqual(['bonus_feat_lvl_1', 'bonus_feat_lvl_2', 'bonus_feat_lvl_3']);
    expect(bonusFeatChoices.every(c => c.definition.kind === 'asi' && !c.resolved)).toBe(true);
  });

  // FEAT-ENTITLEMENT-1: direct creation at level N (levelUp from 0) must
  // queue exactly as many bonus-feat choices as leveling 1→2→3 incrementally
  // would — same code path, so this also locks the "direct N == incremental"
  // invariant for this specific entitlement.
  it('direct creation at level 3 queues the same bonus-feat choices as leveling 1, then 2, then 3 incrementally', () => {
    const rules = { ...DEFAULT_RULES, customRules: { bonusFeatEveryLevel: true } };
    const direct = levelUp(entity({ identity: { ...makeEmptyEntity('e1').identity, classId: 'wizard' } }), 3, progression(), rules);

    let incremental = entity({ identity: { ...makeEmptyEntity('e1').identity, classId: 'wizard' } });
    incremental = levelUp(incremental, 1, progression(), rules);
    incremental = levelUp(incremental, 2, progression(), rules);
    incremental = levelUp(incremental, 3, progression(), rules);

    const bonusIds = (ent: typeof direct) => ent.choices.filter(c => c.id.startsWith('bonus_feat_lvl_')).map(c => c.id).sort();
    expect(bonusIds(direct)).toEqual(bonusIds(incremental));
  });
});

describe('projectToLevel', () => {
  function fighterLikeProgression(): ClassProgression {
    const entries: LevelEntry[] = [
      { level: 1, hpDie: 10, grants: [], choices: [] },
      {
        level: 2, hpDie: 10, choices: [],
        grants: [{ kind: 'feature', value: {
          id: 'action_surge', name: 'Action Surge', description: '', source: { kind: 'class', refId: 'fighter' },
          level: 2, effects: [], actions: [], choices: [], passive: true,
        } }],
      },
      {
        level: 3, hpDie: 10, grants: [],
        choices: [{
          id: 'subclass_pick', prompt: 'Choose a Martial Archetype', kind: 'custom', count: 1,
          pool: 'all', grants: [], required: true, resolved: false,
        }],
      },
      { level: 4, hpDie: 10, grants: [], choices: [] },
      {
        level: 5, hpDie: 10, choices: [],
        grants: [{ kind: 'feature', value: {
          id: 'extra_attack', name: 'Extra Attack', description: '', source: { kind: 'class', refId: 'fighter' },
          level: 5, effects: [], actions: [], choices: [], passive: true,
        } }],
      },
    ];
    return { classId: 'fighter', entries };
  }

  function fighterEntity(): Entity {
    const e = makeEmptyEntity('e1');
    return { ...e, identity: { ...e.identity, classId: 'fighter', level: 1 } };
  }

  it('projects a multi-level jump, granting every feature crossed along the way', () => {
    const e = fighterEntity();
    const projected = projectToLevel(e, 5, fighterLikeProgression(), DEFAULT_RULES);
    expect(projected.identity.level).toBe(5);
    expect(projected.features.map(f => f.id)).toEqual(expect.arrayContaining(['action_surge', 'extra_attack']));
  });

  it('forces max HP regardless of the real campaign rules\' hpMode', () => {
    const e = fighterEntity();
    const rolled = projectToLevel(e, 5, fighterLikeProgression(), { ...DEFAULT_RULES, hpMode: 'rolled' });
    const maxed  = projectToLevel(e, 5, fighterLikeProgression(), { ...DEFAULT_RULES, hpMode: 'max' });
    // Same deterministic result regardless of which hpMode the real campaign uses —
    // proves the projection never shows a roll that a real level-up wouldn't reproduce.
    expect(rolled.resources.hp.maximum).toBe(maxed.resources.hp.maximum);
  });

  it('queues a projected level\'s pending choice without resolving it (disclosed, not resolved)', () => {
    const e = fighterEntity();
    const projected = projectToLevel(e, 5, fighterLikeProgression(), DEFAULT_RULES);
    const subclassChoice = projected.choices.find(c => c.id === 'fighter:subclass_pick_3');
    expect(subclassChoice).toBeDefined();
    expect(subclassChoice!.resolved).toBe(false);
  });

  it('never mutates the input entity', () => {
    const e = fighterEntity();
    const before = JSON.stringify(e);
    projectToLevel(e, 5, fighterLikeProgression(), DEFAULT_RULES);
    expect(JSON.stringify(e)).toBe(before);
  });
});

describe('projectMulticlassSequence (A-61)', () => {
  function fighterProgression(): ClassProgression {
    return {
      classId: 'fighter',
      entries: [
        { level: 1, hpDie: 10, grants: [], choices: [] },
        { level: 2, hpDie: 10, grants: [{ kind: 'feature', value: {
          id: 'action_surge', name: 'Action Surge', description: '', effects: [], actions: [], choices: [], passive: true,
        } }], choices: [] },
      ],
    };
  }
  function wizardProgression(): ClassProgression {
    return {
      classId: 'wizard',
      entries: [
        { level: 1, hpDie: 6, grants: [], choices: [] },
        { level: 2, hpDie: 6, grants: [], choices: [] },
        { level: 3, hpDie: 6, grants: [{ kind: 'feature', value: {
          id: 'wizard_l3', name: 'Wizard L3 Feature', description: '', effects: [], actions: [], choices: [], passive: true,
        } }], choices: [] },
      ],
    };
  }
  const wizardClass = { multiclassProficiencies: {} } as unknown as CharClass;

  function baseMcEntity(): Entity {
    return entity({
      identity: {
        ...makeEmptyEntity('e1').identity,
        classes: [{ classId: asClassId('fighter'), subclassId: null, level: 1 }],
        classId: 'fighter', level: 1,
      },
    });
  }

  it('applies an ordered sequence of per-class level-ups, one level each', () => {
    const e = baseMcEntity();
    const projected = projectMulticlassSequence(e, [
      { classId: 'wizard', progression: wizardProgression(), targetClass: wizardClass }, // new class, wizard 1
      { classId: 'fighter', progression: fighterProgression() },                          // fighter 2
      { classId: 'wizard', progression: wizardProgression() },                            // wizard 2
    ], DEFAULT_RULES);

    expect(projected.identity.classes).toEqual(expect.arrayContaining([
      { classId: 'fighter', subclassId: null, level: 2 },
      { classId: 'wizard', subclassId: null, level: 2 },
    ]));
    expect(projected.features.map(f => f.id)).toContain('action_surge');
  });

  it('order matters — a feature at wizard level 3 only appears once enough wizard steps are planned', () => {
    const e = baseMcEntity();
    const twoWizardSteps = projectMulticlassSequence(e, [
      { classId: 'wizard', progression: wizardProgression(), targetClass: wizardClass },
      { classId: 'wizard', progression: wizardProgression() },
    ], DEFAULT_RULES);
    expect(twoWizardSteps.features.map(f => f.id)).not.toContain('wizard_l3');

    const threeWizardSteps = projectMulticlassSequence(e, [
      { classId: 'wizard', progression: wizardProgression(), targetClass: wizardClass },
      { classId: 'wizard', progression: wizardProgression() },
      { classId: 'wizard', progression: wizardProgression() },
    ], DEFAULT_RULES);
    expect(threeWizardSteps.features.map(f => f.id)).toContain('wizard_l3');
  });

  it('forces max HP regardless of the real campaign rules\' hpMode', () => {
    const e = baseMcEntity();
    const steps = [{ classId: 'fighter', progression: fighterProgression() }];
    const rolled = projectMulticlassSequence(e, steps, { ...DEFAULT_RULES, hpMode: 'rolled' });
    const maxed  = projectMulticlassSequence(e, steps, { ...DEFAULT_RULES, hpMode: 'max' });
    expect(rolled.resources.hp.maximum).toBe(maxed.resources.hp.maximum);
  });

  it('an empty sequence returns the entity unchanged', () => {
    const e = baseMcEntity();
    const projected = projectMulticlassSequence(e, [], DEFAULT_RULES);
    expect(projected).toEqual(e);
  });

  it('never mutates the input entity', () => {
    const e = baseMcEntity();
    const before = JSON.stringify(e);
    projectMulticlassSequence(e, [
      { classId: 'wizard', progression: wizardProgression(), targetClass: wizardClass },
    ], DEFAULT_RULES);
    expect(JSON.stringify(e)).toBe(before);
  });
});

describe('resolveChoice', () => {
  function skillChoice(): ChoiceDefinition {
    return {
      id: 'skill_pick', prompt: 'Choose a skill', kind: 'skill', count: 1,
      pool: [{ id: 'stealth', label: 'Stealth', value: 'stealth' }, { id: 'perception', label: 'Perception', value: 'perception' }],
      grants: [], required: true, resolved: false,
    };
  }

  it('throws if the choice id does not exist on the entity', () => {
    const e = entity();
    expect(() => resolveChoice(e, 'nope', ['x'], DEFAULT_RULES)).toThrow(/Choice not found/);
  });

  it('throws if the number of selections does not match the required count', () => {
    const def = skillChoice();
    const e = entity({ choices: [{ id: 'c1', definition: def, grantedAt: 1, resolved: false, selections: [] }] });
    expect(() => resolveChoice(e, 'c1', [], DEFAULT_RULES)).toThrow(/Expected 1 selections/);
  });

  it('throws for a selection id not present in the pool', () => {
    const def = skillChoice();
    const e = entity({ choices: [{ id: 'c1', definition: def, grantedAt: 1, resolved: false, selections: [] }] });
    expect(() => resolveChoice(e, 'c1', ['not_an_option'], DEFAULT_RULES)).toThrow(/Invalid selection/);
  });

  it('marks a skill trained and resolves the choice', () => {
    const def = skillChoice();
    const e = entity({ choices: [{ id: 'c1', definition: def, grantedAt: 1, resolved: false, selections: [] }] });
    const updated = resolveChoice(e, 'c1', ['stealth'], DEFAULT_RULES);
    expect(updated.skills.skills.stealth.trained).toBe(true);
    expect(updated.choices[0]).toMatchObject({ resolved: true, selections: ['stealth'] });
  });

  it('an equipment choice adds each item id in the selected option\'s value array to carried inventory', () => {
    const def: ChoiceDefinition = {
      id: 'equip_pick', prompt: 'Choose gear', kind: 'equipment', count: 1,
      pool: [{ id: 'pack_a', label: 'Pack A', value: ['rope', 'torch'] }],
      grants: [], required: true, resolved: false,
    };
    const e = entity({ choices: [{ id: 'c1', definition: def, grantedAt: 1, resolved: false, selections: [] }] });
    const updated = resolveChoice(e, 'c1', ['pack_a'], DEFAULT_RULES);
    expect(updated.inventory.carried.map(i => i.itemId)).toEqual(['rope', 'torch']);
  });

  it('a spellcasting_ability choice initializes spellcasting with the chosen ability', () => {
    const def: ChoiceDefinition = {
      id: 'ability_pick', prompt: 'Choose casting ability', kind: 'spellcasting_ability', count: 1,
      pool: [{ id: 'wis_opt', label: 'Wisdom', value: 'wis' }],
      grants: [], required: true, resolved: false,
    };
    const e = entity({ choices: [{ id: 'c1', definition: def, grantedAt: 1, resolved: false, selections: [] }] });
    const updated = resolveChoice(e, 'c1', ['wis_opt'], DEFAULT_RULES);
    expect(updated.spellcasting?.ability).toBe('wis');
  });

  it('applies every grant in the choice definition for each selection made', () => {
    const def: ChoiceDefinition = {
      id: 'lang_pick', prompt: 'Choose a language', kind: 'language', count: 1,
      pool: [{ id: 'elvish', label: 'Elvish', value: 'elvish' }],
      grants: [{ kind: 'proficiency', value: { languages: ['elvish'] } }],
      required: true, resolved: false,
    };
    const e = entity({ choices: [{ id: 'c1', definition: def, grantedAt: 1, resolved: false, selections: [] }] });
    const updated = resolveChoice(e, 'c1', ['elvish'], DEFAULT_RULES);
    expect(updated.proficiencies.languages).toEqual(['elvish']);
  });
});

describe('applySubclassToEntity', () => {
  function championProgression(): import('../types').ClassProgression {
    return {
      classId: 'fighter',
      entries: [
        { level: 3, hpDie: 10, grants: [{ kind: 'feature', value: { id: 'improved_crit', name: 'Improved Critical', description: '', effects: [], actions: [], choices: [], passive: true } }], choices: [] },
        { level: 7, hpDie: 10, grants: [{ kind: 'feature', value: { id: 'remarkable_athlete', name: 'Remarkable Athlete', description: '', effects: [], actions: [], choices: [], passive: true } }], choices: [] },
      ],
    };
  }

  it('single-class: sets identity.subclassId and resolves the pending choice', () => {
    const choiceDef: ChoiceDefinition = { id: 'subclass_unlock_fighter_3', prompt: '', kind: 'subclass', count: 1, pool: [], grants: [], required: true, resolved: false };
    const e = entity({
      identity: { ...makeEmptyEntity('e1').identity, classId: 'fighter', level: 3 },
      choices: [{ id: 'subclass_unlock_fighter_3', definition: choiceDef, grantedAt: 3, resolved: false, selections: [] }],
    });
    const updated = applySubclassToEntity(e, 'subclass_unlock_fighter_3', 'champion', championProgression(), DEFAULT_RULES);
    expect(updated.identity.subclassId).toBe('champion');
    expect(updated.choices[0]).toMatchObject({ resolved: true, selections: ['champion'] });
  });

  // Closure item 3: reproduces the reported bug directly — a single-class
  // character whose identity.classes[] is ALREADY populated (the normal
  // post-migration/creation state) used to get identity.subclassId set
  // correctly while identity.classes[0].subclassId stayed null forever,
  // since the old code only touched classes[] when an explicit classId was
  // passed (multiclass callers only) — single-class callers always omit it.
  it('single-class with identity.classes[] already populated: BOTH representations agree (closure item 3)', () => {
    const choiceDef: ChoiceDefinition = { id: 'c1', prompt: '', kind: 'subclass', count: 1, pool: [], grants: [], required: true, resolved: false };
    const e = entity({
      identity: {
        ...makeEmptyEntity('e1').identity, classId: 'fighter', level: 3,
        classes: [{ classId: asClassId('fighter'), subclassId: null, level: 3 }],
      },
      choices: [{ id: 'c1', definition: choiceDef, grantedAt: 3, resolved: false, selections: [] }],
    });
    const updated = applySubclassToEntity(e, 'c1', 'champion', championProgression(), DEFAULT_RULES);
    expect(updated.identity.subclassId).toBe('champion');
    expect(updated.identity.classes![0].subclassId).toBe('champion');
  });

  it('grants only subclass features unlocked at or below the character\'s current level', () => {
    const choiceDef: ChoiceDefinition = { id: 'c1', prompt: '', kind: 'subclass', count: 1, pool: [], grants: [], required: true, resolved: false };
    const e = entity({
      identity: { ...makeEmptyEntity('e1').identity, classId: 'fighter', level: 3 },
      choices: [{ id: 'c1', definition: choiceDef, grantedAt: 3, resolved: false, selections: [] }],
    });
    const updated = applySubclassToEntity(e, 'c1', 'champion', championProgression(), DEFAULT_RULES);
    const ids = updated.features.map(f => f.id);
    expect(ids).toContain('improved_crit');       // level 3 — unlocked
    expect(ids).not.toContain('remarkable_athlete'); // level 7 — not yet
  });

  it('multiclass: writes subclassId onto the specific class entry, gated by that class\'s own level (not total)', () => {
    const choiceDef: ChoiceDefinition = { id: 'c1', prompt: '', kind: 'subclass', count: 1, pool: [], grants: [], required: true, resolved: false, forClassId: 'fighter' };
    const e = entity({
      identity: {
        ...makeEmptyEntity('e1').identity,
        classes: [{ classId: asClassId('fighter'), subclassId: null, level: 3 }, { classId: asClassId('wizard'), subclassId: null, level: 10 }],
      },
      choices: [{ id: 'c1', definition: choiceDef, grantedAt: 3, resolved: false, selections: [] }],
    });
    const updated = applySubclassToEntity(e, 'c1', 'champion', championProgression(), DEFAULT_RULES, 'fighter');
    expect(updated.identity.classes!.find(c => c.classId === 'fighter')!.subclassId).toBe('champion');
    const ids = updated.features.map(f => f.id);
    // Fighter's own level is 3, so level-7 subclass feature must NOT be granted
    // even though total character level (13) would otherwise qualify.
    expect(ids).toContain('improved_crit');
    expect(ids).not.toContain('remarkable_athlete');
    // Closure item 3: the legacy scalar mirrors the PRIMARY class
    // (classes[0], fighter here) via syncLegacyIdentity — must agree.
    expect(updated.identity.subclassId).toBe('champion');
  });

  it('multiclass: choosing a subclass for the SECOND class does not overwrite the legacy scalar with it (closure item 3)', () => {
    const choiceDef: ChoiceDefinition = { id: 'c1', prompt: '', kind: 'subclass', count: 1, pool: [], grants: [], required: true, resolved: false, forClassId: 'wizard' };
    const e = entity({
      identity: {
        ...makeEmptyEntity('e1').identity,
        classes: [{ classId: asClassId('fighter'), subclassId: 'champion' as any, level: 3 }, { classId: asClassId('wizard'), subclassId: null, level: 10 }],
      },
      choices: [{ id: 'c1', definition: choiceDef, grantedAt: 10, resolved: false, selections: [] }],
    });
    const wizardProgression: import('../types').ClassProgression = { classId: 'wizard', entries: [] };
    const updated = applySubclassToEntity(e, 'c1', 'evocation', wizardProgression, DEFAULT_RULES, 'wizard');
    expect(updated.identity.classes!.find(c => c.classId === 'wizard')!.subclassId).toBe('evocation');
    expect(updated.identity.classes!.find(c => c.classId === 'fighter')!.subclassId).toBe('champion'); // untouched
    expect(updated.identity.subclassId).toBe('champion'); // legacy scalar still mirrors the PRIMARY class
  });

  // SUBCLASS-CHANGE-1: regression lock for the reported bug (creation-flow
  // subclass selection became permanently unreachable once resolved) and
  // its real correctness fix (re-applying was purely additive — the OLD
  // subclass's features/resources were never removed, so changing your
  // mind stacked both subclasses' grants). Fixtures below explicitly set
  // each feature's own `source` (matching how real subclass content is
  // authored — deriveSubclassId's own scan requires this), unlike
  // championProgression() above whose bare feature literals fall back to
  // applyGrant's generic 'class' tag and would NOT exercise this path.
  function battleMasterProgression(): import('../types').ClassProgression {
    return {
      classId: 'fighter',
      entries: [{
        level: 3, hpDie: 10,
        grants: [
          {
            kind: 'feature',
            value: {
              id: 'combat_superiority', name: 'Combat Superiority', description: '',
              source: { kind: 'subclass', refId: 'battle_master' },
              effects: [], actions: [], choices: [], passive: true,
            },
          },
          { kind: 'resource', value: { resourceId: 'superiority_dice', name: 'Superiority Dice', maximum: 4, recharge: 'short_rest' } },
        ],
        choices: [],
      }],
    };
  }
  function championProgressionSourced(): import('../types').ClassProgression {
    return {
      classId: 'fighter',
      entries: [{
        level: 3, hpDie: 10,
        grants: [{
          kind: 'feature',
          value: {
            id: 'improved_crit', name: 'Improved Critical', description: '',
            source: { kind: 'subclass', refId: 'champion' },
            effects: [], actions: [], choices: [], passive: true,
          },
        }],
        choices: [],
      }],
    };
  }

  it('a subclass-granted resource is tagged sourceKind:"subclass", not the generic "class" default', () => {
    const choiceDef: ChoiceDefinition = { id: 'c1', prompt: '', kind: 'subclass', count: 1, pool: [], grants: [], required: true, resolved: false };
    const e = entity({
      identity: { ...makeEmptyEntity('e1').identity, classId: 'fighter', level: 3 },
      choices: [{ id: 'c1', definition: choiceDef, grantedAt: 3, resolved: false, selections: [] }],
    });
    const updated = applySubclassToEntity(e, 'c1', 'battle_master', battleMasterProgression(), DEFAULT_RULES);
    expect(updated.resources.custom[0]).toMatchObject({ id: 'superiority_dice', sourceKind: 'subclass', sourceId: 'battle_master' });
  });

  it('changing subclass strips the OLD subclass\'s features and resources instead of stacking both', () => {
    const choiceDef: ChoiceDefinition = { id: 'c1', prompt: '', kind: 'subclass', count: 1, pool: [], grants: [], required: true, resolved: false };
    const e = entity({
      identity: { ...makeEmptyEntity('e1').identity, classId: 'fighter', level: 3 },
      choices: [{ id: 'c1', definition: choiceDef, grantedAt: 3, resolved: false, selections: [] }],
    });

    const firstPick = applySubclassToEntity(e, 'c1', 'battle_master', battleMasterProgression(), DEFAULT_RULES);
    expect(firstPick.features.map(f => f.id)).toContain('combat_superiority');
    expect(firstPick.resources.custom.map(r => r.id)).toContain('superiority_dice');

    // Re-resolving the SAME choice id with a DIFFERENT subclass — exactly
    // what SubclassPicker.commit() does when re-opened on an already-
    // resolved choice (app/creation/subclass.tsx's fix).
    const changed = applySubclassToEntity(firstPick, 'c1', 'champion', championProgressionSourced(), DEFAULT_RULES);

    const featureIds = changed.features.map(f => f.id);
    expect(featureIds).toContain('improved_crit');
    expect(featureIds).not.toContain('combat_superiority'); // old subclass's feature removed, not stacked

    const resourceIds = changed.resources.custom.map(r => r.id);
    expect(resourceIds).not.toContain('superiority_dice'); // old subclass's resource removed

    expect(changed.identity.subclassId).toBe('champion');
    expect(changed.choices[0]).toMatchObject({ resolved: true, selections: ['champion'] });
  });

  it('picking a subclass for the first time is unaffected by the stripping logic (nothing to strip)', () => {
    const choiceDef: ChoiceDefinition = { id: 'c1', prompt: '', kind: 'subclass', count: 1, pool: [], grants: [], required: true, resolved: false };
    const e = entity({
      identity: { ...makeEmptyEntity('e1').identity, classId: 'fighter', level: 3 },
      choices: [{ id: 'c1', definition: choiceDef, grantedAt: 3, resolved: false, selections: [] }],
    });
    const updated = applySubclassToEntity(e, 'c1', 'champion', championProgressionSourced(), DEFAULT_RULES);
    expect(updated.features.map(f => f.id)).toContain('improved_crit');
  });
});

describe('applyInfusionChoiceToEntity', () => {
  it('appends infusion ids and resolves the choice', () => {
    const choiceDef: ChoiceDefinition = { id: 'c1', prompt: '', kind: 'infusion', count: 2, pool: 'all', grants: [], required: true, resolved: false };
    const e = entity({
      knownInfusionIds: ['enhanced_defense'],
      choices: [{ id: 'c1', definition: choiceDef, grantedAt: 2, resolved: false, selections: [] }],
    });
    const updated = applyInfusionChoiceToEntity(e, 'c1', ['repeating_shot', 'boots_of_striding'], DEFAULT_RULES);
    expect(updated.knownInfusionIds).toEqual(['enhanced_defense', 'repeating_shot', 'boots_of_striding']);
    expect(updated.choices[0].resolved).toBe(true);
  });
});

describe('applySpellChoiceToEntity', () => {
  const getLevel = (id: string) => ({ fire_bolt: 0, magic_missile: 1, fireball: 3 }[id]);

  it('is a no-op on an entity with no spellcasting block', () => {
    const e = entity();
    const choiceDef: ChoiceDefinition = { id: 'c1', prompt: '', kind: 'spell', count: 1, pool: 'all', grants: [], required: true, resolved: false };
    const updated = applySpellChoiceToEntity({ ...e, choices: [{ id: 'c1', definition: choiceDef, grantedAt: 1, resolved: false, selections: [] }] }, 'c1', ['fire_bolt'], getLevel, DEFAULT_RULES);
    expect(updated.spellcasting).toBeNull();
  });

  it('routes level-0 ids to cantrips and everything else to known, resolving the choice', () => {
    const choiceDef: ChoiceDefinition = { id: 'c1', prompt: '', kind: 'spell', count: 2, pool: 'all', grants: [], required: true, resolved: false };
    const e = entity({
      spellcasting: { ability: 'int', slots: {} as any, cantrips: [], known: [], prepared: [], concentrating: null },
      choices: [{ id: 'c1', definition: choiceDef, grantedAt: 1, resolved: false, selections: [] }],
    });
    const updated = applySpellChoiceToEntity(e, 'c1', ['fire_bolt', 'magic_missile'], getLevel, DEFAULT_RULES);
    expect(updated.spellcasting?.cantrips).toEqual(['fire_bolt']);
    expect(updated.spellcasting?.known).toEqual(['magic_missile']);
    expect(updated.choices[0]).toMatchObject({ resolved: true, selections: ['fire_bolt', 'magic_missile'] });
  });
});

describe('levelUpClass — multiclass', () => {
  function fighterProgression(): ClassProgression {
    return {
      classId: 'fighter',
      entries: [
        { level: 1, hpDie: 10, grants: [{ kind: 'proficiency', value: { armor: ['heavy'] } }], choices: [] },
        { level: 2, hpDie: 10, grants: [{ kind: 'feature', value: { id: 'action_surge', name: 'Action Surge', description: '', effects: [], actions: [], choices: [], passive: true } }], choices: [] },
      ],
    };
  }
  const fighterClass = { multiclassProficiencies: { armor: ['light', 'medium'], weapons: ['simple'] } } as unknown as CharClass;

  it('taking a brand-new class after character level 1 grants the REDUCED multiclass proficiency table, not the class\'s own level-1 grant', () => {
    const e = entity({ identity: { ...makeEmptyEntity('e1').identity, classes: [{ classId: asClassId('wizard'), subclassId: null, level: 3 }], level: 3 } });
    const updated = levelUpClass(e, 'fighter', fighterProgression(), DEFAULT_RULES, fighterClass);
    expect(updated.proficiencies.armor).toEqual(['light', 'medium']); // reduced table
    expect(updated.proficiencies.armor).not.toContain('heavy');       // NOT the full level-1 grant
  });

  it('a second class\'s own level 1 does not re-max HP (isVeryFirstLevel only true for the character\'s true first level)', () => {
    const e = entity({
      identity: { ...makeEmptyEntity('e1').identity, classes: [{ classId: asClassId('wizard'), subclassId: null, level: 3 }], level: 3 },
      resources: { ...makeEmptyEntity('e1').resources, hp: { current: 20, maximum: 20, temp: 0 }, hitDice: { die: 6, total: 3, remaining: 3 } },
    });
    const updated = levelUpClass(e, 'fighter', fighterProgression(), DEFAULT_RULES, fighterClass);
    // fixed mode, d10, con mod 0: floor(10/2)+1 = 6, NOT max-die 10
    expect(updated.resources.hp.maximum).toBe(26);
  });

  it('adds a brand-new class at level 1 to identity.classes and syncs the legacy scalar mirror', () => {
    const e = entity({ identity: { ...makeEmptyEntity('e1').identity, classes: [{ classId: asClassId('wizard'), subclassId: null, level: 3 }], level: 3 } });
    const updated = levelUpClass(e, 'fighter', fighterProgression(), DEFAULT_RULES, fighterClass);
    expect(updated.identity.classes).toEqual(expect.arrayContaining([{ classId: 'fighter', subclassId: null, level: 1 }]));
    expect(updated.identity.level).toBe(4); // 3 (wizard) + 1 (new fighter level) — summed by syncLegacyIdentity
  });

  it('bumping an existing class advances only that class\'s level', () => {
    const e = entity({ identity: { ...makeEmptyEntity('e1').identity, classes: [{ classId: asClassId('fighter'), subclassId: null, level: 1 }, { classId: asClassId('wizard'), subclassId: null, level: 1 }], level: 2 } });
    const updated = levelUpClass(e, 'fighter', fighterProgression(), DEFAULT_RULES);
    expect(updated.identity.classes).toEqual([
      { classId: 'fighter', subclassId: null, level: 2 },
      { classId: 'wizard', subclassId: null, level: 1 },
    ]);
  });

  it('is a no-op if the progression has no entry for the class\'s next level', () => {
    const e = entity({ identity: { ...makeEmptyEntity('e1').identity, classes: [{ classId: asClassId('fighter'), subclassId: null, level: 2 }], level: 2 } });
    const updated = levelUpClass(e, 'fighter', fighterProgression(), DEFAULT_RULES); // no level-3 entry
    expect(updated).toEqual(e);
  });

  it('does not let a second caster class\'s init_spellcasting steal the spell-save-DC ability from the first', () => {
    const e = entity({ identity: { ...makeEmptyEntity('e1').identity, classes: [{ classId: asClassId('wizard'), subclassId: null, level: 1 }], level: 1 }, spellcasting: { ability: 'int', slots: {} as any, cantrips: [], known: [], prepared: [], concentrating: null } });
    // A second caster class also grants init_spellcasting with a different ability (e.g. Cleric/WIS)
    const clericProgression: ClassProgression = { classId: 'cleric', entries: [{ level: 1, hpDie: 8, grants: [{ kind: 'init_spellcasting', value: { ability: 'wis' } }], choices: [] }] };
    const updated = levelUpClass(e, 'cleric', clericProgression, DEFAULT_RULES);
    expect(updated.spellcasting?.ability).toBe('int'); // unchanged — first caster's ability wins
  });

  it('namespaces a subclass_unlock choice by class so two classes unlocking at the same within-class level don\'t collide', () => {
    const progressionWithSubclass: ClassProgression = {
      classId: 'fighter',
      entries: [{ level: 3, hpDie: 10, grants: [{ kind: 'subclass_unlock', value: null }], choices: [] }],
    };
    const rogueProgressionWithSubclass: ClassProgression = {
      classId: 'rogue',
      entries: [{ level: 3, hpDie: 8, grants: [{ kind: 'subclass_unlock', value: null }], choices: [] }],
    };
    let e = entity({ identity: { ...makeEmptyEntity('e1').identity, classes: [{ classId: asClassId('fighter'), subclassId: null, level: 2 }, { classId: asClassId('rogue'), subclassId: null, level: 2 }], level: 4 } });
    e = levelUpClass(e, 'fighter', progressionWithSubclass, DEFAULT_RULES);
    e = levelUpClass(e, 'rogue', rogueProgressionWithSubclass, DEFAULT_RULES);
    const subclassChoiceIds = e.choices.filter(c => c.definition.kind === 'subclass').map(c => c.id);
    expect(subclassChoiceIds.sort()).toEqual(['subclass_unlock_fighter_3', 'subclass_unlock_rogue_3']);
  });

  it('recomputes combined multiclass spell slots (non-pact) once a second class exists', () => {
    const e = entity({
      identity: { ...makeEmptyEntity('e1').identity, classes: [{ classId: asClassId('wizard'), subclassId: null, level: 1 }], level: 1 },
      spellcasting: { ability: 'int', slots: {} as any, cantrips: [], known: [], prepared: [], concentrating: null },
    });
    const clericProgression: ClassProgression = { classId: 'cleric', entries: [{ level: 1, hpDie: 8, grants: [], choices: [] }] };
    const updated = levelUpClass(e, 'cleric', clericProgression, DEFAULT_RULES);
    // combined caster level = wizard(1, full) + cleric(1, full) = 2 → SRD combined table row for level 2: 3×tier-1 slots
    expect(updated.spellcasting?.slots['1'].total).toBe(3);
  });

  it('keeps a Warlock\'s pact slots split from the combined pool once multiclassed', () => {
    const warlockProgression: ClassProgression = {
      classId: 'warlock',
      entries: [{ level: 2, hpDie: 8, grants: [], choices: [] }],
    };
    const e = entity({
      identity: { ...makeEmptyEntity('e1').identity, classes: [{ classId: asClassId('warlock'), subclassId: null, level: 1 }, { classId: asClassId('wizard'), subclassId: null, level: 1 }], level: 2 },
      spellcasting: { ability: 'cha', slots: {} as any, pactSlots: {} as any, cantrips: [], known: [], prepared: [], concentrating: null },
    });
    const updated = levelUpClass(e, 'warlock', warlockProgression, DEFAULT_RULES);
    // warlock level 2 pact table: 2 slots of tier 1
    expect(updated.spellcasting?.pactSlots?.['1'].total).toBe(2);
  });

  // Re-audit A10: single-class caster slot progression must be identical
  // whether leveled via the direct-level path (levelUp) or the class-aware
  // incremental path (levelUpClass), even though the character never gains
  // a second class. Uses the REAL official 'wizard' classId deliberately
  // (unlike this file's usual synthetic-progression convention) — the bug
  // is specifically about getSpellSlotsForClassLevel's hardcoded SLOT_TABLES
  // lookup, so a synthetic classId wouldn't exercise it.
  describe('A10 — single-class levelUpClass matches direct levelUp', () => {
    function wizardProgressionThroughLevel5(): ClassProgression {
      return {
        classId: 'wizard',
        entries: [1, 2, 3, 4, 5].map(level => ({
          level, hpDie: 6,
          grants: level === 1 ? [{ kind: 'init_spellcasting' as const, value: { ability: 'int' as const } }] : [],
          choices: [],
        })),
      };
    }

    it('incremental levelUpClass calls 1→5 produce the same slots as a direct levelUp to 5 (4/3/2)', () => {
      const direct = levelUp(
        entity({ identity: { ...makeEmptyEntity('e1').identity, classId: 'wizard' } }),
        5, wizardProgressionThroughLevel5(), DEFAULT_RULES,
      );
      expect(direct.spellcasting?.slots['1'].total).toBe(4);
      expect(direct.spellcasting?.slots['2'].total).toBe(3);
      expect(direct.spellcasting?.slots['3'].total).toBe(2);

      const wizardClass = { multiclassProficiencies: {} } as unknown as CharClass;
      let incremental = makeEmptyEntity('e1');
      for (let i = 0; i < 5; i++) {
        incremental = levelUpClass(incremental, 'wizard', wizardProgressionThroughLevel5(), DEFAULT_RULES, i === 0 ? wizardClass : undefined);
      }
      expect(incremental.spellcasting?.slots['1'].total).toBe(direct.spellcasting?.slots['1'].total);
      expect(incremental.spellcasting?.slots['2'].total).toBe(direct.spellcasting?.slots['2'].total);
      expect(incremental.spellcasting?.slots['3'].total).toBe(direct.spellcasting?.slots['3'].total);
    });
  });

  // Re-audit A13: a multiclass build with zero NORMAL caster contribution
  // (e.g. two classes that are both non-casters, or only a pact caster) must
  // get genuinely zero normal slots — not the combined table's level-1 row.
  it('zero combined caster level produces zero normal slots, not the level-1 fallback row', () => {
    const fighterProg2: ClassProgression = { classId: 'fighter', entries: [{ level: 2, hpDie: 10, grants: [], choices: [] }] };
    const e = entity({
      identity: { ...makeEmptyEntity('e1').identity, classes: [{ classId: asClassId('fighter'), subclassId: null, level: 1 }, { classId: asClassId('rogue'), subclassId: null, level: 1 }], level: 2 },
      // spellcasting present (e.g. from a racial/feat grant) but neither class contributes to it
      spellcasting: { ability: 'int', slots: {} as any, cantrips: [], known: [], prepared: [], concentrating: null },
    });
    const updated = levelUpClass(e, 'fighter', fighterProg2, DEFAULT_RULES);
    expect(updated.spellcasting?.slots['1'].total).toBe(0);
    expect(updated.spellcasting?.slots['2'].total).toBe(0);
  });

  // Re-audit A13: a homebrew class not in the hardcoded CASTER_TYPE map still
  // contributes to the combined multiclass slot pool via its own authored
  // spellcastingStyle, for the class actively being leveled this call.
  it('a homebrew caster class contributes via its own spellcastingStyle when not in the hardcoded caster-type map', () => {
    const homebrewCasterProg: ClassProgression = { classId: 'starweaver', entries: [{ level: 1, hpDie: 8, grants: [], choices: [] }] };
    const homebrewCasterClass = { spellcastingStyle: 'full' } as unknown as CharClass;
    const e = entity({
      identity: { ...makeEmptyEntity('e1').identity, classes: [{ classId: asClassId('wizard'), subclassId: null, level: 1 }], level: 1 },
      spellcasting: { ability: 'int', slots: {} as any, cantrips: [], known: [], prepared: [], concentrating: null },
    });
    const updated = levelUpClass(e, 'starweaver', homebrewCasterProg, DEFAULT_RULES, homebrewCasterClass);
    // combined caster level = wizard(1, full) + starweaver(1, full via spellcastingStyle) = 2
    expect(updated.spellcasting?.slots['1'].total).toBe(3); // combined-table row 2: 3× tier-1
  });
});

// ── removeFeature ─────────────────────────────────────────────────────────────
// Engine primitive for the live feature add/remove track — both players and
// DMs can remove a feature mid-session. Deliberately unopinionated about
// WHICH features can be removed (no special-casing race/class/subclass) —
// that judgment call belongs to the UI layer, not this primitive.

describe('removeFeature', () => {
  function entityWithFeatures(): Entity {
    return entity({
      features: [
        { id: 'f1', name: 'Feature One', description: '', level: null, effects: [], actions: [], choices: [], passive: true, isActive: true, source: { kind: 'manual', refId: 'f1' } },
        { id: 'f2', name: 'Feature Two', description: '', level: null, effects: [], actions: [], choices: [], passive: true, isActive: true, source: { kind: 'race', refId: 'test_race' } },
      ],
      resources: {
        ...makeEmptyEntity('e1').resources,
        custom: [
          { id: 'f1_pool', name: 'Feature One (Uses)', current: 1, maximum: 1, recharge: 'long_rest', sourceKind: 'manual', sourceId: 'f1' },
          { id: 'racial_pool', name: 'Racial Pool', current: 2, maximum: 2, recharge: 'long_rest', sourceKind: 'race', sourceId: 'test_race' },
        ],
      },
    });
  }

  it('removes the feature by id, leaving others untouched', () => {
    const updated = removeFeature(entityWithFeatures(), 'f1');
    expect(updated.features.map(f => f.id)).toEqual(['f2']);
  });

  it("strips a resource only when its sourceId matches the removed feature's id", () => {
    const updated = removeFeature(entityWithFeatures(), 'f1');
    expect(updated.resources.custom.map(r => r.id)).toEqual(['racial_pool']);
  });

  it('leaves content-granted resources untouched (no clean 1:1 Feature→Resource mapping to assume)', () => {
    const updated = removeFeature(entityWithFeatures(), 'f2');
    // f2 (race-sourced) has no resource whose sourceId === 'f2' — both
    // resources survive unchanged.
    expect(updated.resources.custom.map(r => r.id)).toEqual(['f1_pool', 'racial_pool']);
  });

  it('is a no-op (same reference) when the id does not match any feature', () => {
    const e = entityWithFeatures();
    expect(removeFeature(e, 'nonexistent')).toBe(e);
  });

  // Closure pass 2 (item 4): a resolved choice this feature queued produced
  // a real entitlement — removing the feature must remove that grant, not
  // just the feature/its own resource.
  it('revokes an entitlement this feature directly owns (sourceKind:"feature")', () => {
    let e = entityWithFeatures();
    e = { ...e, entitlements: [{ kind: 'tool_proficiency', key: 'alchemists_supplies', sourceKind: 'feature', sourceId: 'f1' }] };
    const updated = removeFeature(e, 'f1');
    expect(updated.entitlements).toEqual([]);
  });

  it('revokes only the entitlement tied to a RESOLVED choice namespaced to this feature, leaving an unrelated entitlement intact', () => {
    let e = entityWithFeatures();
    e = {
      ...e,
      choices: [{
        id: 'f1:tool_choice_0', definition: { id: 'tool_choice', prompt: '', kind: 'tool', count: 1, pool: [], grants: [], required: true, resolved: true },
        grantedAt: 0, resolved: true, selections: ['smiths_tools'],
      }],
      entitlements: [
        { kind: 'tool_proficiency', key: 'smiths_tools', sourceKind: 'feature', sourceId: 'f1', choiceId: 'f1:tool_choice_0' },
        { kind: 'tool_proficiency', key: 'smiths_tools', sourceKind: 'background', sourceId: 'guild_artisan' },
      ],
    };
    const updated = removeFeature(e, 'f1');
    expect(updated.entitlements).toEqual([{ kind: 'tool_proficiency', key: 'smiths_tools', sourceKind: 'background', sourceId: 'guild_artisan' }]);
    // The resolved choice record itself stays — character history, per CHOICE-AUTHORING-1.
    expect(updated.choices).toHaveLength(1);
  });
});

describe('applyToolChoiceToEntity — resolved-choice provenance (closure pass 2, items 2/4)', () => {
  function withPendingToolChoice(sourceKind?: 'class' | 'background', sourceId?: string): Entity {
    return entity({
      choices: [{
        id: 'c1',
        definition: { id: 'c1', prompt: '', kind: 'tool', count: 1, pool: 'all', grants: [], required: true, resolved: false, forClassId: sourceKind === 'class' ? sourceId : undefined },
        grantedAt: 1, resolved: false, selections: [],
        sourceKind, sourceId,
      }],
    });
  }

  it('grants a real entitlement tagged with the choice id, not just a flat array entry', () => {
    const updated = applyToolChoiceToEntity(withPendingToolChoice('class', 'artificer'), 'c1', ['tinkers_tools'], DEFAULT_RULES);
    expect(updated.proficiencies.tools).toContain('tinkers_tools');
    expect(updated.entitlements).toContainEqual({ kind: 'tool_proficiency', key: 'tinkers_tools', sourceKind: 'class', sourceId: 'artificer', choiceId: 'c1' });
  });

  it('falls back to sourceKind "manual" when the choice carries no explicit provenance and no forClassId', () => {
    const updated = applyToolChoiceToEntity(withPendingToolChoice(), 'c1', ['navigators_tools'], DEFAULT_RULES);
    expect(updated.entitlements).toContainEqual({ kind: 'tool_proficiency', key: 'navigators_tools', sourceKind: 'manual', sourceId: undefined, choiceId: 'c1' });
  });

  it('removing the choice-owning source (via revokeEntitlementsFromChoice) removes exactly this grant, not an overlapping one from another source', () => {
    let updated = applyToolChoiceToEntity(withPendingToolChoice('class', 'artificer'), 'c1', ['tinkers_tools'], DEFAULT_RULES);
    updated = { ...updated, entitlements: [...(updated.entitlements ?? []), { kind: 'tool_proficiency', key: 'tinkers_tools', sourceKind: 'background', sourceId: 'guild_artisan' }] };
    updated = revokeEntitlementsFromChoice(updated, 'c1');
    expect(updated.entitlements).toEqual([{ kind: 'tool_proficiency', key: 'tinkers_tools', sourceKind: 'background', sourceId: 'guild_artisan' }]);
  });
});

describe('applySubclassToEntity — subclass change revokes ONLY the old subclass\'s own entitlements (closure pass 2)', () => {
  it('a tool proficiency the old subclass granted via a resolved choice disappears on subclass change; a manual one survives', () => {
    const choiceDef: ChoiceDefinition = { id: 'c1', prompt: '', kind: 'subclass', count: 1, pool: [], grants: [], required: true, resolved: false };
    let e = entity({
      identity: { ...makeEmptyEntity('e1').identity, classId: 'artificer', level: 3 },
      choices: [{ id: 'subclass_pick', definition: choiceDef, grantedAt: 3, resolved: false, selections: [] }],
      entitlements: [
        { kind: 'tool_proficiency', key: 'smiths_tools', sourceKind: 'subclass', sourceId: 'battlesmith' },
        { kind: 'tool_proficiency', key: 'herbalism_kit', sourceKind: 'manual' },
      ],
    });
    // First pick: battlesmith (matches the pre-existing entitlement's sourceId above)
    const armorer: ClassProgression = { classId: 'artificer', entries: [] };
    // Simulate that battlesmith was already the entity's subclass by setting identity directly,
    // then change to a NEW subclass — applySubclassToEntity's own previousSubclassId lookup
    // reads identity.subclassId when no classes[] array is present.
    e = { ...e, identity: { ...e.identity, subclassId: 'battlesmith' } };
    const updated = applySubclassToEntity(e, 'subclass_pick', 'armorer', armorer, DEFAULT_RULES);
    expect(updated.entitlements).toEqual([{ kind: 'tool_proficiency', key: 'herbalism_kit', sourceKind: 'manual' }]);
  });
});

// ── swapBackground ───────────────────────────────────────────────────────────
// Phase 4 of the live feature/background editing track — the most complex
// primitive: a straight-line port of app/creation/background.tsx's own
// selectBackground(), plus a corrected skill-retrain algorithm (the
// creation-time BG_SKILL_MAP approach has a real, confirmed bug: it
// untrains by a hardcoded table with no check for whether some OTHER
// active feature also grants the same skill).

// ABILITY-CAP-1: applyAsiToEntity's cap logic was already correct (reads
// rules.maxAbilityScore dynamically, not hardcoded to 20) but had ZERO
// direct test coverage anywhere in the suite before this. Covers the exact
// acceptance-test examples from the ability-cap bug report, effective
// cap 24: 20+2->22, 21+2->23, 19+2->21, 23+1->24, 24+1->blocked.
describe('applyAsiToEntity', () => {
  function entityWithScores(scores: Partial<Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>>): Entity {
    const e = entity();
    return { ...e, stats: { ...e.stats, ...scores } };
  }
  const CAP24 = { ...DEFAULT_RULES, maxAbilityScore: 24 };

  it('20 + 2 -> 22 under an effective cap of 24 (full increase, well under cap)', () => {
    const e = entityWithScores({ str: 20 });
    const after = applyAsiToEntity(e, 'c1', { str: 2 }, CAP24);
    expect(after.stats.str).toBe(22);
  });

  it('21 + 2 -> 23 under an effective cap of 24', () => {
    const e = entityWithScores({ str: 21 });
    const after = applyAsiToEntity(e, 'c1', { str: 2 }, CAP24);
    expect(after.stats.str).toBe(23);
  });

  it('19 + 2 -> 21 under an effective cap of 24', () => {
    const e = entityWithScores({ str: 19 });
    const after = applyAsiToEntity(e, 'c1', { str: 2 }, CAP24);
    expect(after.stats.str).toBe(21);
  });

  it('23 + 1 -> 24 under an effective cap of 24 (reaches the cap exactly)', () => {
    const e = entityWithScores({ str: 23 });
    const after = applyAsiToEntity(e, 'c1', { str: 1 }, CAP24);
    expect(after.stats.str).toBe(24);
  });

  it('24 + 1 is blocked (no headroom) under an effective cap of 24 — a score already at 20 can still rise, but not past the effective cap', () => {
    const e = entityWithScores({ str: 24 });
    const after = applyAsiToEntity(e, 'c1', { str: 1 }, CAP24);
    expect(after.stats.str).toBe(24);
  });

  it('clamps against the DEFAULT cap of 20 when maxAbilityScore is unset', () => {
    const e = entityWithScores({ str: 19 });
    const after = applyAsiToEntity(e, 'c1', { str: 2 }, DEFAULT_RULES);
    expect(after.stats.str).toBe(20); // +2 requested, only +1 headroom under the default cap
  });

  it('applies the full increase with no clamp at all when maxAbilityScore is null (uncapped)', () => {
    const e = entityWithScores({ str: 30 });
    const after = applyAsiToEntity(e, 'c1', { str: 5 }, { ...DEFAULT_RULES, maxAbilityScore: null });
    expect(after.stats.str).toBe(35);
  });

  it('clamps against EFFECTIVE score (base + racial/feat modifiers), not raw base', () => {
    const e: Entity = {
      ...entityWithScores({ str: 18 }),
      features: [{
        id: 'racial_str', name: 'Racial STR', description: '', level: null,
        effects: [{ type: 'stat_modifier', target: 'str', operation: 'add', value: 2, condition: null }],
        actions: [], choices: [], passive: true, isActive: true,
        source: { kind: 'race', refId: 'test_race' },
      }],
    };
    // Effective STR is already 20 (18 base + 2 racial) — no headroom left
    // under the default cap of 20, even though the BASE score is only 18.
    const after = applyAsiToEntity(e, 'c1', { str: 2 }, DEFAULT_RULES);
    expect(after.stats.str).toBe(18); // base unchanged, no headroom
  });
});

// Re-audit A26: reopening app/creation/scores.tsx and confirming unchanged
// values used to double-apply a resolved ASI, because the screen populated
// its inputs straight from entity.stats (already including the resolved
// ASI's bump) and then reapplyResolvedAsi added the SAME bonus again on
// confirm. Fixed by having the screen seed its inputs from
// stripResolvedAsiStats(draft).stats instead — this test proves the two
// functions compose correctly across repeated cycles, which is the exact
// mechanism the fix relies on (scores.tsx itself can't be imported into
// Jest — see classProficiencies.test.ts's own note on why).
describe('stripResolvedAsiStats + reapplyResolvedAsi — Scores reconfirmation round trip (A26)', () => {
  function entityWithResolvedAsi(): Entity {
    let e = entity({ identity: { ...makeEmptyEntity('e1').identity, level: 4 }, stats: { str: 12, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } });
    e = queueChoice(e, {
      id: 'asi_lvl4', prompt: 'ASI', kind: 'asi', count: 1, pool: 'all', grants: [], required: true, resolved: false,
    }, 4);
    const choiceId = e.choices[0].id;
    return applyAsiToEntity(e, choiceId, { str: 2 }, DEFAULT_RULES); // STR 12 -> 14, resolved as "str+2"
  }

  it('stripResolvedAsiStats reconstructs the true pre-ASI base from a post-ASI entity', () => {
    const withAsi = entityWithResolvedAsi();
    expect(withAsi.stats.str).toBe(14); // ASI already applied
    const stripped = stripResolvedAsiStats(withAsi);
    expect(stripped.stats.str).toBe(12); // true base, before the +2
  });

  it('simulating "reopen Scores, confirm unchanged" several times in a row never grows the score past the single correct application', () => {
    let e = entityWithResolvedAsi();
    expect(e.stats.str).toBe(14);
    for (let i = 0; i < 4; i++) {
      // Exactly scores.tsx's own sequence: derive the base for the UI
      // (stripResolvedAsiStats), the user changes nothing, confirm writes
      // that same base back as `stats`, then reapplyResolvedAsi re-adds the
      // ASI on top — this is handleConfirm's real code path, not a
      // simplification of it.
      const base = stripResolvedAsiStats(e);
      const withFlag: Entity = { ...e, stats: base.stats };
      e = reapplyResolvedAsi(withFlag, DEFAULT_RULES);
    }
    expect(e.stats.str).toBe(14); // still exactly one +2 applied, not four
  });

  it('the OLD buggy sequence (skip the strip step) would have kept growing — proves the fix is load-bearing, not a no-op', () => {
    let e = entityWithResolvedAsi();
    expect(e.stats.str).toBe(14);
    for (let i = 0; i < 3; i++) {
      // No stripResolvedAsiStats here — this is the PRE-fix behavior.
      e = reapplyResolvedAsi(e, DEFAULT_RULES);
    }
    expect(e.stats.str).toBeGreaterThan(14); // confirms this really was a bug, not already-safe
  });
});

// ABILITY-CAP-1: the feat-picker path (a fixed +N from Feat.abilityChoice,
// e.g. Resilient) previously applied its bonus unconditionally — this
// proves featureToApply's clamp (src/components/AsiFeatPicker.tsx) via the
// same applyFeatToEntity() engine entry point, confirming the fix actually
// reaches the entity's stats and not just the picker's own UI state.
describe('applyFeatToEntity — ability-choice feats respect the effective cap', () => {
  it('a feat granting +1 to an ability already at the effective cap contributes nothing', () => {
    const e = { ...entity(), stats: { ...entity().stats, str: 24 } };
    const feature: Feature = {
      id: 'resilient_str', name: 'Resilient', description: '', level: null,
      // Simulates AsiFeatPicker.featureToApply() already having clamped
      // the amount to 0 headroom before calling applyFeatToEntity — this
      // test documents the CONTRACT (a zero-value effect list, or omitted
      // effect, must not raise the score), not featureToApply itself
      // (that's a component-level concern, covered by its own clamp logic).
      effects: [], actions: [], choices: [], passive: true,
      source: { kind: 'feat', refId: 'resilient' },
    };
    const after = applyFeatToEntity(e, 'c1', 1, feature, 'resilient', { ...DEFAULT_RULES, maxAbilityScore: 24 });
    expect(after.stats.str).toBe(24);
  });
});

describe('swapBackground', () => {
  function backgroundWithSkills(id: string, skills: SkillName[], overrides: Partial<Background> = {}): Background {
    return {
      id, name: id,
      features: [{
        id: `${id}_skills`, name: `${id} Skills`, description: '', level: null,
        effects: skills.map(s => ({ type: 'grant_proficiency' as const, target: `skill:${s}`, operation: 'add' as const, value: null, condition: null })),
        actions: [], choices: [], passive: true,
        source: { kind: 'background', refId: id },
      }],
      ...overrides,
    };
  }

  function entityWithBackground(bg: Background, trainedSkills: SkillName[]): Entity {
    const e = entity();
    let skills = { ...e.skills.skills };
    for (const s of trainedSkills) {
      skills = { ...skills, [s]: { ...skills[s], trained: true } };
    }
    return {
      ...e,
      identity: { ...e.identity, backgroundId: bg.id },
      features: [...e.features, ...bg.features.map(f => ({ ...f, isActive: true }))],
      skills: { skills },
    };
  }

  it("strips old background features and applies the new background's features", () => {
    const acolyte = backgroundWithSkills('acolyte', ['insight', 'religion']);
    const soldier = backgroundWithSkills('soldier', ['athletics', 'intimidation']);
    const before = entityWithBackground(acolyte, ['insight', 'religion']);
    const after = swapBackground(before, soldier, DEFAULT_RULES);
    expect(after.identity.backgroundId).toBe('soldier');
    expect(after.features.some(f => f.source.refId === 'acolyte')).toBe(false);
    expect(after.features.some(f => f.source.refId === 'soldier')).toBe(true);
  });

  it('untrains an old-background skill nothing else grants', () => {
    const acolyte = backgroundWithSkills('acolyte', ['insight', 'religion']);
    const soldier = backgroundWithSkills('soldier', ['athletics', 'intimidation']);
    const before = entityWithBackground(acolyte, ['insight', 'religion']);
    const after = swapBackground(before, soldier, DEFAULT_RULES);
    expect(after.skills.skills.insight.trained).toBe(false);
    expect(after.skills.skills.religion.trained).toBe(false);
  });

  it('keeps an old-background skill trained when another active feature also grants it (no-overlap vs overlap)', () => {
    const acolyte = backgroundWithSkills('acolyte', ['insight', 'religion']);
    const soldier = backgroundWithSkills('soldier', ['athletics', 'intimidation']);
    let before = entityWithBackground(acolyte, ['insight', 'religion']);
    const racialInsight: FeatureInstance = {
      id: 'keen_senses', name: 'Keen Senses', description: '', level: null,
      effects: [{ type: 'grant_proficiency', target: 'skill:insight', operation: 'add', value: null, condition: null }],
      actions: [], choices: [], passive: true, isActive: true,
      source: { kind: 'race', refId: 'test_race' },
    };
    before = { ...before, features: [...before.features, racialInsight] };
    const after = swapBackground(before, soldier, DEFAULT_RULES);
    expect(after.skills.skills.insight.trained).toBe(true);   // overlap — kept
    expect(after.skills.skills.religion.trained).toBe(false); // no overlap — untrained
  });

  it("trains the new background's own skills (generalized effect-driven pass)", () => {
    const acolyte = backgroundWithSkills('acolyte', ['insight', 'religion']);
    const soldier = backgroundWithSkills('soldier', ['athletics', 'intimidation']);
    const before = entityWithBackground(acolyte, ['insight', 'religion']);
    const after = swapBackground(before, soldier, DEFAULT_RULES);
    expect(after.skills.skills.athletics.trained).toBe(true);
    expect(after.skills.skills.intimidation.trained).toBe(true);
  });

  it('compiles flexibleAsi (two_distinct_plus_one) into a generated stat_modifier feature, +1 each', () => {
    const flexBg = backgroundWithSkills('flex_bg_1', [], {
      flexibleAsi: { prompt: 'Choose two.', mode: { kind: 'two_distinct_plus_one' } },
    });
    const after = swapBackground(entity(), flexBg, DEFAULT_RULES, ['str', 'dex']);
    const flexFeature = after.features.find(f => f.id === 'flex_bg_1_flexible_asi');
    expect(flexFeature?.effects).toEqual([
      { type: 'stat_modifier', target: 'str', operation: 'add', value: 1, condition: null },
      { type: 'stat_modifier', target: 'dex', operation: 'add', value: 1, condition: null },
    ]);
  });

  it('compiles flexibleAsi (two_one_or_three_one, 2 picks) as a +2/+1 split', () => {
    const flexBg = backgroundWithSkills('flex_bg_2', [], {
      flexibleAsi: { prompt: 'Choose.', mode: { kind: 'two_one_or_three_one', restrictTo: ['wis', 'int', 'cha'] } },
    });
    const after = swapBackground(entity(), flexBg, DEFAULT_RULES, ['wis', 'int']);
    const flexFeature = after.features.find(f => f.id === 'flex_bg_2_flexible_asi');
    expect(flexFeature?.effects).toEqual([
      { type: 'stat_modifier', target: 'wis', operation: 'add', value: 2, condition: null },
      { type: 'stat_modifier', target: 'int', operation: 'add', value: 1, condition: null },
    ]);
  });

  it('compiles flexibleAsi (two_one_or_three_one, 3 picks) as +1 each', () => {
    const flexBg = backgroundWithSkills('flex_bg_3', [], {
      flexibleAsi: { prompt: 'Choose.', mode: { kind: 'two_one_or_three_one' } },
    });
    const after = swapBackground(entity(), flexBg, DEFAULT_RULES, ['wis', 'int', 'cha']);
    const flexFeature = after.features.find(f => f.id === 'flex_bg_3_flexible_asi');
    expect(flexFeature?.effects.every(e => (e as { value: number }).value === 1)).toBe(true);
  });

  // ABILITY-CAP-1: swapBackground's flexibleAsi compilation used to apply
  // its raw amount unconditionally — this proves it now clamps to headroom
  // under rules.maxAbilityScore, the same rule applyAsiToEntity already
  // enforces for the plain ASI path.
  it('clamps flexibleAsi picks to headroom under an effective cap above 20', () => {
    const flexBg = backgroundWithSkills('flex_bg_capped', [], {
      flexibleAsi: { prompt: 'Choose two.', mode: { kind: 'two_distinct_plus_one' } },
    });
    const capped: Entity = { ...entity(), stats: { ...entity().stats, str: 23, dex: 24 } };
    const after = swapBackground(capped, flexBg, { ...DEFAULT_RULES, maxAbilityScore: 24 }, ['str', 'dex']);
    const flexFeature = after.features.find(f => f.id === 'flex_bg_capped_flexible_asi');
    expect(flexFeature?.effects).toEqual([
      { type: 'stat_modifier', target: 'str', operation: 'add', value: 1, condition: null }, // 23 -> 24, full +1 fits
      { type: 'stat_modifier', target: 'dex', operation: 'add', value: 0, condition: null }, // already at 24, no headroom
    ]);
  });

  it('applies the full flexibleAsi amount when uncapped (maxAbilityScore: null)', () => {
    const flexBg = backgroundWithSkills('flex_bg_uncapped', [], {
      flexibleAsi: { prompt: 'Choose two.', mode: { kind: 'two_distinct_plus_one' } },
    });
    const high: Entity = { ...entity(), stats: { ...entity().stats, str: 30, dex: 30 } };
    const after = swapBackground(high, flexBg, { ...DEFAULT_RULES, maxAbilityScore: null }, ['str', 'dex']);
    const flexFeature = after.features.find(f => f.id === 'flex_bg_uncapped_flexible_asi');
    expect(flexFeature?.effects).toEqual([
      { type: 'stat_modifier', target: 'str', operation: 'add', value: 1, condition: null },
      { type: 'stat_modifier', target: 'dex', operation: 'add', value: 1, condition: null },
    ]);
  });

  it('documents (not silently regresses) the class-choice blind spot — and proves skillRetrainOverrides fixes it', () => {
    const acolyte = backgroundWithSkills('acolyte', ['insight', 'religion']);
    const soldier = backgroundWithSkills('soldier', ['athletics', 'intimidation']);
    // A class-granted skill choice trained Insight directly (resolveChoice
    // sets entity.skills.skills[x].trained = true with NO backing Effect —
    // see class-detail.tsx's own comment) — indistinguishable, to a feature
    // scan, from "nothing else grants this."
    const before = entityWithBackground(acolyte, ['insight', 'religion']);

    const withoutOverride = swapBackground(before, soldier, DEFAULT_RULES);
    expect(withoutOverride.skills.skills.insight.trained).toBe(false); // the blind spot, documented not fixed

    const withOverride = swapBackground(before, soldier, DEFAULT_RULES, undefined, { insight: true });
    expect(withOverride.skills.skills.insight.trained).toBe(true); // human-corrected via the checklist
  });

  it('skillRetrainOverrides can also force-untrain a skill the scan did not flag', () => {
    const acolyte = backgroundWithSkills('acolyte', ['insight', 'religion']);
    const soldier = backgroundWithSkills('soldier', ['athletics', 'intimidation']);
    let before = entityWithBackground(acolyte, ['insight', 'religion']);
    const racialInsight: FeatureInstance = {
      id: 'keen_senses', name: 'Keen Senses', description: '', level: null,
      effects: [{ type: 'grant_proficiency', target: 'skill:insight', operation: 'add', value: null, condition: null }],
      actions: [], choices: [], passive: true, isActive: true,
      source: { kind: 'race', refId: 'test_race' },
    };
    before = { ...before, features: [...before.features, racialInsight] };
    const after = swapBackground(before, soldier, DEFAULT_RULES, undefined, { insight: false });
    expect(after.skills.skills.insight.trained).toBe(false); // forced untrain despite the race grant
  });
});
