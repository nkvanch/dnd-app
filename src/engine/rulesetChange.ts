// src/engine/rulesetChange.ts
// LIVE-RULESET-1: preview + apply a live character's rulesetId change.
//
// Deliberately NOT a separate rules engine (per the spec's own instruction):
// reuses simulate() for the before/after/diff, validateEntity() for content-
// reference diagnostics (it ALREADY reads entity.rulesetId and filters
// against it — see app/sheet/[id].tsx's existing
// getMergedContentDB(entity.rulesetId) call, confirmed unused by anything
// until this feature actually sets rulesetId), and the existing
// ContentResolution functions (getSubclassEntryMerged/resolveSpellById/
// resolveItemById) for subclass/spell/item lookups. This file adds exactly
// one new thing: categorizing each of the character's own content
// references as compatible/incompatible/unresolved by comparing its
// resolution against a RULESET-FILTERED ContentDB vs an UNFILTERED
// ("universal") one — a distinction nothing else in the app needed before,
// since nothing else compares two resolution contexts for the same entity.
//
// Scope note, confirmed by reading the actual content/engine before writing
// this: dnd5e-2014 and dnd5e-2024 deliberately SHARE identical ability
// scores/skills/action economy/proficiency-bonus math (the paused ruleset-
// migration plan's own explicit choice — 5.5e is content-tagging only, not
// a RulesetDefinition-parameterized engine). So switching between them is a
// CONTENT-POOL change, not a rules-math change — and this engine's content
// resolution is strictly id-based, so a same-named-different-id definition
// is never silently substituted (a dedicated regression test proves this).
//
// A second, more consequential finding from reading pipeline.ts before
// writing this: recomputeDerived(entity, rules) takes NO ContentDB
// parameter at all — derived stats are computed purely from the entity's
// own already-baked-in `features`/`inventory`/etc., never by re-resolving
// race/class/etc. ids against a content database. This means flipping
// rulesetId, by itself, changes NOTHING about the character's current
// mechanics — no AC/passive-score/proficiency shift happens automatically,
// because nothing about a "now-incompatible" race/class silently strips
// its already-granted features (that would BE the "silently replace
// content" behavior item 3 explicitly forbids). `derivedChanges` below is
// kept in the preview shape for structural completeness and because
// CampaignRules could in principle vary the recompute, but it will be
// EMPTY for essentially every real switch — the switch's real effect is
// diagnostic (what will/won't resolve in FUTURE pickers and Issues), not
// retroactive. A player who wants the mechanical consequences applied
// (e.g. actually swapping out a now-incompatible race) does that via the
// existing live-edit tools (Remove Feature / Change Background, the
// earlier "live feature/background editing" track) — exactly the
// "Resolve incompatibilities" follow-up action the spec itself asks for
// (item 43), not something this switch does automatically.
import {
  Entity, ContentDB, HomebrewSubclass, Issue, IssueCode, RulesetId, CampaignRules,
  DERIVED_NUMERIC_KEYS, DerivedStats,
} from './types';
import { simulate } from './simulate';
import { validateEntity } from './validation';
import { getClassLevels } from './multiclass';
import { getSubclassEntryMerged } from '../content/subclasses/subclassBrowse';
import { resolveSpellById, resolveItemById } from '../content/contentResolution';
import { collectTypedContentRefs } from './packDiagnostics';
import { DERIVED_LABELS } from '../components/sheet/derivedStatLabels';
import { RULESETS, gameIdForRuleset, gameLabel } from '../content/rulesets';

export type RulesetChangeContentType =
  | 'race' | 'subrace' | 'class' | 'subclass' | 'background' | 'feat' | 'spell' | 'item' | 'condition';

export type RulesetChangeCategory = 'compatible' | 'incompatible' | 'unresolved';

export type RulesetChangeContentItem = {
  type:     RulesetChangeContentType;
  id:       string;
  name:     string;
  category: RulesetChangeCategory;
};

export type RulesetChangePendingChoice = { id: string; prompt: string };
export type RulesetChangeInvalidatedChoice = { id: string; prompt: string; reason: string };

export type RulesetChangePreview = {
  before: Entity;
  after:  Entity;
  /** True if targetRulesetId is the same as the character's current one —
   *  callers should treat this as a no-op (item 31: no meaningless mutation). */
  sameRuleset: boolean;
  targetRulesetId: RulesetId | undefined;
  /** LIVE-RULESET-2: true when the engine itself refuses to apply this
   *  switch — either `targetRulesetId` isn't a registered ruleset, or it
   *  belongs to a different, both-known Game than the character's current
   *  ruleset. When true, `after` is guaranteed identical to `before`
   *  (rulesetId included) — the engine never flips rulesetId for a
   *  blocked switch, regardless of what a caller does with the preview.
   *  This is authoritative and does not depend on the UI-level Game filter
   *  (RulesetChangeModal's picker) never offering a cross-game target —
   *  it also covers any other/future caller of simulateRulesetChange. */
  blocked: boolean;
  blockedReason?: string;
  /** Every content reference the character actually carries, categorized.
   *  Only non-'compatible' entries are usually worth showing in a UI, but
   *  the full list is returned so a caller can compute its own summary
   *  counts without re-walking the entity. */
  content: RulesetChangeContentItem[];
  /** Structured diagnostics on the POST-switch entity — reuses
   *  validateEntity()'s existing missing_race/missing_class/.../missing_item
   *  checks (which already read entity.rulesetId) plus two new checks this
   *  file adds for feat/condition (validateEntity doesn't check those
   *  today — see this file's own missing_feat/missing_condition codes). */
  issues: Issue[];
  /** Human-readable derived-stat changes, same shape/labels as the other
   *  preview modals (Feat/Equipment/LevelUp) — reuses DERIVED_LABELS so a
   *  changed stat renders identically everywhere in the app. */
  derivedChanges: { label: string }[];
  /** Pending (unresolved) choices already on the character — shown as-is;
   *  switching ruleset never fabricates NEW required choices (this engine
   *  has no per-ruleset progression data to generate them from — see file
   *  header), it only reports what's already pending. */
  pendingChoices: RulesetChangePendingChoice[];
  /** A RESOLVED choice whose own selection(s) no longer resolve under the
   *  target ruleset (e.g. a resolved feat/spell pick that's now
   *  unresolved/incompatible) — surfaced so the player can revisit it via
   *  the normal choice-resolution flow, never auto-resolved or duplicated. */
  invalidatedChoices: RulesetChangeInvalidatedChoice[];
};

/** `rulesetFilter === 'universal'` means "no filter, resolve against
 *  everything" (mirrors getMergedContentDB() with no argument); a real
 *  RulesetId or undefined means "resolve as if that were the active
 *  ruleset" (mirrors getMergedContentDB(thatValue)). Needed only for the
 *  'subclass' case below — every OTHER type's filtering already happened
 *  when the caller built `db` (getMergedContentDB(targetRulesetId) already
 *  excludes mismatched races/classes/backgrounds/conditions/feats).
 *  subclassEntriesForClassMerged now has real ruleset filtering of its own
 *  (LIVE-RULESET-3, item 4 — both official and homebrew subclasses), so this
 *  case just forwards the resolved filter straight through instead of
 *  re-deriving it from a raw HomebrewSubclass lookup. */
function resolveDependency(
  ref: { type: RulesetChangeContentType; id: string },
  db: ContentDB,
  homebrewSubclasses: HomebrewSubclass[],
  entity: Entity,
  rulesetFilter: RulesetId | undefined | 'universal',
): { name: string; rulesetId?: string } | undefined {
  switch (ref.type) {
    case 'race':
      return db.races.find(r => r.id === ref.id);
    case 'subrace':
      for (const r of db.races) {
        const sr = (r as unknown as { subraces?: { id: string; name: string; rulesetId?: string }[] }).subraces?.find(s => s.id === ref.id);
        if (sr) return sr;
      }
      return undefined;
    case 'class':
      return db.classes.find(c => c.id === ref.id);
    case 'subclass': {
      // Needs the owning classId, which the flat {type,id} ref doesn't
      // carry — recovered from the entity's own class levels (a character
      // only ever has one subclass per class slot).
      const cls = getClassLevels(entity).find(c => c.subclassId === ref.id);
      if (!cls) return undefined;
      const entry = getSubclassEntryMerged(cls.classId, ref.id, homebrewSubclasses, rulesetFilter === 'universal' ? undefined : rulesetFilter);
      if (!entry) return undefined;
      return { name: entry.name, rulesetId: entry.rulesetId };
    }
    case 'background':
      return db.backgrounds.find(b => b.id === ref.id);
    case 'feat':
      return (db.feats ?? []).find(f => f.id === ref.id);
    case 'condition':
      return db.conditions.find(c => c.id === ref.id);
    case 'spell': {
      // LIVE-RULESET-3 (item 5): resolveSpellById is now ruleset-aware —
      // reuses it exactly like every other case here, no separate spell-
      // specific resolution logic.
      const s = resolveSpellById(ref.id, db.spells, rulesetFilter === 'universal' ? undefined : rulesetFilter);
      return s ? { name: s.name, rulesetId: s.rulesetId } : undefined;
    }
    case 'item': {
      // LIVE-RULESET-3 (item 6): same as the spell case above.
      const it = resolveItemById(ref.id, db.items, rulesetFilter === 'universal' ? undefined : rulesetFilter);
      return it ? { name: it.name, rulesetId: it.rulesetId } : undefined;
    }
  }
}

/** Every content reference the character actually carries — extends
 *  packDiagnostics.ts's collectTypedContentRefs (race/subrace/class/
 *  subclass/background/spell/item) with feat picks (tracked only via a
 *  resolved choice's `selections: ['feat:<id>']` marker — see
 *  applyFeatToEntity, leveling.ts) and active conditions
 *  (conditionMonitor.active[].id) — the two content types validateEntity()
 *  doesn't check and collectTypedContentRefs doesn't collect. */
function collectAllContentRefs(entity: Entity): { type: RulesetChangeContentType; id: string }[] {
  const refs: { type: RulesetChangeContentType; id: string }[] = collectTypedContentRefs(entity)
    .filter((r): r is { type: RulesetChangeContentType; id: string } =>
      r.type === 'race' || r.type === 'subrace' || r.type === 'class' ||
      r.type === 'subclass' || r.type === 'background' || r.type === 'spell' || r.type === 'item');
  for (const choice of entity.choices) {
    if (!choice.resolved) continue;
    for (const sel of choice.selections) {
      if (sel.startsWith('feat:')) refs.push({ type: 'feat', id: sel.slice('feat:'.length) });
    }
  }
  for (const cond of entity.conditionMonitor.active) {
    refs.push({ type: 'condition', id: cond.id });
  }
  return refs;
}

const CONDITION_ISSUE_CODE: Record<'feat' | 'condition', IssueCode> = {
  feat: 'missing_feat',
  condition: 'missing_condition',
};

/**
 * Builds the full preview for changing `entity`'s rulesetId to
 * `targetRulesetId`, without mutating anything. `universalDB` is the
 * caller's `getMergedContentDB()` (no ruleset filter — "everything");
 * `targetDB` is `getMergedContentDB(targetRulesetId)` (filtered to the
 * target). Both are cheap to obtain (the store's own single-entry cache)
 * and passed in rather than computed here, so this stays a pure function
 * with no store dependency (this file's engine layer never imports
 * store/, per the established convention).
 */
export function simulateRulesetChange(
  entity:             Entity,
  targetRulesetId:    RulesetId | undefined,
  universalDB:        ContentDB,
  targetDB:           ContentDB,
  homebrewSubclasses: HomebrewSubclass[],
  rules:              CampaignRules,
): RulesetChangePreview {
  const sameRuleset = entity.rulesetId === targetRulesetId;

  // ── Engine-level guard (LIVE-RULESET-2, item 3/5) ────────────────────
  // Authoritative — does not rely on the UI-level Game filter never
  // offering a cross-game/unregistered target. Checked BEFORE the mutator
  // runs, so a blocked switch never flips rulesetId at all.
  const targetRegistered = targetRulesetId === undefined || RULESETS[targetRulesetId] !== undefined;
  const currentGameId = gameIdForRuleset(entity.rulesetId);
  const targetGameId  = gameIdForRuleset(targetRulesetId);
  // Same-game targets are never blocked regardless of how deeply this
  // app's engine actually implements that ruleset's mechanics (item 4) —
  // only registration and Game identity are checked here.
  const crossGame = currentGameId !== undefined && targetGameId !== undefined && currentGameId !== targetGameId;

  let blocked = false;
  let blockedReason: string | undefined;
  if (!targetRegistered) {
    blocked = true;
    blockedReason = `"${targetRulesetId}" isn't a registered ruleset.`;
  } else if (crossGame) {
    blocked = true;
    blockedReason = `Cannot switch between different Games (${gameLabel(currentGameId) ?? currentGameId} → ${gameLabel(targetGameId) ?? targetGameId}).`;
  }

  if (blocked) {
    // Identity mutator — before/after are the same recompute, rulesetId
    // untouched. Content/derived/choice diffing is skipped entirely: there
    // is nothing to preview for a switch the engine refuses to make.
    const stable = simulate(entity, e => e, rules);
    const code: IssueCode = targetRegistered ? 'cross_game_ruleset' : 'unsupported_ruleset';
    const issues: Issue[] = [{
      severity: 'error',
      code,
      message: blockedReason!,
      affectedId: targetRulesetId ?? '(untagged)',
    }];
    return {
      before: stable.before, after: stable.after, sameRuleset, targetRulesetId,
      blocked, blockedReason,
      content: [], issues, derivedChanges: [],
      pendingChoices: stable.after.choices.filter(c => !c.resolved).map(c => ({ id: c.id, prompt: c.definition.prompt })),
      invalidatedChoices: [],
    };
  }

  const { before, after } = simulate(entity, e => ({ ...e, rulesetId: targetRulesetId }), rules);

  // ── Content compatibility ────────────────────────────────────────────
  const refs = collectAllContentRefs(after);
  const content: RulesetChangeContentItem[] = refs.map(ref => {
    const inTarget = resolveDependency(ref, targetDB, homebrewSubclasses, after, targetRulesetId);
    if (inTarget) {
      return { type: ref.type, id: ref.id, name: inTarget.name, category: 'compatible' as const };
    }
    const inUniversal = resolveDependency(ref, universalDB, homebrewSubclasses, after, 'universal');
    if (inUniversal) {
      // Exists somewhere, just not under this ruleset's filter — a REAL
      // definition tagged for a different ruleset, not deleted content.
      return { type: ref.type, id: ref.id, name: inUniversal.name, category: 'incompatible' as const };
    }
    // Doesn't exist under any resolution context — genuinely missing
    // (deleted homebrew, uninstalled pack) rather than a ruleset artifact.
    return { type: ref.type, id: ref.id, name: ref.id, category: 'unresolved' as const };
  });

  // ── Structured diagnostics ───────────────────────────────────────────
  // validateEntity already reads entity.rulesetId and checks race/subrace/
  // class/subclass/background/spell/item against targetDB — reused as-is
  // (this is the "do not create a separate duplicate rules engine" rule
  // applied literally: the checking logic already exists).
  const issues: Issue[] = [...validateEntity(after, targetDB, homebrewSubclasses)];
  for (const item of content) {
    if (item.category === 'compatible') continue;
    if (item.type !== 'feat' && item.type !== 'condition') continue; // everything else already covered by validateEntity above
    issues.push({
      severity: item.category === 'unresolved' ? 'warning' : 'info',
      code: CONDITION_ISSUE_CODE[item.type],
      message: item.category === 'unresolved'
        ? `${item.type === 'feat' ? 'Feat' : 'Condition'} "${item.name}" isn't in the current content library.`
        : `${item.type === 'feat' ? 'Feat' : 'Condition'} "${item.name}" belongs to a different ruleset than this character.`,
      affectedId: item.id,
    });
  }

  // ── Derived-stat changes ─────────────────────────────────────────────
  const derivedChanges: { label: string }[] = [];
  for (const key of DERIVED_NUMERIC_KEYS) {
    const k = key as keyof DerivedStats;
    const label = DERIVED_LABELS[k];
    if (!label) continue;
    const b = before.derived[k], a = after.derived[k];
    if (b !== a) derivedChanges.push({ label: `${label}: ${b ?? '—'} → ${a ?? '—'}` });
  }

  // ── Pending / invalidated choices ────────────────────────────────────
  const pendingChoices: RulesetChangePendingChoice[] = after.choices
    .filter(c => !c.resolved)
    .map(c => ({ id: c.id, prompt: c.definition.prompt }));

  const incompatibleOrUnresolvedIds = new Set(
    content.filter(c => c.category !== 'compatible').map(c => c.id),
  );
  const invalidatedChoices: RulesetChangeInvalidatedChoice[] = [];
  for (const choice of after.choices) {
    if (!choice.resolved) continue;
    const brokenSelection = choice.selections.find(sel => {
      const bare = sel.startsWith('feat:') ? sel.slice('feat:'.length) : sel;
      return incompatibleOrUnresolvedIds.has(bare);
    });
    if (brokenSelection) {
      invalidatedChoices.push({
        id: choice.id, prompt: choice.definition.prompt,
        reason: 'One of this choice\'s selections is no longer compatible with the target ruleset.',
      });
    }
  }

  return {
    before, after, sameRuleset, targetRulesetId, blocked: false,
    content, issues, derivedChanges, pendingChoices, invalidatedChoices,
  };
}

/** Whether a computed preview is safe to actually confirm/apply — false
 *  for a same-ruleset no-op (item 31) OR an engine-blocked switch (item
 *  3/5, LIVE-RULESET-2). Shared by RulesetChangeModal's Confirm-disabled
 *  state and its confirm handler so the two can never disagree, and
 *  reusable by any future non-UI caller that needs the same guard. */
export function canApplyRulesetChange(preview: RulesetChangePreview): boolean {
  return !preview.sameRuleset && !preview.blocked;
}
