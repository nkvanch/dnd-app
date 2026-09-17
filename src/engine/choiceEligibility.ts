// src/engine/choiceEligibility.ts
// CHOICE-EXPANSION-1: pure "what's legal to pick right now" computation for
// Expertise/Tool/Language choices, shared by TabFeatures.tsx (live play) and
// app/creation/repeated-choice.tsx (creation flow) — item 19's invariant
// ("hub count == picker count == underlying unresolved choice count") only
// holds if both surfaces compute eligibility identically, so this lives in
// exactly one place rather than being duplicated per screen.
//
// Structurally compatible with RepeatedChoicePicker's own RepeatedChoiceOption
// prop shape (id/label/sublabel?/group?) without importing a UI type into
// the engine layer.
import { Entity, ChoiceDefinition } from './types';
import { ALL_SKILL_OPTIONS } from '../content/skills';
import { ALL_TOOLS } from '../content/tools';
import { ALL_LANGUAGES, SELECTABLE_LANGUAGE_CATEGORIES } from '../content/languages';

export type EligibleOption = { id: string; label: string; sublabel?: string; group?: string };

/** A literal ChoiceOption[] pool restricts eligibility to those ids/values; the 'all' sentinel (or a FilterExpression, unused today) means "no extra restriction beyond the registry itself" — item 12: filters only narrow the legal pool, never broaden it. */
function poolRestriction(pool: ChoiceDefinition['pool']): Set<string> | null {
  if (!Array.isArray(pool)) return null;
  return new Set(pool.map(o => String(o.value ?? o.id)));
}

/** item 3: eligible = currently trained AND not already expert AND allowed by the source choice's own pool. */
export function eligibleExpertiseOptions(entity: Entity, pool: ChoiceDefinition['pool']): EligibleOption[] {
  const restrictTo = poolRestriction(pool);
  return ALL_SKILL_OPTIONS
    .filter(opt => {
      const entry = entity.skills.skills[opt.value];
      if (!entry?.trained || entry.expertise) return false;
      if (restrictTo && !restrictTo.has(opt.value)) return false;
      return true;
    })
    .map(opt => ({ id: opt.value, label: opt.label }));
}

/** item 27: not already proficient with the same tool (no duplicates). */
export function eligibleToolOptions(entity: Entity, pool: ChoiceDefinition['pool']): EligibleOption[] {
  const restrictTo = poolRestriction(pool);
  return ALL_TOOLS
    .filter(t => !entity.proficiencies.tools.includes(t.id))
    .filter(t => !restrictTo || restrictTo.has(t.id))
    .map(t => ({ id: t.id, label: t.name, group: t.category }));
}

/** item 13: secret languages excluded from the default 'all'-sentinel pool, but selectable when a choice's own literal pool explicitly includes them. item 27: not already known. */
export function eligibleLanguageOptions(entity: Entity, pool: ChoiceDefinition['pool']): EligibleOption[] {
  const restrictTo = poolRestriction(pool);
  return ALL_LANGUAGES
    .filter(l => restrictTo ? restrictTo.has(l.id) : SELECTABLE_LANGUAGE_CATEGORIES.includes(l.category))
    .filter(l => !entity.proficiencies.languages.includes(l.id))
    .map(l => ({ id: l.id, label: l.name, sublabel: l.script ? `Script: ${l.script}` : undefined, group: l.category }));
}
