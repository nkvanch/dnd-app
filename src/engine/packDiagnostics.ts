// src/engine/packDiagnostics.ts
// A-62: pack-level diagnostics, built on top of A-54's Issue[] shape and
// collectEntityContentIds(). Per the reviewer's own note, this should
// really be "A-54 → A-62," not a parallel validation system — this file
// is exactly that: it reuses the same Issue type and the same "detect,
// disclose, never silently repair" rule, just aimed at an InstalledPack
// instead of a single Entity.
//
// Deliberately NOT attempted (see docs/STATUS.md §5 for the fuller
// reasoning already recorded there): "missing dependency" and
// "incompatible version" — InstalledPack (src/db/packRegistryRepo.ts) has
// no dependency or per-pack content-version field at all, so there's
// nothing to check either signal against. Both stay real, disclosed gaps
// until the registry schema grows those fields.
//
// What IS checkable with what the registry already tracks:
//  - broken reference:      an itemRef the pack installed no longer exists
//                            in the homebrew store (deleted individually).
//  - content shadowed:      two installed packs both claim the same
//                            {type, id} — homebrew content is stored one
//                            row per (type, id), so only the most recently
//                            imported pack's version is actually live; the
//                            other pack's own itemRef silently points at
//                            content it no longer controls.
//  - ruleset mixed:         a weak but real internal-consistency signal —
//                            a pack whose own content disagrees with itself
//                            about which ruleset it's for.
//  - content still in use:  the one that actually matters before someone
//                            taps "Remove Pack" — which saved characters
//                            reference this pack's content right now.
import { Entity, Issue } from './types';
import { InstalledPack, PackItemRef } from '../db/packRegistryRepo';
import { ContentCacheType } from '../db/contentCacheRepo';
import { getClassLevels } from './multiclass';
import { spellIdsOnEntity } from '../content/spellRepo.types';

/** Just the id (and optional rulesetId) shape diagnosePack needs from each
 *  homebrew content array — a structural subset of HomebrewStoreState's
 *  fields, so this file doesn't need to import the store (engine/ stays
 *  below store/ in the dependency order). */
export type HomebrewContentSlice = {
  races:       { id: string; rulesetId?: string }[];
  subraces:    { id: string; rulesetId?: string }[];
  classes:     { id: string; rulesetId?: string }[];
  subclasses:  { id: string; rulesetId?: string }[];
  spells:      { id: string; rulesetId?: string }[];
  backgrounds: { id: string; rulesetId?: string }[];
  features:    { id: string; rulesetId?: string }[];
  items:       { id: string; rulesetId?: string }[];
  feats:       { id: string; rulesetId?: string }[];
  monsters:    { id: string; rulesetId?: string }[];
  conditions:  { id: string; rulesetId?: string }[];
};

const CONTENT_TYPE_TO_STORE_KEY: Record<ContentCacheType, keyof HomebrewContentSlice> = {
  race: 'races', subrace: 'subraces', class: 'classes', subclass: 'subclasses',
  spell: 'spells', background: 'backgrounds', feature: 'features', item: 'items',
  feat: 'feats', monster: 'monsters', condition: 'conditions',
};

function resolveRef(ref: PackItemRef, homebrew: HomebrewContentSlice) {
  return homebrew[CONTENT_TYPE_TO_STORE_KEY[ref.type]].find(i => i.id === ref.id);
}

/**
 * Type-tagged version of validation.ts's collectEntityContentIds, scoped to
 * this file rather than added there — engine/validation.ts has no
 * dependency on ContentCacheType (db/) and shouldn't gain one just for this
 * one check (engine stays below db in the dependency order — see this
 * file's header comment). Mirrors that function's exact field walk, one
 * {type, id} ref per typed content reference on the entity.
 *
 * Choice selections (ASI/skill/spell/feat picks stored on entity.choices)
 * are deliberately NOT included here — ChoiceState.selections carries no
 * reliable content-type tag of its own (see types.ts's note that this
 * field is genuinely polymorphic per its sibling choice-kind). They're
 * matched separately below, untyped, against every pack id — the same
 * conservative (possibly over-broad, but never silently wrong-type)
 * behavior this whole check had for every reference before this fix.
 */
function collectTypedContentRefs(entity: Entity): { type: ContentCacheType; id: string }[] {
  if (entity.kind !== 'character') return [];
  const { identity, spellcasting, inventory } = entity;
  const refs: { type: ContentCacheType; id: string }[] = [];
  if (identity.raceId) refs.push({ type: 'race', id: identity.raceId });
  if (identity.subRaceId) refs.push({ type: 'subrace', id: identity.subRaceId });
  for (const cls of getClassLevels(entity)) {
    refs.push({ type: 'class', id: cls.classId });
    if (cls.subclassId) refs.push({ type: 'subclass', id: cls.subclassId });
  }
  if (identity.backgroundId) refs.push({ type: 'background', id: identity.backgroundId });
  if (spellcasting) for (const spellId of spellIdsOnEntity(entity)) refs.push({ type: 'spell', id: spellId });
  for (const item of inventory.carried)  refs.push({ type: 'item', id: item.itemId });
  for (const item of inventory.equipped) refs.push({ type: 'item', id: item.itemId });
  return refs;
}

export function diagnosePack(
  pack: InstalledPack,
  allPacks: InstalledPack[],
  homebrew: HomebrewContentSlice,
  characters: Entity[],
): Issue[] {
  const issues: Issue[] = [];

  // ── Broken references ──────────────────────────────────────────────────
  for (const ref of pack.itemRefs) {
    if (!resolveRef(ref, homebrew)) {
      issues.push({
        severity: 'warning', code: 'pack_broken_reference',
        message: `"${ref.id}" (${ref.type}) was installed by this pack but no longer exists — it was likely deleted individually from the Library.`,
        affectedId: ref.id, source: `pack:${pack.id}`,
        suggestedFix: 'No action needed if that was intentional; reinstall the pack to restore it otherwise.',
      });
    }
  }

  // ── Shadowed by another installed pack ──────────────────────────────────
  for (const ref of pack.itemRefs) {
    const collidingPacks = allPacks.filter(p =>
      p.id !== pack.id && p.itemRefs.some(r => r.type === ref.type && r.id === ref.id));
    if (collidingPacks.length > 0) {
      issues.push({
        severity: 'warning', code: 'pack_content_shadowed',
        message: `"${ref.id}" (${ref.type}) is also claimed by ${collidingPacks.map(p => `"${p.name}"`).join(', ')} — only whichever pack was imported most recently actually owns the installed content.`,
        affectedId: ref.id, source: `pack:${pack.id}`,
        suggestedFix: 'Reinstall the pack whose version you want to keep last, so it wins.',
      });
    }
  }

  // ── Mixed rulesets within one pack ───────────────────────────────────────
  const rulesetIds = new Set<string>();
  for (const ref of pack.itemRefs) {
    const item = resolveRef(ref, homebrew);
    if (item?.rulesetId) rulesetIds.add(item.rulesetId);
  }
  if (rulesetIds.size > 1) {
    issues.push({
      severity: 'info', code: 'pack_ruleset_mixed',
      message: `This pack's content is tagged for more than one ruleset (${[...rulesetIds].join(', ')}).`,
      source: `pack:${pack.id}`,
    });
  }

  // ── Content still used by a saved character ──────────────────────────────
  // Bug fix: this used to compare raw ids across every content type with no
  // type discrimination (a flat Set<string> of pack item ids matched
  // against a flat Set<string> of the character's content ids) — unlike
  // the "shadowed" check above, which correctly pairs {type, id}. Two
  // different content types sharing the same id string (a real risk with
  // hand-typed homebrew ids, e.g. a race and an item both slugified to
  // "iron_will") would produce a false "still in use" warning even though
  // the character's content and the pack's content were actually
  // unrelated pieces of content that just happened to share an id.
  const packIds = new Set(pack.itemRefs.map(r => r.id)); // untyped fallback, choice selections only — see collectTypedContentRefs's own comment
  const packRefsByType = new Map<ContentCacheType, Set<string>>();
  for (const ref of pack.itemRefs) {
    if (!packRefsByType.has(ref.type)) packRefsByType.set(ref.type, new Set());
    packRefsByType.get(ref.type)!.add(ref.id);
  }
  for (const character of characters) {
    const typedMatches = collectTypedContentRefs(character)
      .filter(r => packRefsByType.get(r.type)?.has(r.id))
      .map(r => r.id);
    const choiceMatches = character.kind === 'character'
      ? character.choices.filter(c => c.resolved).flatMap(c => c.selections).filter(sel => packIds.has(sel))
      : [];
    const used = [...new Set([...typedMatches, ...choiceMatches])];
    if (used.length > 0) {
      issues.push({
        severity: 'warning', code: 'pack_content_in_use',
        message: `"${character.identity.name || character.id}" uses content from this pack (${used.join(', ')}) — removing this pack will leave that character with a missing reference.`,
        affectedId: character.id, source: `pack:${pack.id}`,
        suggestedFix: 'Keep the pack installed, or expect that character to show new Issues on its own sheet afterward.',
      });
    }
  }

  return issues;
}
