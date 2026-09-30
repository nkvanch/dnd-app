// Level-6 smoke investigation (Creator Alpha final pass): a device run previously reported that
// "Confirm Skills" appeared to leave the Skill Selection screen unchanged for a level-5+ Bard built
// on the Tidewalker (Breadth demo pack) homebrew race. This test reproduces the exact ENGINE contract
// app/creation/skills.tsx's commit() depends on — not a copy of its logic, the real production
// functions (levelUp, applyGrant, resolveChoice) fed the real Bard class content and a homebrew-race
// shaped feature/resource set matching Tidewalker's own construction in demo/sample-packs — with the
// same "augmented pool" substitution the screen performs for a pool:'all' choice, at a level where
// OTHER choices (subclass, expertise) are simultaneously pending, since an uncaught exception in that
// situation was the most plausible mechanism for "the screen didn't advance" without a visible crash.
//
// Root cause found: none in the engine. See artifacts/creator-alpha/level6-smoke.md for the full
// writeup (this test is the "AUTOMATED TEST" it references). No production code was changed.
import { makeEmptyEntity, DEFAULT_RULES } from '../../../src/store/characterStore';
import { levelUp, resolveChoice, applyGrant } from '../../../src/engine/leveling';
import { recomputeDerived } from '../../../src/engine/pipeline';
import { newDraftTrait, buildTraitFeature } from '../../../src/content/traitCompiler';
import { collectAllEffects } from '../../../src/engine/pipeline';
import { bardProgression } from '../../../src/content/classes/index';
import { ALL_CHAR_CLASSES_CATALOG } from '../../../src/content/classes/index';
import { bgAcolyte } from '../../../src/content/backgrounds/index';
import { ChoiceOption, Entity, SkillName } from '../../../src/engine/types';

const ALL_SKILL_KEYS: SkillName[] = [
  'athletics', 'acrobatics', 'sleight_of_hand', 'stealth', 'arcana', 'history', 'investigation',
  'nature', 'religion', 'animal_handling', 'insight', 'medicine', 'perception', 'survival',
  'deception', 'intimidation', 'performance', 'persuasion',
];

/** A homebrew race shaped exactly like the Breadth Test Pack's Tidewalker (Demo): an ability-score
 *  bonus, a damage resistance, and a resourced spell grant — applied the same way race.tsx applies a
 *  real race's features to a draft (applyGrant per feature/resource), not hand-assembled. */
function applyTidewalkerLikeRace(entity: Entity): Entity {
  const dex = newDraftTrait('Quick Current');
  dex.effectKind = 'ability_score'; dex.abilityTarget = 'dex'; dex.abilityAmount = '1';
  const cold = newDraftTrait('Deepwater Blood');
  cold.effectKind = 'damage_resistance'; cold.damageType = 'cold';
  const pull = newDraftTrait('Tidal Gift');
  pull.effectKind = 'spell_grant'; pull.spellGrantAbility = 'wis';
  pull.spellGrants = [{
    localId: 'g1', spellId: 'tide_pull_test', spellName: 'Tide Pull (Test)', actionType: 'action',
    unlockLevel: '1', mode: 'resource', recharge: 'long_rest', rechargeOther: '', uses: '1', minSlotLevel: '1',
  }];
  const opts = { idPrefix: 'tidewalker_test', sourceKind: 'race' as const, sourceRefId: 'tidewalker_test', level: null };
  const used = new Set<string>();
  let updated = entity;
  for (const t of [dex, cold, pull]) {
    const built = buildTraitFeature(t, { ...opts, usedIds: used });
    updated = applyGrant(updated, { kind: 'feature', value: built.feature }, 0, undefined, { kind: 'race' });
    for (const f of built.extraFeatures ?? []) updated = applyGrant(updated, { kind: 'feature', value: f }, 0, undefined, { kind: 'race' });
    if (built.resource) updated = applyGrant(updated, { kind: 'resource', value: built.resource }, 0, undefined, { kind: 'race' });
    for (const r of built.extraResources ?? []) updated = applyGrant(updated, { kind: 'resource', value: r }, 0, undefined, { kind: 'race' });
  }
  return updated;
}

/** Builds a level-5 Bard with the Tidewalker-shaped race and the Acolyte background (Insight +
 *  Religion trained), using the real class progression content — the same starting point creation
 *  produces for "Tidewalker (Demo) / Bard / College of Lore / Acolyte, starting level 5". */
function buildRepro(): Entity {
  let e = makeEmptyEntity('l6-smoke');
  e = { ...e, identity: { ...e.identity, raceId: 'tidewalker_test', classId: 'bard', backgroundId: 'acolyte', level: 0 } };
  // Background features are applied via applyGrant (never pushed directly onto entity.features) —
  // that's what stamps isActive: true, which collectAllEffects requires before a feature's effects
  // (including this one's grant_proficiency skill:insight / skill:religion) contribute anything.
  // Matches app/creation/background.tsx's own application of a chosen background's features exactly.
  e = applyGrant(e, { kind: 'feature', value: { ...bgAcolyte.features[0], isActive: true } }, 0);
  e = applyTidewalkerLikeRace(e);
  e = recomputeDerived(e, DEFAULT_RULES);
  e = levelUp(e, 5, bardProgression, DEFAULT_RULES, ALL_CHAR_CLASSES_CATALOG);
  return e;
}

describe('Level-6 smoke: Bard skill choice resolves on a Tidewalker-shaped homebrew race at level 5', () => {
  it('background-trained skills are in place before the skill choice is resolved', () => {
    const e = buildRepro();
    expect(e.skills.skills.insight.trained).toBe(true);
    expect(e.skills.skills.religion.trained).toBe(true);
    const hasColdResistance = collectAllEffects(e).some(ae => ae.effect.type === 'grant_resistance' && ae.effect.target === 'cold');
    expect(hasColdResistance).toBe(true);
  });

  it('levelUp queues exactly the real Bard level-1 skill choice (pool: "all", count 3), unresolved', () => {
    const e = buildRepro();
    const skillChoices = e.choices.filter(c => c.definition.kind === 'skill');
    expect(skillChoices).toHaveLength(1);
    expect(skillChoices[0].resolved).toBe(false);
    expect(skillChoices[0].definition.count).toBe(3);
    expect(skillChoices[0].definition.pool).toBe('all');
  });

  it('other pending choices (subclass, expertise) coexist and do not block or corrupt the skill choice', () => {
    const e = buildRepro();
    const subclass = e.choices.filter(c => c.definition.kind === 'subclass' && !c.resolved);
    const expertise = e.choices.filter(c => c.definition.kind === 'expertise' && !c.resolved);
    expect(subclass.length).toBeGreaterThan(0);
    expect(expertise.length).toBeGreaterThan(0);
  });

  it('resolving the skill choice with the augmented pool (the exact commit() pattern) succeeds and trains the chosen skills', () => {
    const e = buildRepro();
    const skillChoice = e.choices.find(c => c.definition.kind === 'skill' && !c.resolved)!;
    // achievableCount() in 'replacement' (default) overlap mode is simply the choice's own count.
    const chosen = ['athletics', 'acrobatics', 'sleight_of_hand'];
    expect(chosen).toHaveLength(skillChoice.definition.count);

    const pool: ChoiceOption[] = ALL_SKILL_KEYS.map(sk => ({ id: sk, label: sk, value: sk }));
    const augmented: Entity = {
      ...e,
      choices: e.choices.map(c => c.id === skillChoice.id ? { ...c, definition: { ...c.definition, pool } } : c),
    };

    let resolved: Entity;
    expect(() => { resolved = resolveChoice(augmented, skillChoice.id, chosen, DEFAULT_RULES); }).not.toThrow();
    resolved = resolveChoice(augmented, skillChoice.id, chosen, DEFAULT_RULES);

    const after = resolved.choices.find(c => c.id === skillChoice.id)!;
    expect(after.resolved).toBe(true);
    expect(after.selections).toEqual(chosen);
    for (const sk of chosen) expect(resolved.skills.skills[sk as SkillName].trained).toBe(true);

    // The hub's own "skills done" predicate (app/creation/hub.tsx) — now vacuously true.
    const pendingSkillChoices = resolved.choices.filter(c => c.definition.kind === 'skill' && !c.resolved);
    expect(pendingSkillChoices).toHaveLength(0);

    // Untouched: subclass/expertise remain exactly as they were, not silently resolved or dropped.
    const subclassBefore = e.choices.filter(c => c.definition.kind === 'subclass');
    const subclassAfter = resolved.choices.filter(c => c.definition.kind === 'subclass');
    expect(subclassAfter.map(c => c.resolved)).toEqual(subclassBefore.map(c => c.resolved));
    const expertiseBefore = e.choices.filter(c => c.definition.kind === 'expertise');
    const expertiseAfter = resolved.choices.filter(c => c.definition.kind === 'expertise');
    expect(expertiseAfter.map(c => c.resolved)).toEqual(expertiseBefore.map(c => c.resolved));
  });

  it('the achievable-count gate (replacement mode) requires exactly the choice count, not more or fewer', () => {
    const e = buildRepro();
    const skillChoice = e.choices.find(c => c.definition.kind === 'skill' && !c.resolved)!;
    const pool: ChoiceOption[] = ALL_SKILL_KEYS.map(sk => ({ id: sk, label: sk, value: sk }));
    const augmented: Entity = {
      ...e,
      choices: e.choices.map(c => c.id === skillChoice.id ? { ...c, definition: { ...c.definition, pool } } : c),
    };
    expect(() => resolveChoice(augmented, skillChoice.id, ['athletics', 'acrobatics'], DEFAULT_RULES)).toThrow();
    expect(() => resolveChoice(augmented, skillChoice.id, ['athletics', 'acrobatics', 'stealth', 'arcana'], DEFAULT_RULES)).toThrow();
  });
});
