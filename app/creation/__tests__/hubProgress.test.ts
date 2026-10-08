// app/creation/__tests__/hubProgress.test.ts
// CREATION-HUB-PROGRESS-1: pure-logic coverage for the two authoritative
// entitlement calculators the creation hub's Skills/Spells subtitles (and
// skills.tsx/spells.tsx's own "Selected X/Y" headers) are built on. Both
// live in src/content/creationProgress.ts specifically because that's a
// plain content module, not a route file — skills.tsx/spells.tsx/hub.tsx
// all import `useRouter` from expo-router at module scope, and requiring
// any of them from a Jest test file breaks (Jest's transformIgnorePatterns
// doesn't transform expo-router's `standard-navigation` ESM submodule —
// confirmed by direct probe this session, the same bug class found and
// fixed once already for AsiFeatPicker.tsx).
import { skillProgressFor, spellProgressFor, SPELLS_AT_L1 } from '../../../src/content/creationProgress';
import { makeEmptyEntity, DEFAULT_RULES } from '../../../src/store/characterStore';
import { queueChoice } from '../../../src/engine/leveling';
import type { ChoiceDefinition, Entity, CampaignRules, SkillName } from '../../../src/engine/types';

function warnModeRules(): CampaignRules {
  return { ...DEFAULT_RULES, customRules: { ...DEFAULT_RULES.customRules, skillOverlapMode: 'warn' } };
}

function skillChoiceDef(id: string, count: number, pool: SkillName[]): ChoiceDefinition {
  return {
    id, prompt: `Choose ${count} skills`, kind: 'skill', count,
    pool: pool.map(sk => ({ id: sk, label: sk, value: sk })),
    grants: [], required: true, resolved: false,
  };
}

describe('skillProgressFor', () => {
  it('returns null when there are no skill choices at all', () => {
    expect(skillProgressFor(makeEmptyEntity('e1'), DEFAULT_RULES)).toBeNull();
  });

  it('an unresolved choice contributes 0 done out of its full nominal count', () => {
    const e = queueChoice(makeEmptyEntity('e1'), skillChoiceDef('skills_a', 2, ['athletics', 'stealth', 'perception']), 1);
    expect(skillProgressFor(e, DEFAULT_RULES)).toEqual({ done: 0, total: 2 });
  });

  it('a resolved choice contributes its actual selection count as done', () => {
    let e = queueChoice(makeEmptyEntity('e1'), skillChoiceDef('skills_a', 2, ['athletics', 'stealth', 'perception']), 1);
    e = {
      ...e,
      choices: e.choices.map(c => c.id === 'skills_a_1' ? { ...c, resolved: true, selections: ['athletics', 'stealth'] } : c),
    };
    expect(skillProgressFor(e, DEFAULT_RULES)).toEqual({ done: 2, total: 2 });
  });

  it('sums across multiple choices (e.g. class choice + background-granted choice)', () => {
    let e = queueChoice(makeEmptyEntity('e1'), skillChoiceDef('class_skills', 2, ['athletics', 'stealth', 'perception']), 1);
    e = queueChoice(e, skillChoiceDef('bg_skills', 1, ['insight', 'religion']), 1);
    e = {
      ...e,
      choices: e.choices.map(c => c.id === 'class_skills_1' ? { ...c, resolved: true, selections: ['athletics', 'stealth'] } : c),
    };
    expect(skillProgressFor(e, DEFAULT_RULES)).toEqual({ done: 2, total: 3 });
  });

  it('warn-mode overlap reduces the achievable (denominator) count, not just the numerator', () => {
    let e = queueChoice(makeEmptyEntity('e1'), skillChoiceDef('skills_a', 2, ['athletics', 'stealth']), 1);
    // Both pool skills are already trained (e.g. background granted them) —
    // under 'warn' mode (stay on class list, accept fewer picks), the true
    // achievable count for this choice drops to 0, not 2.
    e = {
      ...e,
      skills: {
        skills: {
          ...e.skills.skills,
          athletics: { ...e.skills.skills.athletics, trained: true },
          stealth:   { ...e.skills.skills.stealth, trained: true },
        },
      },
    };
    expect(skillProgressFor(e, warnModeRules())).toEqual({ done: 0, total: 0 });
  });
});

describe('spellProgressFor', () => {
  it('returns all-null for a non-caster with no spell choices and no spellcasting block', () => {
    const p = spellProgressFor(makeEmptyEntity('e1'));
    expect(p.cantrips).toBeNull();
    expect(p.spells).toBeNull();
  });

  it('content-based path: reads the SPELLS_AT_L1 target and creationSpellPicks, ignoring externally-granted spells', () => {
    const targets = SPELLS_AT_L1.cleric; // { cantrips: 3, spells: 0 }
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      identity: { ...makeEmptyEntity('e1').identity, classId: 'cleric' },
      spellcasting: {
        cantrips: ['light', 'guidance'], // 2 player-picked cantrips
        known: ['bless', 'cure_wounds'], // domain-granted "always prepared" spells — NOT player picks
        prepared: [], slots: {} as any, pactSlots: undefined,
      } as any,
      notes: JSON.stringify({ creationSpellPicks: { cantrips: ['light', 'guidance'], spells: [] } }),
    };
    const p = spellProgressFor(e);
    expect(p.cantrips).toEqual({ done: 2, total: targets.cantrips });
    // Cleric has 0 required starting known spells (prepared caster) — the
    // 2 domain-granted spells in spellcasting.known must NOT show up as a
    // "spells" entitlement at all (target is 0, so this stays null).
    expect(p.spells).toBeNull();
  });

  it('content-based path reaches 0/0-style "nothing to pick" as all-null (vacuously satisfied), not a fabricated fraction', () => {
    const e: Entity = { ...makeEmptyEntity('e1'), identity: { ...makeEmptyEntity('e1').identity, classId: 'ranger' } };
    const p = spellProgressFor(e);
    expect(p.cantrips).toBeNull();
    expect(p.spells).toBeNull();
  });

  it('ChoiceDefinition-based path: groups cantrip vs known-spell choices and sums resolved selections separately', () => {
    const cantripDef: ChoiceDefinition = {
      id: 'wizard_cantrip', prompt: 'Choose cantrips', kind: 'spell', count: 3,
      pool: 'all', grants: [], required: true, resolved: false,
    };
    const knownDef: ChoiceDefinition = {
      id: 'wizard_known', prompt: 'Choose spells', kind: 'spell', count: 6,
      pool: 'all', grants: [], required: true, resolved: false,
    };
    let e = queueChoice(makeEmptyEntity('e1'), cantripDef, 1);
    e = queueChoice(e, knownDef, 1);
    e = {
      ...e,
      choices: e.choices.map(c =>
        c.id === 'wizard_cantrip_1' ? { ...c, resolved: true, selections: ['fire_bolt', 'mage_hand', 'prestidigitation'] } : c
      ),
    };
    const p = spellProgressFor(e);
    expect(p.cantrips).toEqual({ done: 3, total: 3 });
    expect(p.spells).toEqual({ done: 0, total: 6 });
  });
});

// Item 11 — Required/Automatic/Manual separation, Feats side: the hub's
// "Ability Improvements" entitlement (the one BOUNDED, authoritative
// feat-adjacent counter this engine has — see hub.tsx's own asiSubtitle
// doc comment for why creation-time "Feats (optional)" itself has no
// fixed total) is a straight count of kind:'asi' ChoiceState entries.
// Automatic feat grants (e.g. a race's bonus feat) and manual/additional
// feats are both just entries in entity.features with source.kind:'feat'
// — neither is a ChoiceState, so neither can appear in this filter at
// all. This test proves that structurally, the same way the Equipment
// regression test above does for manual items.
describe('Required vs Automatic/Manual feat separation (regression, item 11)', () => {
  function asiChoiceCount(e: Entity): { done: number; total: number } {
    const all = e.choices.filter(c => c.definition.kind === 'asi');
    return { done: all.filter(c => c.resolved).length, total: all.length };
  }

  it('required ASI/feat slots stay at their own count regardless of automatic or manual feat features present', () => {
    const asiDef: ChoiceDefinition = {
      id: 'fighter_asi_4', prompt: 'Choose an ASI or feat.', kind: 'asi', count: 1,
      pool: 'all', grants: [], required: true, resolved: false,
    };
    let e = queueChoice(makeEmptyEntity('e1'), asiDef, 4);
    expect(asiChoiceCount(e)).toEqual({ done: 0, total: 1 }); // 0/1 required, not /3 or /5

    // An automatic race-granted feat (e.g. Variant Human) — a plain
    // Feature, not tied to any ChoiceState.
    e = {
      ...e,
      features: [...e.features, {
        id: 'variant_human_feat', name: 'Alert', description: '...', source: { kind: 'feat', refId: 'alert' },
        level: null, effects: [], actions: [], choices: [], passive: true, isActive: true,
      }],
    };
    expect(asiChoiceCount(e)).toEqual({ done: 0, total: 1 }); // unchanged — still 0/1

    // A manual/additional feat added later (in-play "+Feat", or a second
    // creation-time optional pick) — also just a Feature.
    e = {
      ...e,
      features: [...e.features, {
        id: 'manual_feat_tough', name: 'Tough', description: '...', source: { kind: 'feat', refId: 'tough' },
        level: null, effects: [], actions: [], choices: [], passive: true, isActive: true,
      }],
    };
    expect(asiChoiceCount(e)).toEqual({ done: 0, total: 1 }); // still unchanged — 2 feat features present, required count still /1

    // Resolving the ACTUAL required choice is what changes the counter.
    e = { ...e, choices: e.choices.map(c => c.id === 'fighter_asi_4_4' ? { ...c, resolved: true, selections: ['feat:tough'] } : c) };
    expect(asiChoiceCount(e)).toEqual({ done: 1, total: 1 });
  });
});

// CHOICE-EXPANSION-1 item 34: proves hub.tsx's choiceKindSubtitle (and its
// EXPERTISE_SECTION/TOOL_SECTION/LANGUAGE_SECTION `done` predicates, same
// `d.choices.filter(...)` shape) match the real underlying ChoiceState —
// same "count directly off entity.choices, never a fabricated total" rule
// as the ASI test above. hub.tsx itself can't be imported here (see file
// header), so this locks in the identical filter/count logic it uses.
describe('Expertise/Tool/Language hub progress (item 18/19/34)', () => {
  function kindProgress(e: Entity, kind: 'expertise' | 'tool' | 'language'): { done: number; total: number } {
    const all = e.choices.filter(c => c.definition.kind === kind);
    return { done: all.filter(c => c.resolved).length, total: all.length };
  }

  it('matches the real unresolved-choice count for each kind independently', () => {
    let e = makeEmptyEntity('e1');
    e = queueChoice(e, { id: 'rogue_expertise_1', prompt: '', kind: 'expertise', count: 2, pool: 'all', grants: [], required: true, resolved: false }, 1);
    e = queueChoice(e, { id: 'tool_choice', prompt: '', kind: 'tool', count: 1, pool: 'all', grants: [], required: true, resolved: false }, 1);
    e = queueChoice(e, { id: 'lang_choice_a', prompt: '', kind: 'language', count: 1, pool: 'all', grants: [], required: true, resolved: false }, 1);
    e = queueChoice(e, { id: 'lang_choice_b', prompt: '', kind: 'language', count: 1, pool: 'all', grants: [], required: true, resolved: false }, 1);

    expect(kindProgress(e, 'expertise')).toEqual({ done: 0, total: 1 });
    expect(kindProgress(e, 'tool')).toEqual({ done: 0, total: 1 });
    expect(kindProgress(e, 'language')).toEqual({ done: 0, total: 2 }); // "Languages 0/2", not fabricated

    e = { ...e, choices: e.choices.map(c => c.id === 'lang_choice_a_1' ? { ...c, resolved: true, selections: ['elvish'] } : c) };
    expect(kindProgress(e, 'language')).toEqual({ done: 1, total: 2 });
  });

  it('an automatic grant (no ChoiceState at all) never inflates the denominator (item 14)', () => {
    let e = makeEmptyEntity('e1');
    // Automatic Thieves' Tools — a plain proficiency merge, no ChoiceState.
    e = { ...e, proficiencies: { ...e.proficiencies, tools: ['thieves_tools'] } };
    e = queueChoice(e, { id: 'artisan_choice', prompt: '', kind: 'tool', count: 1, pool: 'all', grants: [], required: true, resolved: false }, 1);
    expect(kindProgress(e, 'tool')).toEqual({ done: 0, total: 1 }); // not 1/2 or 0/2
  });
});
