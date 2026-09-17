// src/content/choiceDefinitionCompiler.ts
// CHOICE-AUTHORING-1: pure "draft <-> canonical ChoiceDefinition" compiler for
// the shared homebrew choice-authoring editor (src/components/homebrew/
// ChoiceDefinitionEditor.tsx), mirroring traitCompiler.ts's own split (plain
// TS here, React in the component file) so this stays importable from
// content-layer code with zero RN/React dependency.
//
// Scope: authors ChoiceDefinition kinds 'expertise' | 'tool' | 'language'
// only, matching the runtime support that already exists (choiceEligibility.ts,
// leveling.ts's applyExpertiseChoiceToEntity/applyToolChoiceToEntity/
// applyLanguageChoiceToEntity). Adding a future authorable kind means adding
// one more case to registryFor/categoryOrderFor/defaultPrompt below — the
// DraftChoice shape and every builder integration stay unchanged.
//
// Runtime legality (proficient-and-not-already-expert, no duplicates, exact
// count) is deliberately NOT re-implemented here — this module only compiles
// what pool is LEGAL TO OFFER, the same "filters may narrow, never broaden"
// invariant choiceEligibility.ts already enforces at resolution time.
import { ChoiceDefinition, ChoiceOption } from '../engine/types';
import { ALL_SKILL_OPTIONS } from './skills';
import { ALL_TOOLS, TOOL_CATEGORY_ORDER } from './tools';
import { ALL_LANGUAGES, LANGUAGE_CATEGORY_ORDER } from './languages';

export type AuthorableChoiceKind = 'expertise' | 'tool' | 'language';
export type PoolMode = 'all' | 'category' | 'restricted';

export type DraftChoice = {
  localId: string;
  kind: AuthorableChoiceKind;
  /** Text field so an in-progress edit (e.g. a momentarily empty box) doesn't
   * need to be a valid number — parsed/clamped only at compile time. */
  count: string;
  /** Blank means "use the kind's own default prompt" at compile time. */
  prompt: string;
  poolMode: PoolMode;
  /** ToolCategory[] | LanguageCategory[] — ignored for kind 'expertise' (no
   * category concept for skills; the UI never offers this mode for it). */
  categories: string[];
  /** SkillName[] | tool id[] | language id[] depending on kind. */
  restrictedIds: string[];
};

type RegistryEntry = { id: string; label: string; category?: string };

let draftCounter = 0;
export function newDraftChoiceId(): string {
  draftCounter += 1;
  return `choice_${Date.now().toString(36)}_${draftCounter.toString(36)}`;
}

export function newDraftChoice(kind: AuthorableChoiceKind): DraftChoice {
  return {
    localId: newDraftChoiceId(),
    kind,
    count: '1',
    prompt: '',
    poolMode: 'all',
    categories: [],
    restrictedIds: [],
  };
}

export function registryFor(kind: AuthorableChoiceKind): RegistryEntry[] {
  if (kind === 'expertise') return ALL_SKILL_OPTIONS.map(o => ({ id: o.id, label: o.label }));
  if (kind === 'tool') return ALL_TOOLS.map(t => ({ id: t.id, label: t.name, category: t.category }));
  return ALL_LANGUAGES.map(l => ({ id: l.id, label: l.name, category: l.category }));
}

export function categoryOrderFor(kind: AuthorableChoiceKind): string[] {
  if (kind === 'tool') return [...TOOL_CATEGORY_ORDER];
  if (kind === 'language') return [...LANGUAGE_CATEGORY_ORDER];
  return [];
}

export function idsForCategories(kind: AuthorableChoiceKind, categories: string[]): string[] {
  if (categories.length === 0) return [];
  const registry = registryFor(kind);
  const catSet = new Set(categories);
  return registry.filter(o => o.category && catSet.has(o.category)).map(o => o.id);
}

function optionFor(kind: AuthorableChoiceKind, id: string): ChoiceOption {
  const entry = registryFor(kind).find(o => o.id === id);
  return { id, label: entry?.label ?? id, value: id };
}

function defaultPrompt(kind: AuthorableChoiceKind, count: number): string {
  const n = count === 1 ? 'one' : String(count);
  if (kind === 'expertise') return `Choose ${n} skill${count === 1 ? '' : 's'} to gain Expertise in.`;
  if (kind === 'tool') return `Choose ${n} tool proficienc${count === 1 ? 'y' : 'ies'}.`;
  return `Choose ${n} language${count === 1 ? '' : 's'}.`;
}

export function poolSizeForDraft(draft: DraftChoice): number {
  if (draft.poolMode === 'all') return registryFor(draft.kind).length;
  if (draft.poolMode === 'restricted') return draft.restrictedIds.length;
  return idsForCategories(draft.kind, draft.categories).length;
}

/** Authoring-time sanity checks only — never the runtime eligibility rules
 * (proficient/not-already-expert/no-duplicates), which stay solely in
 * choiceEligibility.ts + leveling.ts's apply*ChoiceToEntity functions. */
export function validateDraftChoice(draft: DraftChoice): string[] {
  const errors: string[] = [];
  const count = parseInt(draft.count, 10);
  if (!Number.isFinite(count) || count < 1) {
    errors.push('Count must be a whole number of at least 1.');
  }
  if (draft.poolMode === 'restricted') {
    if (draft.restrictedIds.length === 0) {
      errors.push('Restricted pool is empty — pick at least one option.');
    }
    if (new Set(draft.restrictedIds).size !== draft.restrictedIds.length) {
      errors.push('Restricted pool has duplicate options.');
    }
    const registryIds = new Set(registryFor(draft.kind).map(o => o.id));
    const unknown = draft.restrictedIds.filter(id => !registryIds.has(id));
    if (unknown.length > 0) {
      errors.push(`Unknown ids in restricted pool: ${unknown.join(', ')}.`);
    }
    if (Number.isFinite(count) && count > 0 && draft.restrictedIds.length < count) {
      errors.push(`Count (${count}) exceeds the restricted pool size (${draft.restrictedIds.length}).`);
    }
  }
  if (draft.poolMode === 'category') {
    if (draft.categories.length === 0) {
      errors.push('Select at least one category.');
    }
    const size = idsForCategories(draft.kind, draft.categories).length;
    if (Number.isFinite(count) && count > 0 && size < count) {
      errors.push(`Count (${count}) exceeds the number of options in the selected categories (${size}).`);
    }
  }
  return errors;
}

/** idPrefix namespaces the compiled id (e.g. RACE_CHOICE_PREFIX/
 * BACKGROUND_CHOICE_PREFIX) so content-swap cleanup (clearRaceFeatures,
 * swapBackground) can sweep these by prefix, same convention Race/Subrace's
 * hand-authored pendingChoices already use. grants:[]/required:true/
 * resolved:false match every other 'all'-pool-resolved-via-bypass-function
 * choice literal in src/content (see expertiseChoice() in classes/index.ts). */
export function draftChoiceToDefinition(draft: DraftChoice, idPrefix = ''): ChoiceDefinition {
  const count = Math.max(1, parseInt(draft.count, 10) || 1);
  const pool: ChoiceDefinition['pool'] =
    draft.poolMode === 'all' ? 'all' :
    draft.poolMode === 'restricted' ? draft.restrictedIds.map(id => optionFor(draft.kind, id)) :
    idsForCategories(draft.kind, draft.categories).map(id => optionFor(draft.kind, id));
  return {
    id: `${idPrefix}${draft.localId}`,
    prompt: draft.prompt.trim() || defaultPrompt(draft.kind, count),
    kind: draft.kind,
    count,
    pool,
    grants: [],
    required: true,
    resolved: false,
  };
}

/** Reverse of draftChoiceToDefinition, for reopening an already-saved
 * ChoiceDefinition (homebrew or, in principle, imported) in the editor.
 * Returns null for a kind this editor doesn't author (e.g. 'skill'/'asi') —
 * callers should leave those definitions untouched rather than drop them,
 * so round-tripping a feature/race/etc. authored partly outside this editor
 * never loses data it doesn't understand. */
export function definitionToDraftChoice(def: ChoiceDefinition, idPrefix = ''): DraftChoice | null {
  if (def.kind !== 'expertise' && def.kind !== 'tool' && def.kind !== 'language') return null;
  const kind = def.kind;
  const localId = def.id.startsWith(idPrefix) ? def.id.slice(idPrefix.length) : def.id;
  const base = { localId, kind, count: String(def.count), prompt: def.prompt };

  if (def.pool === 'all') {
    return { ...base, poolMode: 'all', categories: [], restrictedIds: [] };
  }
  if (!Array.isArray(def.pool)) {
    // FilterExpression — not produced by this editor; open as an empty
    // restricted pool rather than throwing, so the content still opens.
    return { ...base, poolMode: 'restricted', categories: [], restrictedIds: [] };
  }
  const ids = def.pool.map(o => String(o.value ?? o.id));
  const detected = detectExactCategoryUnion(kind, ids);
  if (detected) {
    return { ...base, poolMode: 'category', categories: detected, restrictedIds: [] };
  }
  return { ...base, poolMode: 'restricted', categories: [], restrictedIds: ids };
}

/** Best-effort: if a literal pool's id set exactly equals the union of one or
 * more whole categories, reconstruct 'category' mode so re-saving without
 * changes stays a no-op UI-wise too (not just semantically) — reopening a
 * "one gaming set" migration shows Category:[Gaming Sets] again, not a
 * 4-item restricted list. Falls back to 'restricted' (still semantically
 * correct — same compiled pool either way) for anything that isn't an exact
 * category union, including a genuinely hand-picked restricted list that
 * happens to overlap a category partially. */
function detectExactCategoryUnion(kind: AuthorableChoiceKind, ids: string[]): string[] | null {
  const categoryOrder = categoryOrderFor(kind);
  if (categoryOrder.length === 0) return null;
  const idSet = new Set(ids);
  if (idSet.size === 0) return null;
  const n = categoryOrder.length;
  for (let mask = 1; mask < (1 << n); mask++) {
    const chosen: string[] = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) chosen.push(categoryOrder[i]);
    const union = idsForCategories(kind, chosen);
    if (union.length !== idSet.size) continue;
    if (union.every(id => idSet.has(id))) return chosen;
  }
  return null;
}
