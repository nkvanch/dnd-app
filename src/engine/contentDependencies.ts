// src/engine/contentDependencies.ts
// HOMEBREW-PACKAGE-1: walks a STATIC homebrew content definition's own
// fields for references to OTHER content (a Subrace's parent Race, a
// Subclass's parent Class, a Feature's granted spells, a class's starting
// equipment, …) and builds the transitive dependency closure for a set of
// selected export items.
//
// This is a genuinely new capability — packDiagnostics.ts's own
// collectTypedContentRefs() only walks a live Entity (a character), never a
// content DEFINITION itself (confirmed by reading every existing
// dependency-adjacent file before writing this: no prior code recursively
// scans a Race/CharClass/HomebrewSubclass's own Feature/Effect/Grant tree).
// Deliberately NOT a generic "reflect over every field looking for an id-
// shaped string" walker — that would be exactly the kind of implicit,
// unpredictable scripting-DSL behavior this codebase's content model
// otherwise avoids everywhere else (see engine/types.ts's own Brand<>
// commentary on why polymorphic id fields stay explicit, not inferred).
// Instead this walks the SPECIFIC, named cross-content reference fields
// confirmed to exist in engine/types.ts: Subrace.parentId,
// HomebrewSubclass.classId, CharClass.startingEquipment, Effect's
// grant_spell cantripIds/spellIds, Grant's known_spells value, and
// AbilityEffect's cast_spell/apply_condition/remove_condition ids.
//
// Scope boundary, disclosed rather than silently incomplete: ChoiceDefinition
// pools (e.g. a class's own "choose a cantrip" pool, or an equipment
// choice's fixed-item pool) are NOT walked — a choice pool's contents are
// nearly always either an official-content id (already available on every
// device, nothing to bundle) or a `pool:'all'` sentinel (no concrete ids at
// all), and treating every optional pick as a "required" dependency would
// bloat packages with content the recipient may never actually need. This
// matches the spec's own allowance for "required vs optional" — pool
// references are treated as optional/unbundled, not required.
import { Feature, Effect, Grant, KnownSpellsGrant, Subrace, HomebrewSubclass, CharClass, DraftTrait } from './types';
import { ContentCacheType, HomebrewContent } from '../db/contentCacheRepo';

export type DependencyRef = { type: ContentCacheType; id: string };

/** Every Feature[] field on any homebrew content type — races/subraces/
 *  backgrounds/items/monsters/conditions all carry `features: Feature[]`
 *  directly; classes/subclasses carry them nested inside per-level grants
 *  (walked separately below); feats carry a single embedded `feature`. */
function walkFeatures(features: Feature[] | undefined): DependencyRef[] {
  const refs: DependencyRef[] = [];
  for (const f of features ?? []) {
    for (const effect of f.effects ?? []) {
      if (effect.type === 'grant_spell') {
        for (const id of (effect as Effect & { spellIds?: string[] }).spellIds ?? []) refs.push({ type: 'spell', id });
        for (const id of (effect as Effect & { cantripIds?: string[] }).cantripIds ?? []) refs.push({ type: 'spell', id });
      }
    }
    for (const ae of f.abilityEffects ?? []) {
      if (ae.type === 'cast_spell') refs.push({ type: 'spell', id: ae.spellId });
      if (ae.type === 'apply_condition' || ae.type === 'remove_condition') refs.push({ type: 'condition', id: ae.conditionId });
    }
  }
  return refs;
}

function walkGrant(grant: Grant): DependencyRef[] {
  const refs: DependencyRef[] = [];
  if (grant.kind === 'known_spells') {
    const v = grant.value as KnownSpellsGrant;
    for (const id of v.spellIds ?? []) refs.push({ type: 'spell', id });
    for (const id of v.cantripIds ?? []) refs.push({ type: 'spell', id });
  }
  if (grant.kind === 'starting_item' && typeof grant.value === 'string') {
    refs.push({ type: 'item', id: grant.value });
  }
  if (grant.kind === 'feature' && grant.value && typeof grant.value === 'object') {
    refs.push(...walkFeatures([grant.value as Feature]));
  }
  return refs;
}

/** Direct (one-hop) dependencies for one content item — not recursive
 *  itself; buildDependencyClosure below handles the transitive walk. */
export function collectContentDependencies(type: ContentCacheType, item: HomebrewContent): DependencyRef[] {
  const refs: DependencyRef[] = [];

  switch (type) {
    case 'race':
    case 'background':
    case 'item':
    case 'monster':
    case 'condition':
      refs.push(...walkFeatures((item as { features?: Feature[] }).features));
      break;
    case 'subrace': {
      const sr = item as Subrace;
      if (sr.parentId) refs.push({ type: 'race', id: sr.parentId });
      refs.push(...walkFeatures(sr.features));
      break;
    }
    case 'feat': {
      const feat = item as unknown as { feature?: Feature };
      if (feat.feature) refs.push(...walkFeatures([feat.feature]));
      break;
    }
    case 'feature':
      refs.push(...walkFeatures([item as unknown as Feature]));
      break;
    case 'class': {
      const cls = item as CharClass;
      for (const id of cls.startingEquipment ?? []) refs.push({ type: 'item', id });
      // The class-builder's own authoring format (levelFeatures: DraftTrait[])
      // is what a homebrew class actually saves — NOT a real
      // ClassProgression.entries[] (that only exists on rawProgression, the
      // escape hatch the builder itself never produces — see CharClass's
      // own doc comment). A DraftTrait's spell_grant effectKind is the one
      // shape that references other content (a cantrip id + any number of
      // leveled spell ids).
      for (const trait of (cls.levelFeatures ?? []) as (DraftTrait & { level: number })[]) {
        if (trait.effectKind === 'spell_grant') {
          if (trait.spellGrantCantripId) refs.push({ type: 'spell', id: trait.spellGrantCantripId });
          for (const g of trait.spellGrants ?? []) refs.push({ type: 'spell', id: g.spellId });
        }
      }
      // rawProgression is a real ClassProgression (entries: LevelEntry[]) —
      // only ever set by seeded built-in homebrew or a future import
      // pipeline, never by the class-builder UI itself, but walked here too
      // so re-exporting such a class stays dependency-complete.
      for (const entry of cls.rawProgression?.entries ?? []) {
        for (const grant of entry.grants ?? []) refs.push(...walkGrant(grant));
      }
      break;
    }
    case 'subclass': {
      const sc = item as HomebrewSubclass;
      if (sc.classId) refs.push({ type: 'class', id: sc.classId });
      for (const entry of sc.entries ?? []) {
        for (const grant of entry.grants ?? []) refs.push(...walkGrant(grant));
      }
      break;
    }
    case 'spell':
      // Spells carry no cross-content reference fields of their own.
      break;
  }

  // Dedupe and drop self-references (a content item's own embedded
  // Feature.source.refId always points back at itself — not a real edge).
  const seen = new Set<string>();
  return refs.filter(r => {
    if (r.id === item.id) return false;
    const key = `${r.type}:${r.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type ResolvedContentRef = DependencyRef & { name: string; rulesetId?: string };

export type DependencyClosureResult = {
  /** Every ref actually reachable from the selection — includes the
   *  selection itself (tagged 'selected') plus every dependency pulled in
   *  transitively (tagged 'dependency'). Deduplicated, cycle-safe. */
  closure:    (ResolvedContentRef & { included: 'selected' | 'dependency' })[];
  /** Dependencies referenced by something in the closure but not found by
   *  `lookup` — neither locally authored nor (as far as this function can
   *  tell) already available. Reported, never silently dropped. */
  unresolved: DependencyRef[];
};

/**
 * BFS over the selected items' dependency graph. `lookup` resolves a
 * {type,id} ref to the actual local content item (or undefined if not
 * found) — callers supply this from whatever homebrew source they have in
 * scope (the Zustand store in the app, a plain array in tests) rather than
 * this function importing the store directly (keeps it a pure, easily
 * testable function with no store/platform dependency).
 */
export function buildDependencyClosure(
  selected: DependencyRef[],
  lookup:   (ref: DependencyRef) => (HomebrewContent & { rulesetId?: string }) | undefined,
): DependencyClosureResult {
  const closureMap = new Map<string, ResolvedContentRef & { included: 'selected' | 'dependency' }>();
  const unresolved: DependencyRef[] = [];
  const unresolvedSeen = new Set<string>();
  const queue: { ref: DependencyRef; included: 'selected' | 'dependency' }[] =
    selected.map(ref => ({ ref, included: 'selected' as const }));

  while (queue.length > 0) {
    const { ref, included } = queue.shift()!;
    const key = `${ref.type}:${ref.id}`;
    const existing = closureMap.get(key);
    if (existing) {
      // A selected item reached via someone else's dependency edge is still
      // "selected" — the user's own explicit picks always win that label.
      if (included === 'selected') existing.included = 'selected';
      continue;
    }
    const found = lookup(ref);
    if (!found) {
      if (!unresolvedSeen.has(key)) { unresolvedSeen.add(key); unresolved.push(ref); }
      continue;
    }
    closureMap.set(key, { type: ref.type, id: ref.id, name: found.name, rulesetId: found.rulesetId, included });
    for (const dep of collectContentDependencies(ref.type, found)) {
      queue.push({ ref: dep, included: 'dependency' });
    }
  }

  return { closure: Array.from(closureMap.values()), unresolved };
}
