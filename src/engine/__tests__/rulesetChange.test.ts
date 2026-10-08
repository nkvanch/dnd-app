// src/engine/__tests__/rulesetChange.test.ts
import { simulateRulesetChange, canApplyRulesetChange } from '../rulesetChange';
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { Entity, ContentDB, HomebrewSubclass, RulesetId, ChoiceState } from '../types';

const EMPTY_DB: ContentDB = { races: [], classes: [], backgrounds: [], spells: [], items: [], conditions: [], features: [], feats: [] };

function race(id: string, name: string, rulesetId?: string) {
  return { id, name, features: [], rulesetId } as unknown as ContentDB['races'][number];
}
function feat(id: string, name: string, rulesetId?: string) {
  return { id, name, prerequisite: null, description: '', source: 'test', feature: { id: `${id}_f`, name, description: '', source: { kind: 'feat', refId: id }, level: null, effects: [], actions: [], choices: [], passive: true }, rulesetId } as unknown as NonNullable<ContentDB['feats']>[number];
}
function condition(id: string, name: string, rulesetId?: string) {
  return { id, name, description: '', features: [], rulesetId } as unknown as ContentDB['conditions'][number];
}
function spell(id: string, name: string, rulesetId?: string) {
  return {
    id, name, level: 1, school: 'Evocation', castingTime: '1 action', range: '30 feet',
    components: ['V'], duration: 'Instantaneous', description: '', upcast: null,
    ritual: false, concentration: false, rulesetId,
  } as unknown as ContentDB['spells'][number];
}
function item(id: string, name: string, rulesetId?: string) {
  return { id, name, weight: 0, cost: '—', properties: [], features: [], rulesetId } as unknown as ContentDB['items'][number];
}
function characterWithSpell(spellId: string): Entity {
  const e = makeEmptyEntity('char1');
  return {
    ...e,
    spellcasting: { ability: 'int', slots: {}, cantrips: [], known: [spellId], prepared: [], concentrating: null } as unknown as Entity['spellcasting'],
  };
}
function characterWithItem(itemId: string): Entity {
  const e = makeEmptyEntity('char1');
  return {
    ...e,
    inventory: { ...e.inventory, carried: [{ itemId, quantity: 1, attuned: false, features: [] }] },
  };
}

function characterWithRace(raceId: string): Entity {
  const e = makeEmptyEntity('char1');
  return { ...e, identity: { ...e.identity, name: 'Test', raceId } };
}

describe('simulateRulesetChange — no-op / same-ruleset detection (items 31, 36)', () => {
  it('flags sameRuleset when the target matches the character\'s current rulesetId', () => {
    const e: Entity = { ...makeEmptyEntity('char1'), rulesetId: 'dnd5e-2014' as RulesetId };
    const preview = simulateRulesetChange(e, 'dnd5e-2014' as RulesetId, EMPTY_DB, EMPTY_DB, [], DEFAULT_RULES);
    expect(preview.sameRuleset).toBe(true);
  });

  it('does not flag sameRuleset when actually changing (undefined -> a real ruleset counts as a real change)', () => {
    const e = makeEmptyEntity('char1');
    const preview = simulateRulesetChange(e, 'dnd5e-2024' as RulesetId, EMPTY_DB, EMPTY_DB, [], DEFAULT_RULES);
    expect(preview.sameRuleset).toBe(false);
    expect(preview.after.rulesetId).toBe('dnd5e-2024');
  });
});

describe('simulateRulesetChange — no name-based substitution (item 40, critical regression)', () => {
  it('a character referencing "human_2014" keeps that EXACT id after switching to a ruleset where "human_2024" (same display name "Human") exists — never silently substituted', () => {
    const universalDB: ContentDB = { ...EMPTY_DB, races: [race('human_2014', 'Human', 'dnd5e-2014'), race('human_2024', 'Human', 'dnd5e-2024')] };
    const targetDB: ContentDB = { ...EMPTY_DB, races: [race('human_2024', 'Human', 'dnd5e-2024')] }; // 2024-filtered view: only the 2024 one resolves
    const e = characterWithRace('human_2014');

    const preview = simulateRulesetChange(e, 'dnd5e-2024' as RulesetId, universalDB, targetDB, [], DEFAULT_RULES);

    // The stable reference itself is untouched — the mutator only ever
    // changes rulesetId, never any identity field.
    expect(preview.after.identity.raceId).toBe('human_2014');
    // And the preview correctly reports the OLD id as incompatible (it
    // still exists, just under the wrong ruleset) rather than silently
    // reporting "human_2024" as if that's what the character has.
    const raceEntry = preview.content.find(c => c.type === 'race');
    expect(raceEntry).toEqual({ type: 'race', id: 'human_2014', name: 'Human', category: 'incompatible' });
  });
});

describe('simulateRulesetChange — content compatibility categorization', () => {
  it('untagged (universal) content is always compatible, regardless of target ruleset', () => {
    const db: ContentDB = { ...EMPTY_DB, races: [race('tideborn', 'Tideborn')] }; // no rulesetId = universal
    const e = characterWithRace('tideborn');
    const preview = simulateRulesetChange(e, 'dnd5e-2024' as RulesetId, db, db, [], DEFAULT_RULES);
    expect(preview.content).toEqual([{ type: 'race', id: 'tideborn', name: 'Tideborn', category: 'compatible' }]);
    expect(preview.issues.filter(i => i.affectedId === 'tideborn')).toEqual([]);
  });

  it('content tagged for the TARGET ruleset is compatible', () => {
    const db: ContentDB = { ...EMPTY_DB, races: [race('human_2024', 'Human', 'dnd5e-2024')] };
    const e = characterWithRace('human_2024');
    const preview = simulateRulesetChange(e, 'dnd5e-2024' as RulesetId, db, db, [], DEFAULT_RULES);
    expect(preview.content[0].category).toBe('compatible');
  });

  it('a genuinely deleted piece of content (absent from BOTH universal and target) is "unresolved", not "incompatible"', () => {
    const e = characterWithRace('deleted_homebrew_race');
    const preview = simulateRulesetChange(e, 'dnd5e-2024' as RulesetId, EMPTY_DB, EMPTY_DB, [], DEFAULT_RULES);
    expect(preview.content).toEqual([{ type: 'race', id: 'deleted_homebrew_race', name: 'deleted_homebrew_race', category: 'unresolved' }]);
    expect(preview.issues.some(i => i.code === 'missing_race' && i.affectedId === 'deleted_homebrew_race')).toBe(true);
  });

  it('a homebrew Feat tagged for the wrong ruleset is "incompatible" with a structured Issue (item 17 homebrew example)', () => {
    const universalDB: ContentDB = { ...EMPTY_DB, feats: [feat('blood_mark', 'Blood Mark', 'dnd5e-2014')] };
    const targetDB: ContentDB = { ...EMPTY_DB, feats: [] }; // 2024 view: Blood Mark filtered out
    let e = makeEmptyEntity('char1');
    e = {
      ...e,
      choices: [{
        id: 'feat_choice_1',
        definition: { id: 'feat_choice', prompt: 'Choose a feat', kind: 'feat', count: 1, pool: 'all', grants: [], required: true, resolved: true },
        grantedAt: 1, resolved: true, selections: ['feat:blood_mark'],
      } as ChoiceState],
    };
    const preview = simulateRulesetChange(e, 'dnd5e-2024' as RulesetId, universalDB, targetDB, [], DEFAULT_RULES);
    const featEntry = preview.content.find(c => c.type === 'feat');
    expect(featEntry).toEqual({ type: 'feat', id: 'blood_mark', name: 'Blood Mark', category: 'incompatible' });
    expect(preview.issues).toContainEqual(expect.objectContaining({ code: 'missing_feat', severity: 'info', affectedId: 'blood_mark' }));
  });

  it('an active Condition tagged for a different ruleset is categorized and diagnosed', () => {
    const universalDB: ContentDB = { ...EMPTY_DB, conditions: [condition('old_curse', 'Old Curse', 'dnd5e-2014')] };
    const targetDB: ContentDB = { ...EMPTY_DB, conditions: [] };
    const e = makeEmptyEntity('char1');
    const withCondition: Entity = { ...e, conditionMonitor: { ...e.conditionMonitor, active: [{ id: 'old_curse', sourceId: 'manual', duration: null, suppressedBy: [] }] } };
    const preview = simulateRulesetChange(withCondition, 'dnd5e-2024' as RulesetId, universalDB, targetDB, [], DEFAULT_RULES);
    const condEntry = preview.content.find(c => c.type === 'condition');
    expect(condEntry?.category).toBe('incompatible');
    expect(preview.issues.some(i => i.code === 'missing_condition')).toBe(true);
  });
});

describe('simulateRulesetChange — spell/item compatibility (items 5, 6, 18: now real, not the old "never ruleset-filtered" disclaimer)', () => {
  it('a spell tagged for the wrong ruleset is "incompatible" (this file\'s own content[] categorization, which knows the universal/target distinction)', () => {
    const universalDB: ContentDB = { ...EMPTY_DB, spells: [spell('old_spell', 'Old Spell', 'dnd5e-2014')] };
    const targetDB: ContentDB = { ...EMPTY_DB, spells: [] }; // 2024 view: filtered out
    const e = characterWithSpell('old_spell');
    const preview = simulateRulesetChange(e, 'dnd5e-2024' as RulesetId, universalDB, targetDB, [], DEFAULT_RULES);
    const spellEntry = preview.content.find(c => c.type === 'spell');
    expect(spellEntry).toEqual({ type: 'spell', id: 'old_spell', name: 'Old Spell', category: 'incompatible' });
    // validateEntity (reused for spell/item diagnostics, unlike feat/condition
    // which this file checks itself) only ever sees `targetDB` with no
    // universal fallback, so it correctly-from-its-own-narrower-view still
    // reports missing_spell too — the SAME pre-existing double-signal shape
    // race/class/background already have (content[] is the authoritative,
    // richer categorization; validateEntity's Issues are a coarser, honest
    // "not in this specific contentDB" signal on top).
    expect(preview.issues.some(i => i.code === 'missing_spell' && i.affectedId === 'old_spell')).toBe(true);
  });

  it('an untagged spell stays compatible after a ruleset switch — stable reference, no substitution', () => {
    const db: ContentDB = { ...EMPTY_DB, spells: [spell('alert_spell', 'Universal Spell')] };
    const e = characterWithSpell('alert_spell');
    const preview = simulateRulesetChange(e, 'dnd5e-2024' as RulesetId, db, db, [], DEFAULT_RULES);
    expect(preview.content).toEqual([{ type: 'spell', id: 'alert_spell', name: 'Universal Spell', category: 'compatible' }]);
    // The reference itself is untouched — still 'alert_spell' verbatim.
    expect(preview.after.spellcasting?.known).toEqual(['alert_spell']);
  });

  it('an item tagged for the wrong ruleset is "incompatible" with a structured Issue', () => {
    const universalDB: ContentDB = { ...EMPTY_DB, items: [item('old_item', 'Old Item', 'dnd5e-2014')] };
    const targetDB: ContentDB = { ...EMPTY_DB, items: [] };
    const e = characterWithItem('old_item');
    const preview = simulateRulesetChange(e, 'dnd5e-2024' as RulesetId, universalDB, targetDB, [], DEFAULT_RULES);
    const itemEntry = preview.content.find(c => c.type === 'item');
    expect(itemEntry).toEqual({ type: 'item', id: 'old_item', name: 'Old Item', category: 'incompatible' });
  });

  it('switching back to the original ruleset restores the item\'s compatible status, with no reference mutation throughout', () => {
    const db2014: ContentDB = { ...EMPTY_DB, items: [item('relic', 'Relic', 'dnd5e-2014')] };
    const universal: ContentDB = EMPTY_DB;
    const e = characterWithItem('relic');

    const toTarget = simulateRulesetChange(e, 'dnd5e-2024' as RulesetId, db2014, universal, [], DEFAULT_RULES);
    expect(toTarget.content[0].category).toBe('incompatible');
    expect(toTarget.after.inventory.carried[0].itemId).toBe('relic');

    // Switch back — same character, same stable reference, item resolves compatible again.
    const backTo2014 = simulateRulesetChange(toTarget.after, 'dnd5e-2014' as RulesetId, db2014, db2014, [], DEFAULT_RULES);
    expect(backTo2014.content[0]).toEqual({ type: 'item', id: 'relic', name: 'Relic', category: 'compatible' });
    expect(backTo2014.after.inventory.carried[0].itemId).toBe('relic');
  });

  it('a genuinely deleted spell (absent from both universal and target) is "unresolved", not "incompatible"', () => {
    const e = characterWithSpell('deleted_homebrew_spell');
    const preview = simulateRulesetChange(e, 'dnd5e-2024' as RulesetId, EMPTY_DB, EMPTY_DB, [], DEFAULT_RULES);
    expect(preview.content).toEqual([{ type: 'spell', id: 'deleted_homebrew_spell', name: 'deleted_homebrew_spell', category: 'unresolved' }]);
    expect(preview.issues.some(i => i.code === 'missing_spell' && i.affectedId === 'deleted_homebrew_spell')).toBe(true);
  });
});

describe('simulateRulesetChange — subclass resolution (item 3\'s subclass example)', () => {
  it('a homebrew Subclass tagged for a different ruleset is incompatible', () => {
    const sub: HomebrewSubclass = { id: 'tidewater_domain' as never, name: 'Tidewater Domain', classId: 'cleric', entries: [], rulesetId: 'dnd5e-2014' as never } as never;
    let e = makeEmptyEntity('char1');
    e = {
      ...e,
      identity: {
        ...e.identity,
        classId: 'cleric',
        classes: [{ classId: 'cleric', subclassId: 'tidewater_domain', level: 3 } as never],
      },
    };
    const preview = simulateRulesetChange(e, 'dnd5e-2024' as RulesetId, EMPTY_DB, EMPTY_DB, [sub], DEFAULT_RULES);
    const subclassEntry = preview.content.find(c => c.type === 'subclass');
    expect(subclassEntry?.category).toBe('incompatible');
  });
});

describe('simulateRulesetChange — pending and invalidated choices (items 12, 28)', () => {
  it('carries forward pending (unresolved) choices unchanged — never fabricates new ones', () => {
    let e = makeEmptyEntity('char1');
    e = {
      ...e,
      choices: [{
        id: 'pending_1',
        definition: { id: 'asi', prompt: 'Choose an ASI or Feat', kind: 'asi', count: 1, pool: 'all', grants: [], required: true, resolved: false },
        grantedAt: 4, resolved: false, selections: [],
      } as ChoiceState],
    };
    const preview = simulateRulesetChange(e, 'dnd5e-2024' as RulesetId, EMPTY_DB, EMPTY_DB, [], DEFAULT_RULES);
    expect(preview.pendingChoices).toEqual([{ id: 'pending_1', prompt: 'Choose an ASI or Feat' }]);
    expect(preview.invalidatedChoices).toEqual([]);
  });

  it('flags a RESOLVED choice whose selection is no longer compatible, without touching the underlying character data', () => {
    const universalDB: ContentDB = { ...EMPTY_DB, feats: [feat('blood_mark', 'Blood Mark', 'dnd5e-2014')] };
    const targetDB: ContentDB = { ...EMPTY_DB, feats: [] };
    let e = makeEmptyEntity('char1');
    e = {
      ...e,
      choices: [{
        id: 'feat_choice_1',
        definition: { id: 'feat_choice', prompt: 'Choose a feat', kind: 'feat', count: 1, pool: 'all', grants: [], required: true, resolved: true },
        grantedAt: 1, resolved: true, selections: ['feat:blood_mark'],
      } as ChoiceState],
    };
    const preview = simulateRulesetChange(e, 'dnd5e-2024' as RulesetId, universalDB, targetDB, [], DEFAULT_RULES);
    expect(preview.invalidatedChoices).toEqual([{ id: 'feat_choice_1', prompt: 'Choose a feat', reason: expect.any(String) }]);
    // The choice itself, and its selections, are UNCHANGED on the entity —
    // "preserve the reference, surface the issue" (item 8), never mutated.
    expect(preview.after.choices[0].selections).toEqual(['feat:blood_mark']);
    expect(preview.after.choices[0].resolved).toBe(true);
  });

  it('does not flag a resolved choice whose selection is still compatible', () => {
    const db: ContentDB = { ...EMPTY_DB, feats: [feat('alert', 'Alert')] }; // untagged = universal
    let e = makeEmptyEntity('char1');
    e = {
      ...e,
      choices: [{
        id: 'feat_choice_1',
        definition: { id: 'feat_choice', prompt: 'Choose a feat', kind: 'feat', count: 1, pool: 'all', grants: [], required: true, resolved: true },
        grantedAt: 1, resolved: true, selections: ['feat:alert'],
      } as ChoiceState],
    };
    const preview = simulateRulesetChange(e, 'dnd5e-2024' as RulesetId, db, db, [], DEFAULT_RULES);
    expect(preview.invalidatedChoices).toEqual([]);
  });
});

describe('simulateRulesetChange — derived stats (architectural finding: empty for a pure ruleset flip)', () => {
  it('produces zero derived-stat changes from the ruleset flip alone — recomputeDerived never re-resolves content by id', () => {
    const e = characterWithRace('some_race');
    const preview = simulateRulesetChange(e, 'dnd5e-2024' as RulesetId, EMPTY_DB, EMPTY_DB, [], DEFAULT_RULES);
    expect(preview.derivedChanges).toEqual([]);
  });
});

describe('simulateRulesetChange — engine-level cross-game / unsupported-ruleset guard (items 3, 5, 9, 10)', () => {
  it('rejects a cross-game target (both rulesets known, different Games) — blocked, structured Issue, entity.rulesetId untouched', () => {
    const e: Entity = { ...makeEmptyEntity('char1'), rulesetId: 'dnd5e-2014' as RulesetId };
    const preview = simulateRulesetChange(e, 'pf2e' as RulesetId, EMPTY_DB, EMPTY_DB, [], DEFAULT_RULES);
    expect(preview.blocked).toBe(true);
    expect(preview.blockedReason).toBeTruthy();
    expect(preview.after.rulesetId).toBe('dnd5e-2014'); // unchanged — never flipped
    expect(preview.before.rulesetId).toBe('dnd5e-2014');
    expect(preview.issues).toContainEqual(expect.objectContaining({ code: 'cross_game_ruleset', severity: 'error' }));
    expect(preview.content).toEqual([]);
    expect(canApplyRulesetChange(preview)).toBe(false);
  });

  it('rejects an unregistered/unknown target rulesetId — blocked, distinct Issue code, no mutation', () => {
    const e: Entity = { ...makeEmptyEntity('char1'), rulesetId: 'dnd5e-2014' as RulesetId };
    const preview = simulateRulesetChange(e, 'totally-made-up-ruleset' as RulesetId, EMPTY_DB, EMPTY_DB, [], DEFAULT_RULES);
    expect(preview.blocked).toBe(true);
    expect(preview.after.rulesetId).toBe('dnd5e-2014');
    expect(preview.issues).toContainEqual(expect.objectContaining({ code: 'unsupported_ruleset', severity: 'error' }));
    expect(canApplyRulesetChange(preview)).toBe(false);
  });

  it('does NOT block a same-game target even when that ruleset\'s mechanics aren\'t deeply implemented (item 4 — dnd4e is registered, same "dnd" Game as 2014)', () => {
    const e: Entity = { ...makeEmptyEntity('char1'), rulesetId: 'dnd5e-2014' as RulesetId };
    const preview = simulateRulesetChange(e, 'dnd4e' as RulesetId, EMPTY_DB, EMPTY_DB, [], DEFAULT_RULES);
    expect(preview.blocked).toBe(false);
    expect(preview.after.rulesetId).toBe('dnd4e');
    expect(canApplyRulesetChange(preview)).toBe(true);
  });

  it('an untagged (Game-unknown) current ruleset switching to a real "dnd" ruleset is never treated as cross-game', () => {
    const e = makeEmptyEntity('char1'); // rulesetId undefined
    const preview = simulateRulesetChange(e, 'dnd5e-2024' as RulesetId, EMPTY_DB, EMPTY_DB, [], DEFAULT_RULES);
    expect(preview.blocked).toBe(false);
  });

  it('canApplyRulesetChange is false for a same-ruleset no-op and true for a genuine, unblocked switch', () => {
    const same: Entity = { ...makeEmptyEntity('char1'), rulesetId: 'dnd5e-2014' as RulesetId };
    const samePreview = simulateRulesetChange(same, 'dnd5e-2014' as RulesetId, EMPTY_DB, EMPTY_DB, [], DEFAULT_RULES);
    expect(canApplyRulesetChange(samePreview)).toBe(false);

    const real: Entity = { ...makeEmptyEntity('char1'), rulesetId: 'dnd5e-2014' as RulesetId };
    const realPreview = simulateRulesetChange(real, 'dnd5e-2024' as RulesetId, EMPTY_DB, EMPTY_DB, [], DEFAULT_RULES);
    expect(canApplyRulesetChange(realPreview)).toBe(true);
  });

  it('mutation test (item 10): a cross-game switch attempted through the pure engine path never produces anything a caller could legitimately commit — no timeline/undo/sync call is reachable because canApplyRulesetChange gates it before any updateCharacter-style call would happen', () => {
    const e: Entity = { ...makeEmptyEntity('char1'), rulesetId: 'dnd5e-2014' as RulesetId };
    const preview = simulateRulesetChange(e, 'pf2e' as RulesetId, EMPTY_DB, EMPTY_DB, [], DEFAULT_RULES);
    // The one guard every caller (RulesetChangeModal today, any future
    // non-UI caller) is required to check before committing preview.after.
    expect(canApplyRulesetChange(preview)).toBe(false);
    // And even if a caller ignored the guard and applied preview.after
    // anyway, it would be a genuine no-op on rulesetId specifically —
    // never a silent cross-game corruption.
    expect(preview.after.rulesetId).toBe(e.rulesetId);
  });
});

describe('simulateRulesetChange — mutation purity', () => {
  it('never mutates the original entity passed in', () => {
    const e = characterWithRace('tideborn');
    const originalRulesetId = e.rulesetId;
    simulateRulesetChange(e, 'dnd5e-2024' as RulesetId, EMPTY_DB, EMPTY_DB, [], DEFAULT_RULES);
    expect(e.rulesetId).toBe(originalRulesetId);
  });

  it('after.rulesetId is set to undefined when targetRulesetId is undefined (switching back to "universal")', () => {
    const e: Entity = { ...makeEmptyEntity('char1'), rulesetId: 'dnd5e-2024' as RulesetId };
    const preview = simulateRulesetChange(e, undefined, EMPTY_DB, EMPTY_DB, [], DEFAULT_RULES);
    expect(preview.after.rulesetId).toBeUndefined();
    expect(preview.sameRuleset).toBe(false);
  });
});
