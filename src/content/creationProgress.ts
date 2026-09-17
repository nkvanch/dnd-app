// src/content/creationProgress.ts
// CREATION-HUB-PROGRESS-1: authoritative Skills/Spells entitlement
// calculations, shared between the creation screens' own "Selected X/Y"
// headers and the creation hub's progress subtitles — so the hub can
// never show a different number than the picker itself, and so there's
// exactly one place this math lives.
//
// Deliberately NOT defined inside app/creation/skills.tsx or spells.tsx
// (where the logic conceptually "belongs") — both of those are route
// files that import `useRouter` from `expo-router` at module scope, and
// requiring that module from a Jest test file breaks (Jest's
// transformIgnorePatterns doesn't transform expo-router's
// `standard-navigation` ESM submodule — the exact class of bug found and
// fixed once already this session for AsiFeatPicker.tsx, and preemptively
// avoided for equipmentDisplay.ts). Living in a plain content module keeps
// this pure logic directly unit-testable and importable from hub.tsx too
// without either route needing to import the other.
import { ChoiceOption, ChoiceState, Entity, CampaignRules, SkillName } from '../engine/types';
import { skillOverlapMode } from '../engine/houseRules';

// ── Skills ───────────────────────────────────────────────────────────────

function skillChoicePool(choice: ChoiceState, allSkillLabels: Record<string, string>): ChoiceOption[] {
  if (choice.definition.pool === 'all') {
    return (Object.keys(allSkillLabels) as SkillName[]).map(sk => ({ id: sk, label: allSkillLabels[sk], value: sk }));
  }
  return Array.isArray(choice.definition.pool) ? choice.definition.pool : [];
}

// Mirrors skills.tsx's own SKILL_LABELS keys (the full 18-skill list) —
// only the KEY SET matters here (for pool:'all' expansion), not the
// display labels, so a small local duplicate of just the keys avoids a
// circular/route-file import for one string array.
const ALL_SKILL_KEYS: SkillName[] = [
  'athletics', 'acrobatics', 'sleight_of_hand', 'stealth', 'arcana', 'history',
  'investigation', 'nature', 'religion', 'animal_handling', 'insight', 'medicine',
  'perception', 'survival', 'deception', 'intimidation', 'performance', 'persuasion',
];
const SKILL_LABEL_STUB: Record<string, string> = Object.fromEntries(ALL_SKILL_KEYS.map(k => [k, k]));

/** The one authoritative "how many skill picks are actually achievable,
 *  and how many have been filled" calculation — mirrors skills.tsx's own
 *  achievableCount() (house-rule-aware: 'warn' mode can reduce a choice's
 *  true achievable count below its nominal definition.count when the
 *  class/background already trained an overlapping skill) rather than a
 *  simpler denominator that could show a misleading "needs 1 more" once
 *  warn mode has already resolved the choice at its true achievable
 *  count. Returns null when there are no skill choices at all (nothing to
 *  show, distinct from "0/0"). */
export function skillProgressFor(entity: Entity, rules: CampaignRules): { done: number; total: number } | null {
  const allSkillChoices = entity.choices.filter(c => c.definition.kind === 'skill');
  if (allSkillChoices.length === 0) return null;
  const overlapMode = skillOverlapMode(rules);
  function achievable(choice: ChoiceState): number {
    if (overlapMode === 'replacement') return choice.definition.count;
    const basePool = skillChoicePool(choice, SKILL_LABEL_STUB);
    const pickable = basePool.filter(o => !entity.skills.skills[o.value as SkillName]?.trained).length;
    return Math.min(choice.definition.count, pickable);
  }
  let done = 0, total = 0;
  for (const c of allSkillChoices) {
    const target = achievable(c);
    total += target;
    done += c.resolved ? Math.min(c.selections.length, target) : 0;
  }
  return { done, total };
}

// ── Spells ───────────────────────────────────────────────────────────────

// Starting spells known at level 1, by class — see spells.tsx's own
// (fuller) copy of this comment for the RAW rationale per class. Kept as
// the single source of truth here; spells.tsx imports this rather than
// declaring its own copy.
export const SPELLS_AT_L1: Record<string, { cantrips: number; spells: number }> = {
  sorcerer:   { cantrips: 4, spells: 2 },
  bard:       { cantrips: 2, spells: 4 },
  warlock:    { cantrips: 2, spells: 2 },
  cleric:     { cantrips: 3, spells: 0 },
  druid:      { cantrips: 2, spells: 0 },
  ranger:     { cantrips: 0, spells: 0 },
  paladin:    { cantrips: 0, spells: 0 },
  artificer:  { cantrips: 0, spells: 0 },
};

export type CreationSpellPicks = { cantrips: string[]; spells: string[] };

/** What the player themselves picked ON the content-based spells screen,
 *  tracked separately from entity.spellcasting.cantrips/known — see
 *  spells.tsx's own (fuller) doc comment on why this can't just read
 *  spellcasting directly (domain-granted "always prepared" spells share
 *  the same array with no marker distinguishing them). */
export function readCreationPicks(entity: Entity | null | undefined): CreationSpellPicks {
  try {
    const n = JSON.parse(entity?.notes || '{}') as { creationSpellPicks?: Partial<CreationSpellPicks> };
    return { cantrips: n.creationSpellPicks?.cantrips ?? [], spells: n.creationSpellPicks?.spells ?? [] };
  } catch {
    return { cantrips: [], spells: [] };
  }
}

export function writeCreationPicks(entity: Entity, picks: CreationSpellPicks): Entity {
  let n: Record<string, unknown> = {};
  try { n = JSON.parse(entity.notes || '{}'); } catch { /* ignore */ }
  return { ...entity, notes: JSON.stringify({ ...n, creationSpellPicks: picks }) };
}

/** The one authoritative cumulative Cantrips/Known-Spells entitlement for
 *  creation — reused by both spells.tsx's own "Selected X/Y" section
 *  headers and the creation hub's progress subtitle. Handles both paths
 *  spells.tsx supports: the ChoiceDefinition-based one (kind:'spell'
 *  choices, grouped into cantrip vs known exactly like spells.tsx's own
 *  renderGroup split) and the content-based one (SPELLS_AT_L1 target +
 *  creationSpellPicks). A null entry means "not applicable" (e.g. a
 *  non-caster, or nothing required at this level) — not "0/0" — so a
 *  caller can distinguish "nothing to show" from "done". */
export type SpellProgress = {
  cantrips: { done: number; total: number } | null;
  spells:   { done: number; total: number } | null;
};
export function spellProgressFor(entity: Entity): SpellProgress {
  const spellKindChoices = entity.choices.filter(c => c.definition.kind === 'spell');
  if (spellKindChoices.length > 0) {
    const isCantripChoice = (id: string) => id.includes('cantrip');
    const cantripGroup = spellKindChoices.filter(c => isCantripChoice(c.id));
    const knownGroup   = spellKindChoices.filter(c => !isCantripChoice(c.id));
    const totals = (group: ChoiceState[]) => group.reduce((s, c) => s + c.definition.count, 0);
    const doneCounts = (group: ChoiceState[]) => group.reduce((s, c) => s + (c.resolved ? c.selections.length : 0), 0);
    return {
      cantrips: cantripGroup.length > 0 ? { done: doneCounts(cantripGroup), total: totals(cantripGroup) } : null,
      spells:   knownGroup.length > 0   ? { done: doneCounts(knownGroup),   total: totals(knownGroup) }   : null,
    };
  }
  const targets = SPELLS_AT_L1[entity.identity.classId ?? ''] ?? { cantrips: 0, spells: 0 };
  if (targets.cantrips === 0 && targets.spells === 0) return { cantrips: null, spells: null };
  const picks = readCreationPicks(entity);
  return {
    cantrips: targets.cantrips > 0 ? { done: picks.cantrips.length, total: targets.cantrips } : null,
    spells:   targets.spells > 0   ? { done: picks.spells.length,   total: targets.spells }   : null,
  };
}

/**
 * SPELL-ACCUMULATION-2: splits a list of pending (unresolved) ChoiceStates
 * into cantrip vs. known-spell groups, same id.includes('cantrip') test
 * spellProgressFor/spells.tsx/SpellChoicePicker already use for the same
 * distinction. Used by TabFeatures.tsx's PENDING CHOICES list to collapse
 * N separate per-level spell ChoiceStates into at most 2 rows (one per
 * non-empty group) instead of one row per underlying choice — the same
 * SPELL-ACCUMULATION-1 fix app/creation/spells.tsx already has for the
 * creation flow, applied here to the live-play/level-up sheet.
 */
export function groupPendingSpellChoices(pendingChoices: ChoiceState[]): {
  cantripPending: ChoiceState[];
  knownSpellPending: ChoiceState[];
} {
  const spellPending = pendingChoices.filter(c => c.definition.kind === 'spell');
  const isCantripChoice = (id: string) => id.includes('cantrip');
  return {
    cantripPending: spellPending.filter(c => isCantripChoice(c.definition.id)),
    knownSpellPending: spellPending.filter(c => !isCantripChoice(c.definition.id)),
  };
}
