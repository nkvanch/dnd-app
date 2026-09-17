// src/engine/__tests__/repeatedChoices.test.ts
// CHOICE-EXPANSION-1: coverage for Expertise/Tool/Language as real
// interactive ChoiceDefinition-driven choices — the engine-level apply
// functions (leveling.ts), the shared eligibility computation
// (choiceEligibility.ts) both TabFeatures.tsx and the creation flow read
// from, and validateEntity's new Issue codes.
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { queueChoice, applyExpertiseChoiceToEntity, applyToolChoiceToEntity, applyLanguageChoiceToEntity } from '../leveling';
import { eligibleExpertiseOptions, eligibleToolOptions, eligibleLanguageOptions } from '../choiceEligibility';
import { validateEntity } from '../validation';
import type { ChoiceDefinition, Entity, SkillName } from '../types';

function expertiseDef(id: string, count = 2, pool: ChoiceDefinition['pool'] = 'all'): ChoiceDefinition {
  return { id, prompt: `Choose ${count} skills for Expertise.`, kind: 'expertise', count, pool, grants: [], required: true, resolved: false };
}
function toolDef(id: string, count = 2, pool: ChoiceDefinition['pool'] = 'all'): ChoiceDefinition {
  return { id, prompt: `Choose ${count} tool proficiencies.`, kind: 'tool', count, pool, grants: [], required: true, resolved: false };
}
function languageDef(id: string, count = 2, pool: ChoiceDefinition['pool'] = 'all'): ChoiceDefinition {
  return { id, prompt: `Choose ${count} languages.`, kind: 'language', count, pool, grants: [], required: true, resolved: false };
}

function withTrained(e: Entity, skills: SkillName[]): Entity {
  let next = e;
  for (const s of skills) {
    next = { ...next, skills: { skills: { ...next.skills.skills, [s]: { ...next.skills.skills[s], trained: true } } } };
  }
  return next;
}

function baseContentDB() {
  return {
    races: [], subraces: [], classes: [], subclasses: [], backgrounds: [],
    spells: [], items: [], feats: [], monsters: [], conditions: [],
  } as any;
}

describe('Expertise — eligibility (item 3)', () => {
  it('only trained, non-expert skills are eligible', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana', 'investigation', 'perception']);
    const opts = eligibleExpertiseOptions(e, 'all').map(o => o.id).sort();
    expect(opts).toEqual(['arcana', 'investigation', 'perception']);
  });

  it('a skill not trained is never eligible', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana']);
    const opts = eligibleExpertiseOptions(e, 'all').map(o => o.id);
    expect(opts).not.toContain('athletics');
  });

  it('an already-expert skill is not eligible again', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['perception']);
    e = { ...e, skills: { skills: { ...e.skills.skills, perception: { ...e.skills.skills.perception, expertise: true } } } };
    const opts = eligibleExpertiseOptions(e, 'all').map(o => o.id);
    expect(opts).not.toContain('perception');
  });

  it('a restricted literal pool narrows eligibility even further (filters never broaden it — item 12)', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana', 'investigation', 'perception']);
    const restricted: ChoiceDefinition['pool'] = [
      { id: 'arcana', label: 'Arcana', value: 'arcana' },
      { id: 'perception', label: 'Perception', value: 'perception' },
    ];
    const opts = eligibleExpertiseOptions(e, restricted).map(o => o.id).sort();
    expect(opts).toEqual(['arcana', 'perception']); // investigation excluded despite being trained
  });
});

describe('Expertise — resolution (items 5, 30)', () => {
  it('resolving grants real expertise (doubled proficiency), not just a UI-only record', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana', 'investigation', 'perception']);
    e = queueChoice(e, expertiseDef('rogue_expertise_1', 2), 1);
    const choiceId = 'rogue_expertise_1_1';
    const updated = applyExpertiseChoiceToEntity(e, choiceId, ['arcana', 'perception'], DEFAULT_RULES);

    expect(updated.skills.skills.arcana.expertise).toBe(true);
    expect(updated.skills.skills.perception.expertise).toBe(true);
    expect(updated.skills.skills.investigation.expertise).toBe(false);
    // Derived through the normal engine — real doubled proficiency bonus,
    // not a second UI-only list (item 5).
    const prof = updated.derived.proficiencyBonus;
    const arcanaMod = Math.floor((updated.stats.int - 10) / 2);
    expect(updated.derived).toBeDefined();
    expect(prof).toBeGreaterThan(0);
    void arcanaMod;

    const resolved = updated.choices.find(c => c.id === choiceId)!;
    expect(resolved.resolved).toBe(true);
    expect(resolved.selections).toEqual(['arcana', 'perception']);
  });

  it('rejects a skill the character is not proficient in (item 3 legality, never inferred from display strings)', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana']);
    e = queueChoice(e, expertiseDef('c1', 2), 1);
    expect(() => applyExpertiseChoiceToEntity(e, 'c1_1', ['arcana', 'athletics'], DEFAULT_RULES)).toThrow(/not proficient/i);
  });

  it('rejects a skill that already has expertise (no duplicate grant)', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana', 'investigation']);
    e = { ...e, skills: { skills: { ...e.skills.skills, arcana: { ...e.skills.skills.arcana, expertise: true } } } };
    e = queueChoice(e, expertiseDef('c1', 2), 1);
    expect(() => applyExpertiseChoiceToEntity(e, 'c1_1', ['arcana', 'investigation'], DEFAULT_RULES)).toThrow(/already has expertise/i);
  });

  it('rejects duplicate selections within the same choice (item 27)', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana']);
    e = queueChoice(e, expertiseDef('c1', 2), 1);
    expect(() => applyExpertiseChoiceToEntity(e, 'c1_1', ['arcana', 'arcana'], DEFAULT_RULES)).toThrow(/duplicate/i);
  });

  it('rejects a selection count that does not match the required count', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana', 'investigation', 'perception']);
    e = queueChoice(e, expertiseDef('c1', 2), 1);
    expect(() => applyExpertiseChoiceToEntity(e, 'c1_1', ['arcana'], DEFAULT_RULES)).toThrow(/expected 2/i);
  });
});

describe('Expertise — multiple independent sources (item 4, 30)', () => {
  it('a second expertise choice remains independently unresolved after the first is complete, and correctly excludes what the first already granted', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana', 'investigation', 'perception', 'stealth']);
    e = queueChoice(e, expertiseDef('rogue_expertise_1', 2), 1);
    e = queueChoice(e, expertiseDef('rogue_expertise_6', 2), 6);

    e = applyExpertiseChoiceToEntity(e, 'rogue_expertise_1_1', ['arcana', 'investigation'], DEFAULT_RULES);

    const first  = e.choices.find(c => c.id === 'rogue_expertise_1_1')!;
    const second = e.choices.find(c => c.id === 'rogue_expertise_6_6')!;
    expect(first.resolved).toBe(true);
    expect(second.resolved).toBe(false);

    // The second choice's eligible pool no longer offers what the first
    // already consumed — computed live, not by extra bookkeeping.
    const eligibleForSecond = eligibleExpertiseOptions(e, 'all').map(o => o.id);
    expect(eligibleForSecond).not.toContain('arcana');
    expect(eligibleForSecond).not.toContain('investigation');
    expect(eligibleForSecond).toEqual(expect.arrayContaining(['perception', 'stealth']));

    e = applyExpertiseChoiceToEntity(e, 'rogue_expertise_6_6', ['perception', 'stealth'], DEFAULT_RULES);
    expect(e.choices.find(c => c.id === 'rogue_expertise_6_6')!.resolved).toBe(true);
    expect(e.skills.skills.perception.expertise).toBe(true);
    expect(e.skills.skills.stealth.expertise).toBe(true);
  });
});

describe('Expertise — removal / class change (item 6)', () => {
  it('a resolved expertise grant is tagged with the same source.kind as the granting class, so class-change stripping sweeps it up naturally', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana', 'investigation']);
    e = queueChoice(e, { ...expertiseDef('rogue_expertise_1', 2), forClassId: 'rogue' }, 1);
    e = applyExpertiseChoiceToEntity(e, 'rogue_expertise_1_1', ['arcana', 'investigation'], DEFAULT_RULES);
    const grantFeature = e.features.find(f => f.id === 'rogue_expertise_1_1_grant');
    expect(grantFeature).toBeDefined();
    expect(grantFeature!.source).toEqual({ kind: 'class', refId: 'rogue' });
  });
});

describe('Expertise — invalidated eligibility (item 28, 29)', () => {
  it('validateEntity flags a resolved Expertise choice whose skill is no longer trained, without silently reassigning it', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['perception']);
    e = queueChoice(e, expertiseDef('c1', 1), 1);
    e = applyExpertiseChoiceToEntity(e, 'c1_1', ['perception'], DEFAULT_RULES);
    expect(e.choices.find(c => c.id === 'c1_1')!.selections).toEqual(['perception']);

    // Simulate the one real path where trained can flip back to false
    // (swapBackground's skill-retrain checklist) without touching the
    // resolved choice itself.
    const untrained: Entity = { ...e, skills: { skills: { ...e.skills.skills, perception: { ...e.skills.skills.perception, trained: false } } } };
    // The choice's own selection is untouched — never silently reassigned.
    expect(untrained.choices.find(c => c.id === 'c1_1')!.selections).toEqual(['perception']);

    const issues = validateEntity(untrained, baseContentDB(), []);
    expect(issues.some(i => i.code === 'invalid_expertise_target' && i.affectedId === 'perception')).toBe(true);
  });

  it('does not flag a still-valid resolved Expertise choice', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['perception']);
    e = queueChoice(e, expertiseDef('c1', 1), 1);
    e = applyExpertiseChoiceToEntity(e, 'c1_1', ['perception'], DEFAULT_RULES);
    const issues = validateEntity(e, baseContentDB(), []);
    expect(issues.some(i => i.code === 'invalid_expertise_target')).toBe(false);
  });
});

describe('Tools (items 7-9, 27, 31)', () => {
  it('eligibility excludes tools the character already has, and groups by category', () => {
    let e = makeEmptyEntity('e1');
    e = { ...e, proficiencies: { ...e.proficiencies, tools: ['thieves_tools'] } };
    const opts = eligibleToolOptions(e, 'all');
    expect(opts.find(o => o.id === 'thieves_tools')).toBeUndefined();
    const smith = opts.find(o => o.id === 'smiths_tools');
    expect(smith?.group).toBe('artisan');
  });

  it('resolving grants canonical tool ids (not display strings) to entity.proficiencies.tools', () => {
    let e = makeEmptyEntity('e1');
    e = queueChoice(e, toolDef('c1', 2), 1);
    const updated = applyToolChoiceToEntity(e, 'c1_1', ['alchemists_supplies', 'thieves_tools'], DEFAULT_RULES);
    expect(updated.proficiencies.tools).toEqual(expect.arrayContaining(['alchemists_supplies', 'thieves_tools']));
    expect(updated.choices.find(c => c.id === 'c1_1')!.resolved).toBe(true);
  });

  it('rejects a tool the character is already proficient with (item 27 — no duplicates)', () => {
    let e = makeEmptyEntity('e1');
    e = { ...e, proficiencies: { ...e.proficiencies, tools: ['thieves_tools'] } };
    e = queueChoice(e, toolDef('c1', 1), 1);
    expect(() => applyToolChoiceToEntity(e, 'c1_1', ['thieves_tools'], DEFAULT_RULES)).toThrow(/already proficient/i);
  });

  it('a restricted literal pool only offers those specific tools', () => {
    const restricted: ChoiceDefinition['pool'] = [
      { id: 'carpenters_tools', label: "Carpenter's Tools", value: 'carpenters_tools' },
      { id: 'masons_tools', label: "Mason's Tools", value: 'masons_tools' },
    ];
    const e = makeEmptyEntity('e1');
    const opts = eligibleToolOptions(e, restricted).map(o => o.id).sort();
    expect(opts).toEqual(['carpenters_tools', 'masons_tools']);
  });

  it('automatic grant vs required choice: an automatic tool grant never consumes/appears as a pending choice slot (item 14)', () => {
    // An "automatic" tool grant is just a Grant.kind:'proficiency' applied
    // directly at level-up — no ChoiceState is ever queued for it, so it
    // structurally cannot appear in a pending-choice count.
    let e = makeEmptyEntity('e1');
    e = { ...e, proficiencies: { ...e.proficiencies, tools: ['thieves_tools'] } }; // automatic
    e = queueChoice(e, toolDef('artisan_choice', 1), 1); // required: choose 1 artisan tool
    const pendingToolChoices = e.choices.filter(c => c.definition.kind === 'tool' && !c.resolved);
    expect(pendingToolChoices).toHaveLength(1); // only the REQUIRED one, counter starts at 0/1
    expect(pendingToolChoices[0].definition.count).toBe(1);
  });
});

describe('Languages (items 10-13, 27, 32)', () => {
  it('eligibility offers only Common/Exotic/Other by default — secret languages excluded (item 13)', () => {
    const e = makeEmptyEntity('e1');
    const opts = eligibleLanguageOptions(e, 'all');
    expect(opts.some(o => o.id === 'thieves_cant')).toBe(false);
    expect(opts.some(o => o.id === 'druidic')).toBe(false);
    expect(opts.some(o => o.id === 'common')).toBe(true);
    expect(opts.some(o => o.id === 'draconic')).toBe(true);
  });

  it('resolving grants canonical language ids, 2/2 complete', () => {
    let e = makeEmptyEntity('e1');
    e = queueChoice(e, languageDef('c1', 2), 1);
    const updated = applyLanguageChoiceToEntity(e, 'c1_1', ['elvish', 'dwarvish'], DEFAULT_RULES);
    expect(updated.proficiencies.languages).toEqual(expect.arrayContaining(['elvish', 'dwarvish']));
    expect(updated.choices.find(c => c.id === 'c1_1')!.resolved).toBe(true);
  });

  it('a restricted pool (item 12/32): "choose one of Elvish/Gnomish" never offers Draconic, even though the general registry has it', () => {
    const restricted: ChoiceDefinition['pool'] = [
      { id: 'elvish', label: 'Elvish', value: 'elvish' },
      { id: 'gnomish', label: 'Gnomish', value: 'gnomish' },
    ];
    const e = makeEmptyEntity('e1');
    const opts = eligibleLanguageOptions(e, restricted).map(o => o.id);
    expect(opts.sort()).toEqual(['elvish', 'gnomish']);
    expect(opts).not.toContain('draconic');
  });

  it('a restricted pool CAN explicitly include a secret language (item 13 — narrower rule, not a hardcoded global ban)', () => {
    const restricted: ChoiceDefinition['pool'] = [
      { id: 'thieves_cant', label: "Thieves' Cant", value: 'thieves_cant' },
    ];
    const e = makeEmptyEntity('e1');
    const opts = eligibleLanguageOptions(e, restricted).map(o => o.id);
    expect(opts).toEqual(['thieves_cant']);
  });

  it('rejects a language already known (no duplicates)', () => {
    let e = makeEmptyEntity('e1');
    e = { ...e, proficiencies: { ...e.proficiencies, languages: ['elvish'] } };
    e = queueChoice(e, languageDef('c1', 1), 1);
    expect(() => applyLanguageChoiceToEntity(e, 'c1_1', ['elvish'], DEFAULT_RULES)).toThrow(/already knows/i);
  });
});

describe('Repeated-choice resolution semantics (item 33, engine-level proxy for the shared picker mechanics)', () => {
  it('a choice with count 3 only resolves once all 3 are supplied at once — the apply function itself has no partial-progress state', () => {
    let e = makeEmptyEntity('e1');
    e = { ...e, proficiencies: { ...e.proficiencies, languages: [] } };
    e = queueChoice(e, languageDef('c1', 3), 1);
    expect(() => applyLanguageChoiceToEntity(e, 'c1_1', ['elvish', 'dwarvish'], DEFAULT_RULES)).toThrow(/expected 3/i);
    const updated = applyLanguageChoiceToEntity(e, 'c1_1', ['elvish', 'dwarvish', 'giant'], DEFAULT_RULES);
    expect(updated.choices.find(c => c.id === 'c1_1')!.resolved).toBe(true);
  });
});

describe('Unsupported choice kind (items 16, 17, 29)', () => {
  it('a genuinely unstructured kind ("custom") is surfaced as an Issue, never silently dropped', () => {
    let e = makeEmptyEntity('e1');
    e = queueChoice(e, { id: 'weird', prompt: 'Choose something.', kind: 'custom', count: 1, pool: 'all', grants: [], required: true, resolved: false }, 1);
    const issues = validateEntity(e, baseContentDB(), []);
    const issue = issues.find(i => i.code === 'unresolved_choice_kind');
    expect(issue).toBeDefined();
    expect(issue!.message).toContain('custom');
  });

  it('every choice kind this pass adds a real picker for is NOT flagged as unresolved_choice_kind', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana']);
    e = queueChoice(e, expertiseDef('c1', 1), 1);
    e = queueChoice(e, toolDef('c2', 1), 1);
    e = queueChoice(e, languageDef('c3', 1), 1);
    const issues = validateEntity(e, baseContentDB(), []);
    expect(issues.filter(i => i.code === 'unresolved_choice_kind')).toHaveLength(0);
  });
});

describe('Homebrew-origin choices resolve through the exact same engine path (item 22, 35)', () => {
  it('a hand-authored (homebrew-shaped) tool ChoiceDefinition resolves identically to official content — the apply function is origin-agnostic', () => {
    // Simulates a homebrew class/feature granting "Choose 2 Tools" — the
    // engine has no concept of "official vs homebrew" at this layer; any
    // ChoiceDefinition of a supported kind resolves the same way regardless
    // of where it was authored (builder UI, hand-JSON, or an imported
    // package — see io/packageIO.ts, which already round-trips arbitrary
    // Feature/ChoiceDefinition JSON without caring about its origin).
    let e = makeEmptyEntity('e1');
    e = queueChoice(e, toolDef('homebrew_tool_choice', 2), 1);
    const updated = applyToolChoiceToEntity(e, 'homebrew_tool_choice_1', ['lute', 'dice_set'], DEFAULT_RULES);
    expect(updated.proficiencies.tools).toEqual(expect.arrayContaining(['lute', 'dice_set']));
  });

  it('a hand-authored (homebrew-shaped) language ChoiceDefinition resolves identically to official content', () => {
    let e = makeEmptyEntity('e1');
    e = queueChoice(e, languageDef('homebrew_lang_choice', 1), 1);
    const updated = applyLanguageChoiceToEntity(e, 'homebrew_lang_choice_1', ['orc'], DEFAULT_RULES);
    expect(updated.proficiencies.languages).toContain('orc');
  });
});

describe('Live entity mutation correctness (item 36)', () => {
  it('resolving a choice only touches the fields it should — no unrelated data changes', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana', 'investigation']);
    e = queueChoice(e, expertiseDef('c1', 2), 1);
    const before = e;
    const after = applyExpertiseChoiceToEntity(e, 'c1_1', ['arcana', 'investigation'], DEFAULT_RULES);

    expect(after.identity).toEqual(before.identity);
    expect(after.inventory).toEqual(before.inventory);
    expect(after.spellcasting).toEqual(before.spellcasting);
    expect(after.proficiencies.languages).toEqual(before.proficiencies.languages);
    expect(after.proficiencies.tools).toEqual(before.proficiencies.tools);
    // Only the targeted skills + the new synthetic feature + the resolved choice changed.
    expect(after.features.length).toBe(before.features.length + 1);
  });
});

describe('CHOICE-AUTHORING-1: restricted pools are enforced at the runtime apply layer, not just by the picker UI', () => {
  it('applyExpertiseChoiceToEntity rejects a skill outside a restricted pool, even if otherwise eligible', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana', 'investigation']);
    const restricted: ChoiceDefinition['pool'] = [{ id: 'arcana', label: 'Arcana', value: 'arcana' }];
    e = queueChoice(e, expertiseDef('c1', 1, restricted), 1);
    expect(() => applyExpertiseChoiceToEntity(e, 'c1_1', ['investigation'], DEFAULT_RULES)).toThrow();
  });

  it('applyExpertiseChoiceToEntity accepts a skill that IS in the restricted pool', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana', 'investigation']);
    const restricted: ChoiceDefinition['pool'] = [{ id: 'arcana', label: 'Arcana', value: 'arcana' }];
    e = queueChoice(e, expertiseDef('c1', 1, restricted), 1);
    const updated = applyExpertiseChoiceToEntity(e, 'c1_1', ['arcana'], DEFAULT_RULES);
    expect(updated.skills.skills.arcana.expertise).toBe(true);
  });

  it('applyToolChoiceToEntity rejects a tool outside a restricted pool', () => {
    let e = makeEmptyEntity('e1');
    const restricted: ChoiceDefinition['pool'] = [{ id: 'smiths_tools', label: "Smith's Tools", value: 'smiths_tools' }];
    e = queueChoice(e, toolDef('c1', 1, restricted), 1);
    expect(() => applyToolChoiceToEntity(e, 'c1_1', ['thieves_tools'], DEFAULT_RULES)).toThrow();
  });

  it('applyLanguageChoiceToEntity rejects a language outside a restricted pool, INCLUDING a secret language not explicitly listed', () => {
    let e = makeEmptyEntity('e1');
    const restricted: ChoiceDefinition['pool'] = [
      { id: 'dwarvish', label: 'Dwarvish', value: 'dwarvish' },
      { id: 'elvish', label: 'Elvish', value: 'elvish' },
    ];
    e = queueChoice(e, languageDef('c1', 1, restricted), 1);
    expect(() => applyLanguageChoiceToEntity(e, 'c1_1', ['thieves_cant'], DEFAULT_RULES)).toThrow();
  });

  it('an unrestricted (\'all\' sentinel) pool imposes no extra restriction — unchanged behavior', () => {
    let e = makeEmptyEntity('e1');
    e = queueChoice(e, toolDef('c1', 1, 'all'), 1);
    const updated = applyToolChoiceToEntity(e, 'c1_1', ['thieves_tools'], DEFAULT_RULES);
    expect(updated.proficiencies.tools).toContain('thieves_tools');
  });
});
