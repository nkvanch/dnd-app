// src/engine/packageConflicts.ts
// HOMEBREW-PACKAGE-1: conflict detection + resolution planning for a
// package import. Three resolutions per conflicting {type,id}, matching
// every other "don't silently overwrite" pattern already established in
// this codebase (e.g. app/backup.tsx's existing idCollisions warning, which
// this supersedes for the new package-import flow with an actual per-item
// choice instead of a blanket warning):
//   'keep_local' — the incoming item is dropped entirely; anything in the
//                  SAME package that referenced it must resolve to the
//                  existing local id (already true automatically, since
//                  the id is unchanged either way).
//   'replace'    — the incoming item overwrites local content AT THE SAME
//                  id — existing characters/homebrew referencing that id
//                  keep resolving correctly, no rewrite needed.
//   'copy'       — the incoming item is imported under a NEW id, and every
//                  other item in the SAME import that referenced the old
//                  id must be rewritten to point at the new one (see
//                  rewriteContentReferences below) — otherwise the copy
//                  would leave internally-broken references, exactly the
//                  "Class A must reference F2, not old F" failure mode the
//                  spec calls out.
import {
  Feature, Effect, Grant, KnownSpellsGrant, Subrace, HomebrewSubclass, CharClass, DraftTrait, Issue,
} from './types';
import { ContentCacheType, HomebrewContent } from '../db/contentCacheRepo';
import { GrimoirePack, GrimoirePackHomebrew } from './backup';
import { deepDiff } from '../sync/diff';

export type ConflictResolution = 'keep_local' | 'replace' | 'copy';

export type PackageConflict = {
  type:          ContentCacheType;
  id:            string;
  localName:     string;
  incomingName:  string;
};

const HOMEBREW_CATEGORIES: { key: keyof GrimoirePackHomebrew; type: ContentCacheType }[] = [
  { key: 'races',       type: 'race' },
  { key: 'subraces',    type: 'subrace' },
  { key: 'classes',     type: 'class' },
  { key: 'subclasses',  type: 'subclass' },
  { key: 'spells',      type: 'spell' },
  { key: 'backgrounds', type: 'background' },
  { key: 'features',    type: 'feature' },
  { key: 'items',       type: 'item' },
  { key: 'feats',       type: 'feat' },
  { key: 'monsters',    type: 'monster' },
  { key: 'conditions',  type: 'condition' },
];

/** Every {type, id, item} triple actually present in a package's homebrew payload. */
export function flattenPackageContents(homebrew: GrimoirePackHomebrew | undefined): { type: ContentCacheType; item: HomebrewContent }[] {
  const out: { type: ContentCacheType; item: HomebrewContent }[] = [];
  if (!homebrew) return out;
  for (const { key, type } of HOMEBREW_CATEGORIES) {
    for (const item of (homebrew[key] as HomebrewContent[] | undefined) ?? []) out.push({ type, item });
  }
  return out;
}

/** Duplicate {type,id} pairs WITHIN the package itself — a structurally
 *  invalid package (two definitions claiming the same identity), reported
 *  as an Issue rather than silently letting the second one win. */
export function findDuplicateIdsInPackage(homebrew: GrimoirePackHomebrew | undefined): Issue[] {
  const seen = new Set<string>();
  const issues: Issue[] = [];
  for (const { type, item } of flattenPackageContents(homebrew)) {
    const key = `${type}:${item.id}`;
    if (seen.has(key)) {
      issues.push({
        severity: 'error', code: 'package_duplicate_id',
        message: `This package contains more than one "${type}" definition with id "${item.id}".`,
        affectedId: item.id,
      });
    }
    seen.add(key);
  }
  return issues;
}

/** `localLookup` resolves {type,id} to the local item's name if one exists
 *  with that exact id — supplied by the caller (the Zustand store in the
 *  app, a plain map in tests), same "pure function, caller supplies data"
 *  shape as buildDependencyClosure. */
export function detectConflicts(
  homebrew:    GrimoirePackHomebrew | undefined,
  localLookup: (type: ContentCacheType, id: string) => string | undefined,
): PackageConflict[] {
  const conflicts: PackageConflict[] = [];
  for (const { type, item } of flattenPackageContents(homebrew)) {
    const localName = localLookup(type, item.id);
    if (localName !== undefined) {
      conflicts.push({ type, id: item.id, localName, incomingName: item.name });
    }
  }
  return conflicts;
}

/** Two content items with the same {type,id} are "identical" if nothing
 *  about their authored content actually differs — reuses deepDiff (sync/
 *  diff.ts) rather than a second bespoke deep-equality check; `deepDiff`
 *  returning `undefined` already means "no difference at any depth." */
export function isContentIdentical(local: HomebrewContent, incoming: HomebrewContent): boolean {
  return deepDiff(local, incoming) === undefined;
}

/**
 * The full-item-aware sibling of detectConflicts, additive and independent
 * of it (detectConflicts itself is left untouched — its return shape is
 * relied on by existing tests/consumers unrelated to this split). Same
 * {type,id}-match detection, but a match whose content is byte-for-byte
 * identical is reported separately as `identical` rather than `conflicts`
 * — HOMEBREW-PACKAGE-1 item 17: re-importing a package you already have
 * installed shouldn't force a noisy per-item Keep/Replace/Copy decision on
 * content that's already exactly what you have. `localLookup` here
 * resolves to the FULL local item (not just its name) since a real
 * equality check needs the whole object, not just its display name.
 */
export function detectConflictsDetailed(
  homebrew:    GrimoirePackHomebrew | undefined,
  localLookup: (type: ContentCacheType, id: string) => HomebrewContent | undefined,
): { conflicts: PackageConflict[]; identical: PackageConflict[] } {
  const conflicts: PackageConflict[] = [];
  const identical: PackageConflict[] = [];
  for (const { type, item } of flattenPackageContents(homebrew)) {
    const local = localLookup(type, item.id);
    if (local === undefined) continue;
    const entry: PackageConflict = { type, id: item.id, localName: local.name, incomingName: item.name };
    if (isContentIdentical(local, item)) identical.push(entry);
    else conflicts.push(entry);
  }
  return { conflicts, identical };
}

// ── Reference rewriting (mirrors contentDependencies.ts's field walk, but
//    MUTATES instead of collecting) ─────────────────────────────────────

function remapId(remap: Map<string, string>, type: ContentCacheType, id: string): string {
  return remap.get(`${type}:${id}`) ?? id;
}

function rewriteFeatures(features: Feature[] | undefined, remap: Map<string, string>): Feature[] | undefined {
  if (!features) return features;
  return features.map(f => ({
    ...f,
    effects: (f.effects ?? []).map(effect => {
      if (effect.type !== 'grant_spell') return effect;
      const e = effect as Effect & { spellIds?: string[]; cantripIds?: string[] };
      return {
        ...e,
        spellIds:   e.spellIds?.map(id => remapId(remap, 'spell', id)),
        cantripIds: e.cantripIds?.map(id => remapId(remap, 'spell', id)),
      };
    }),
    abilityEffects: (f.abilityEffects ?? []).map(ae => {
      if (ae.type === 'cast_spell') return { ...ae, spellId: remapId(remap, 'spell', ae.spellId) };
      if (ae.type === 'apply_condition' || ae.type === 'remove_condition') return { ...ae, conditionId: remapId(remap, 'condition', ae.conditionId) };
      return ae;
    }),
  }));
}

function rewriteGrant(grant: Grant, remap: Map<string, string>): Grant {
  if (grant.kind === 'known_spells') {
    const v = grant.value as KnownSpellsGrant;
    return { ...grant, value: { spellIds: v.spellIds?.map(id => remapId(remap, 'spell', id)), cantripIds: v.cantripIds?.map(id => remapId(remap, 'spell', id)) } };
  }
  if (grant.kind === 'starting_item' && typeof grant.value === 'string') {
    return { ...grant, value: remapId(remap, 'item', grant.value) };
  }
  if (grant.kind === 'feature' && grant.value && typeof grant.value === 'object') {
    const [rewritten] = rewriteFeatures([grant.value as Feature], remap)!;
    return { ...grant, value: rewritten };
  }
  return grant;
}

/**
 * Rewrites every cross-content reference field this file/contentDependencies.ts
 * knows how to walk, using `remap` (old "type:id" -> new id). Does NOT
 * rewrite the item's OWN id — the caller does that separately (see
 * planPackageImport below), since not every rewritten item is itself being
 * copied (an item can reference a copy without being one itself).
 */
export function rewriteContentReferences(type: ContentCacheType, item: HomebrewContent, remap: Map<string, string>): HomebrewContent {
  if (remap.size === 0) return item;
  switch (type) {
    case 'race':
    case 'background':
    case 'item':
    case 'monster':
    case 'condition': {
      const withFeatures = item as unknown as { features?: Feature[] };
      return { ...item, features: rewriteFeatures(withFeatures.features, remap) } as HomebrewContent;
    }
    case 'subrace': {
      const sr = item as Subrace;
      return {
        ...sr,
        parentId: remapId(remap, 'race', sr.parentId),
        features: rewriteFeatures(sr.features, remap),
      } as HomebrewContent;
    }
    case 'feat': {
      const feat = item as unknown as { feature?: Feature };
      if (!feat.feature) return item;
      const [rewritten] = rewriteFeatures([feat.feature], remap)!;
      return { ...item, feature: rewritten } as HomebrewContent;
    }
    case 'feature':
      return (rewriteFeatures([item as unknown as Feature], remap)!)[0] as unknown as HomebrewContent;
    case 'class': {
      const cls = item as CharClass;
      return {
        ...cls,
        startingEquipment: cls.startingEquipment?.map(id => remapId(remap, 'item', id)),
        levelFeatures: (cls.levelFeatures as (DraftTrait & { level: number })[] | undefined)?.map(trait => {
          if (trait.effectKind !== 'spell_grant') return trait;
          return {
            ...trait,
            spellGrantCantripId: trait.spellGrantCantripId ? remapId(remap, 'spell', trait.spellGrantCantripId) : trait.spellGrantCantripId,
            spellGrants: trait.spellGrants?.map(g => ({ ...g, spellId: remapId(remap, 'spell', g.spellId) })),
          };
        }),
        rawProgression: cls.rawProgression ? {
          ...cls.rawProgression,
          entries: cls.rawProgression.entries.map(entry => ({ ...entry, grants: entry.grants.map(g => rewriteGrant(g, remap)) })),
        } : cls.rawProgression,
      } as HomebrewContent;
    }
    case 'subclass': {
      const sc = item as HomebrewSubclass;
      return {
        ...sc,
        classId: remapId(remap, 'class', sc.classId),
        entries: sc.entries.map(entry => ({ ...entry, grants: entry.grants.map(g => rewriteGrant(g, remap)) })),
      } as HomebrewContent;
    }
    case 'spell':
      return item;
  }
}

export type PackageImportPlanEntry = {
  type:       ContentCacheType;
  originalId: string;
  /** The id to actually save under — equal to originalId unless this entry's
   *  conflict was resolved as 'copy'. */
  finalId:    string;
  item:       HomebrewContent;
  resolution: ConflictResolution | 'no_conflict' | 'identical';
};

/**
 * Builds the full, ready-to-apply import plan: generates new ids for every
 * 'copy' resolution FIRST (so the remap is complete before anything gets
 * rewritten — an item referencing another copied item must see the OTHER
 * item's new id too, not just its own), then rewrites every surviving
 * item's cross-content references and drops anything resolved as
 * 'keep_local' from the save list entirely. Pure — no I/O, no store access
 * — the caller applies `toSave` via whatever persistence layer it has.
 *
 * `identical` (item 17, optional/additive — defaults to none, so every
 * existing caller keeps compiling and behaving unchanged) — entries already
 * known to be byte-for-byte identical to local content (via
 * detectConflictsDetailed) are skipped unconditionally, the same as an
 * explicit 'keep_local' choice, WITHOUT needing an entry in `resolutions` —
 * there's nothing to decide, importing an exact duplicate is always a no-op.
 */
export function planPackageImport(
  pack:        GrimoirePack,
  conflicts:   PackageConflict[],
  resolutions: Map<string, ConflictResolution>, // keyed "type:id"
  identical:   PackageConflict[] = [],
): { toSave: PackageImportPlanEntry[]; skipped: PackageImportPlanEntry[] } {
  const conflictKeys = new Set(conflicts.map(c => `${c.type}:${c.id}`));
  const identicalKeys = new Set(identical.map(c => `${c.type}:${c.id}`));
  const remap = new Map<string, string>();

  // Pass 1: assign new ids for every 'copy' resolution.
  for (const conflict of conflicts) {
    const key = `${conflict.type}:${conflict.id}`;
    if (resolutions.get(key) === 'copy') {
      const newId = `${conflict.id}_copy_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      remap.set(key, newId);
    }
  }

  // Pass 2: build the plan, rewriting references and applying id remaps.
  const toSave: PackageImportPlanEntry[] = [];
  const skipped: PackageImportPlanEntry[] = [];
  for (const { type, item } of flattenPackageContents(pack.homebrew)) {
    const key = `${type}:${item.id}`;

    if (identicalKeys.has(key)) {
      skipped.push({ type, originalId: item.id, finalId: item.id, item, resolution: 'identical' });
      continue;
    }

    const isConflict = conflictKeys.has(key);
    const resolution: ConflictResolution | 'no_conflict' = isConflict ? (resolutions.get(key) ?? 'keep_local') : 'no_conflict';

    if (resolution === 'keep_local') {
      skipped.push({ type, originalId: item.id, finalId: item.id, item, resolution });
      continue;
    }

    const rewritten = rewriteContentReferences(type, item, remap);
    const finalId = remap.get(key) ?? item.id;
    // Branded id types (SubclassId etc.) make a fully generic `{ ...x, id }`
    // assignment fail to typecheck across the whole HomebrewContent union —
    // this cast is the same escape hatch asSubclassId()/asClassId() already
    // exist for elsewhere in this codebase, applied once here instead of
    // per-type, since finalId is always a freshly-generated, already-unique
    // string regardless of which branded id type the target expects.
    const finalItem = finalId !== item.id
      ? ({ ...rewritten, id: finalId } as unknown as HomebrewContent)
      : rewritten;
    toSave.push({ type, originalId: item.id, finalId, item: finalItem, resolution });
  }

  return { toSave, skipped };
}
