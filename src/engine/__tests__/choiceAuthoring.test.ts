// src/engine/__tests__/choiceAuthoring.test.ts
// CHOICE-AUTHORING-1: coverage for the new homebrew choice-authoring
// plumbing — Feat.pendingChoices (applyFeatToEntity), Background.pendingChoices
// (swapBackground), and removeFeature's namespaced choice sweep. Proves the
// shared authoring architecture actually reaches the runtime end to end:
// author a choice on a Feat/Background -> apply to a character -> pending
// choice appears -> resolve through the SAME apply*ChoiceToEntity functions
// official content already uses -> grant lands, with no branching on
// official vs homebrew origin anywhere in this path.
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import {
  applyFeatToEntity, removeFeature, swapBackground,
  applyToolChoiceToEntity, applyLanguageChoiceToEntity, applyExpertiseChoiceToEntity,
} from '../leveling';
import type { Entity, Feature, ChoiceDefinition, Background } from '../types';
import { BACKGROUND_CHOICE_PREFIX } from '../types';

function entity(overrides: Partial<Entity> = {}): Entity {
  return { ...makeEmptyEntity('e1'), ...overrides };
}

function toolDef(id: string, pool: ChoiceDefinition['pool'] = 'all', count = 1): ChoiceDefinition {
  return { id, prompt: `Choose ${count} tool proficiencies.`, kind: 'tool', count, pool, grants: [], required: true, resolved: false };
}
function languageDef(id: string, pool: ChoiceDefinition['pool'] = 'all', count = 1): ChoiceDefinition {
  return { id, prompt: `Choose ${count} languages.`, kind: 'language', count, pool, grants: [], required: true, resolved: false };
}

describe('applyFeatToEntity — Feat.pendingChoices (homebrew authoring end-to-end)', () => {
  const featFeature: Feature = {
    id: 'prodigy_feature', name: 'Prodigy', description: '', source: { kind: 'feat', refId: 'prodigy' },
    level: null, actions: [], choices: [], passive: true, effects: [],
  };

  it('queues each pendingChoice alongside the feat grant, namespaced to the feature id', () => {
    const e = entity({ choices: [{ id: 'featChoice_5', definition: { id: 'featChoice', prompt: '', kind: 'feat', count: 1, pool: 'all', grants: [], required: true, resolved: false }, grantedAt: 5, resolved: false, selections: [] }] });
    const toolChoice = toolDef('feat_choice_prodigy_tool');
    const langChoice = languageDef('feat_choice_prodigy_lang');
    const updated = applyFeatToEntity(e, 'featChoice_5', 5, featFeature, 'prodigy', DEFAULT_RULES, [toolChoice, langChoice]);

    expect(updated.features.some(f => f.id === 'prodigy_feature')).toBe(true);
    const queued = updated.choices.filter(c => !c.resolved && c.definition.kind !== 'feat');
    expect(queued).toHaveLength(2);
    expect(queued.every(c => c.id.startsWith('prodigy_feature:'))).toBe(true);
    expect(queued.map(c => c.definition.kind).sort()).toEqual(['language', 'tool']);
  });

  it('applying zero pendingChoices behaves exactly as before (no new choices queued)', () => {
    const e = entity({ choices: [{ id: 'featChoice_5', definition: { id: 'featChoice', prompt: '', kind: 'feat', count: 1, pool: 'all', grants: [], required: true, resolved: false }, grantedAt: 5, resolved: false, selections: [] }] });
    const updated = applyFeatToEntity(e, 'featChoice_5', 5, featFeature, 'prodigy', DEFAULT_RULES);
    expect(updated.choices.filter(c => !c.resolved)).toHaveLength(0);
  });

  it('a queued feat tool choice resolves through the same applyToolChoiceToEntity official content uses', () => {
    const e = entity({ choices: [{ id: 'featChoice_1', definition: { id: 'featChoice', prompt: '', kind: 'feat', count: 1, pool: 'all', grants: [], required: true, resolved: false }, grantedAt: 1, resolved: false, selections: [] }] });
    let updated = applyFeatToEntity(e, 'featChoice_1', 1, featFeature, 'prodigy', DEFAULT_RULES, [toolDef('feat_choice_prodigy_tool')]);
    const queuedId = updated.choices.find(c => c.definition.kind === 'tool')!.id;
    updated = applyToolChoiceToEntity(updated, queuedId, ['thieves_tools'], DEFAULT_RULES);
    expect(updated.proficiencies.tools).toContain('thieves_tools');
    expect(updated.choices.find(c => c.id === queuedId)!.resolved).toBe(true);
  });

  it('removeFeature strips the still-unresolved pendingChoice but leaves an already-resolved one intact', () => {
    const e = entity({ choices: [{ id: 'featChoice_1', definition: { id: 'featChoice', prompt: '', kind: 'feat', count: 1, pool: 'all', grants: [], required: true, resolved: false }, grantedAt: 1, resolved: false, selections: [] }] });
    let updated = applyFeatToEntity(e, 'featChoice_1', 1, featFeature, 'prodigy', DEFAULT_RULES, [toolDef('feat_choice_prodigy_tool'), languageDef('feat_choice_prodigy_lang')]);
    // Resolve the tool choice, leave the language one pending.
    const toolChoiceId = updated.choices.find(c => c.definition.kind === 'tool')!.id;
    updated = applyToolChoiceToEntity(updated, toolChoiceId, ['thieves_tools'], DEFAULT_RULES);

    const afterRemove = removeFeature(updated, 'prodigy_feature');
    expect(afterRemove.features.some(f => f.id === 'prodigy_feature')).toBe(false);
    // Resolved tool choice stays (it's history, not dangling state).
    expect(afterRemove.choices.some(c => c.id === toolChoiceId && c.resolved)).toBe(true);
    // Unresolved language choice is swept.
    expect(afterRemove.choices.some(c => c.definition.kind === 'language')).toBe(false);
  });
});

describe('swapBackground — Background.pendingChoices (homebrew authoring end-to-end)', () => {
  function bg(id: string, pendingChoices?: ChoiceDefinition[]): Background {
    return { id, name: id, features: [], pendingChoices };
  }

  it('queues the new background pendingChoices, namespaced with BACKGROUND_CHOICE_PREFIX by convention', () => {
    const e = entity();
    const choice = toolDef(`${BACKGROUND_CHOICE_PREFIX}guild_tool`);
    const updated = swapBackground(e, bg('guild_artisan', [choice]), DEFAULT_RULES);
    expect(updated.identity.backgroundId).toBe('guild_artisan');
    const queued = updated.choices.find(c => !c.resolved);
    expect(queued).toBeDefined();
    expect(queued!.definition.kind).toBe('tool');
  });

  it('swapping again sweeps the OLD background unresolved choice and queues the new one', () => {
    const e = entity();
    const first = swapBackground(e, bg('guild_artisan', [toolDef(`${BACKGROUND_CHOICE_PREFIX}guild_tool`)]), DEFAULT_RULES);
    expect(first.choices.filter(c => !c.resolved)).toHaveLength(1);

    const second = swapBackground(first, bg('folk_hero', [toolDef(`${BACKGROUND_CHOICE_PREFIX}folk_tool`)]), DEFAULT_RULES);
    const unresolved = second.choices.filter(c => !c.resolved);
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0].definition.id.endsWith('folk_tool')).toBe(true);
  });

  it('a RESOLVED old-background choice is preserved across a background swap (history, not dangling state)', () => {
    const e = entity();
    let withOld = swapBackground(e, bg('guild_artisan', [toolDef(`${BACKGROUND_CHOICE_PREFIX}guild_tool`)]), DEFAULT_RULES);
    const oldChoiceId = withOld.choices.find(c => !c.resolved)!.id;
    withOld = applyToolChoiceToEntity(withOld, oldChoiceId, ['masons_tools'], DEFAULT_RULES);
    expect(withOld.proficiencies.tools).toContain('masons_tools');

    const swapped = swapBackground(withOld, bg('folk_hero'), DEFAULT_RULES);
    expect(swapped.choices.some(c => c.id === oldChoiceId && c.resolved)).toBe(true);
    // History remains, but the old background's active grant is revoked.
    expect(swapped.proficiencies.tools).not.toContain('masons_tools');
  });

  it('a queued background language choice resolves through the same applyLanguageChoiceToEntity official content uses', () => {
    const e = entity();
    let updated = swapBackground(e, bg('mastermind_flavor', [languageDef(`${BACKGROUND_CHOICE_PREFIX}two_langs`, 'all', 2)]), DEFAULT_RULES);
    const queuedId = updated.choices.find(c => !c.resolved)!.id;
    updated = applyLanguageChoiceToEntity(updated, queuedId, ['dwarvish', 'elvish'], DEFAULT_RULES);
    expect(updated.proficiencies.languages).toEqual(expect.arrayContaining(['dwarvish', 'elvish']));
    expect(updated.choices.find(c => c.id === queuedId)!.resolved).toBe(true);
  });
});

describe('homebrew vs official parity for the new pendingChoices path', () => {
  it('a homebrew-authored Feat expertise choice resolves via the exact same applyExpertiseChoiceToEntity path official Expertise content uses', () => {
    const featFeature: Feature = {
      id: 'homebrew_feat_feature', name: 'Homebrew Feat', description: '', source: { kind: 'feat', refId: 'homebrew_feat' },
      level: null, actions: [], choices: [], passive: true, effects: [],
    };
    let e = entity({
      choices: [{ id: 'c_1', definition: { id: 'c', prompt: '', kind: 'feat', count: 1, pool: 'all', grants: [], required: true, resolved: false }, grantedAt: 1, resolved: false, selections: [] }],
      skills: { skills: { ...makeEmptyEntity('e1').skills.skills, stealth: { ...makeEmptyEntity('e1').skills.skills.stealth, trained: true, expertise: false } } },
    });
    const expertiseChoice: ChoiceDefinition = { id: 'feat_choice_homebrew_expertise', prompt: 'Choose 1 skill for Expertise.', kind: 'expertise', count: 1, pool: 'all', grants: [], required: true, resolved: false };
    e = applyFeatToEntity(e, 'c_1', 1, featFeature, 'homebrew_feat', DEFAULT_RULES, [expertiseChoice]);
    const queuedId = e.choices.find(c => c.definition.kind === 'expertise')!.id;
    e = applyExpertiseChoiceToEntity(e, queuedId, ['stealth'], DEFAULT_RULES);
    expect(e.skills.skills.stealth.expertise).toBe(true);
  });
});
