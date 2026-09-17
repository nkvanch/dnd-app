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
import { Entity, Issue, PreparedEncounter } from './types';
import { InstalledPack, PackItemRef } from '../db/packRegistryRepo';
import { ContentCacheType, HomebrewContent } from '../db/contentCacheRepo';
import { getClassLevels } from './multiclass';
import { spellIdsOnEntity } from '../content/spellRepo.types';
import { collectContentDependencies } from './contentDependencies';

/** Just the id (and optional rulesetId) shape diagnosePack needs from each
 *  homebrew content array — a structural subset of HomebrewStoreState's
 *  fields, so this file doesn't need to import the store (engine/ stays
 *  below store/ in the dependency order). Deliberately kept narrow (not
 *  widened to full HomebrewContent) so existing minimal test fixtures
 *  (`{id: string}`) keep typechecking — the new "other homebrew depends on
 *  this pack" check below casts to HomebrewContent at its one call site
 *  instead, since every REAL call site already passes full content
 *  objects; only test fixtures are ever narrower than that in practice. */
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
export function collectTypedContentRefs(entity: Entity): { type: ContentCacheType; id: string }[] {
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
  // HOMEBREW-PACKAGE-1 item 17 ("campaigns where applicable"): optional so
  // every existing call site (which has no encounter list in scope, or
  // doesn't care) keeps compiling unchanged — defaults to "nothing to
  // check" rather than requiring every caller to thread this through.
  preparedEncounters: PreparedEncounter[] = [],
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

  // ── Content still referenced by a prepared encounter ─────────────────────
  // HOMEBREW-PACKAGE-1 item 17: a DM's prepared encounter (campaign
  // planning data, src/db/encounterRepo.ts) references monsters/conditions
  // by id independently of any character — a pack uninstall could silently
  // leave an encounter's combatant pointing at a monster template that no
  // longer exists. Same type-paired matching discipline as the character
  // check above (no untyped id-only fallback needed — PreparedCombatant's
  // fields are already concretely typed per reference).
  for (const encounter of preparedEncounters) {
    const used = new Set<string>();
    for (const combatant of encounter.combatants) {
      if (packRefsByType.get('monster')?.has(combatant.monsterId)) used.add(`monster:${combatant.monsterId}`);
      for (const condId of combatant.startingConditionIds ?? []) {
        if (packRefsByType.get('condition')?.has(condId)) used.add(`condition:${condId}`);
      }
    }
    if (used.size > 0) {
      issues.push({
        severity: 'warning', code: 'pack_content_in_use',
        message: `Encounter "${encounter.name}" uses content from this pack (${[...used].join(', ')}) — removing this pack will leave it with a missing reference.`,
        affectedId: encounter.id, source: `pack:${pack.id}`,
        suggestedFix: 'Keep the pack installed, or expect that encounter to show a broken reference afterward.',
      });
    }
  }

  // ── Content depended on by other homebrew ───────────────────────────────
  // HOMEBREW-PACKAGE-1 item 17: the character check above only catches a
  // SAVED CHARACTER's own reference; it misses another homebrew DEFINITION
  // (e.g. a Subclass authored locally, or installed by a different pack)
  // that references this pack's content structurally (Subrace→Race,
  // Subclass→Feature, Feat→Spell, ...). Reuses collectContentDependencies
  // (the same dependency-closure walker export/import already builds on)
  // rather than a second bespoke reference-walker.
  const packRefKeys = new Set(pack.itemRefs.map(r => `${r.type}:${r.id}`));
  for (const [type, key] of Object.entries(CONTENT_TYPE_TO_STORE_KEY) as [ContentCacheType, keyof HomebrewContentSlice][]) {
    for (const item of homebrew[key]) {
      // Skip content this SAME pack owns — a pack's own internal references
      // (e.g. its own Subclass → its own Class) aren't a removal hazard,
      // they'd be removed together.
      if (packRefKeys.has(`${type}:${item.id}`)) continue;
      // Cast: every REAL call site already passes full HomebrewContent
      // arrays (HomebrewContentSlice is intentionally narrower only so
      // minimal test fixtures keep typechecking — see its own doc comment).
      const full = item as unknown as HomebrewContent;
      const deps = collectContentDependencies(type, full);
      const hit = deps.find(d => packRefKeys.has(`${d.type}:${d.id}`));
      if (hit) {
        const displayName = 'name' in full && typeof full.name === 'string' ? full.name : item.id;
        issues.push({
          severity: 'warning', code: 'pack_content_in_use',
          message: `Homebrew ${type} "${displayName}" → uses ${hit.type}: "${hit.id}" — removing this pack will leave that definition with a missing reference.`,
          affectedId: item.id, source: `pack:${pack.id}`,
          suggestedFix: 'Keep the pack installed, or expect that definition to show a broken reference afterward.',
        });
      }
    }
  }

  return issues;
}

// ── Item 15: campaign content manifest ────────────────────────────────────────
// A DM can ban specific installed homebrew packs from a campaign (e.g. "not
// that one, it's unbalanced") — deliberately scoped to whole PACKS, not
// individual pieces of content or official-content restriction: the pack
// registry is the only existing device-side grouping of homebrew content,
// and DMs almost never want to restrict official PHB content, so per-item
// allow/deny lists would be real work with little real-world payoff.

/** Every content id (any type) contributed by the given banned pack ids —
 *  a flat, type-agnostic set, since getMergedContentDB.ts's own arrays are
 *  each already scoped to one content type, so filtering "any array by id"
 *  is safe (no cross-type id collision risk any worse than the id-keyed
 *  homebrew store already accepts elsewhere). Unknown pack ids (already
 *  uninstalled since the campaign banned them) are silently skipped, not
 *  an error — matches this file's own "detect, disclose, never crash"
 *  posture. */
// ── Item 18: homebrew "reference usage" (single-item, not whole-pack) ──────────
// diagnosePack's own 'pack_content_in_use' check (above) already answers this
// question for a whole PACK; this is the same matching logic — real
// (collectTypedContentRefs) plus untyped choice-selection fallback — aimed at
// one specific {type, id} instead of every ref a pack claims. Reused, not
// duplicated: both this and diagnosePack call collectTypedContentRefs.

/** Every character that references this exact piece of content, either
 *  through a real typed field (race/class/subclass/background/spell/item)
 *  or, as a conservative fallback, a resolved choice selection matching
 *  the id untyped (same reasoning as diagnosePack's own choiceMatches —
 *  ChoiceState.selections has no reliable type tag to check against). */
export function contentUsedBy(
  characters: Entity[],
  type:       ContentCacheType,
  id:         string,
): Entity[] {
  return characters.filter(character => {
    const typedMatch = collectTypedContentRefs(character).some(r => r.type === type && r.id === id);
    if (typedMatch) return true;
    if (character.kind !== 'character') return false;
    return character.choices.some(c => c.resolved && c.selections.includes(id));
  });
}

// ── HOMEBREW-PACKAGE-1 items 33/34: pack version updates ───────────────────
// A re-imported package whose packageId matches an already-installed pack is
// an UPDATE, not a fresh install (see app/homebrew/import-package.tsx). The
// two helpers below answer item 34's own question — "before removing
// definitions from prior version, check whether they are still referenced"
// — without a second bespoke reference-walk: they reuse diagnosePack's
// already-tested character/encounter/other-homebrew "still in use" checks
// via a synthetic single-purpose pack, the same way this file's other
// consumers (homebrew.tsx's InstalledPacksPanel) already trust that logic.

/** Every itemRef the OLD installed pack owned that the NEW package version
 *  no longer includes — pure {type,id} set difference, the first step in
 *  detecting what a pack update would remove. */
export function removedPackItemRefs(oldRefs: PackItemRef[], newRefs: { type: ContentCacheType; id: string }[]): PackItemRef[] {
  const newKeys = new Set(newRefs.map(r => `${r.type}:${r.id}`));
  return oldRefs.filter(r => !newKeys.has(`${r.type}:${r.id}`));
}

/** Of a candidate set of (about-to-be-removed) itemRefs, which ones are
 *  still referenced by a saved character, a prepared encounter, or another
 *  homebrew definition — these must be KEPT, not silently deleted, when a
 *  pack update would otherwise drop them for no longer being in the new
 *  package version. */
export function stillReferencedRefs(
  refs: PackItemRef[],
  allPacks: InstalledPack[],
  homebrew: HomebrewContentSlice,
  characters: Entity[],
  preparedEncounters: PreparedEncounter[] = [],
): PackItemRef[] {
  return refs.filter(ref => {
    const synthetic: InstalledPack = { id: '__pack_update_removal_check__', name: '', importedAt: 0, itemRefs: [ref] };
    return diagnosePack(synthetic, allPacks, homebrew, characters, preparedEncounters)
      .some(i => i.code === 'pack_content_in_use');
  });
}

export function bannedContentIds(installedPacks: InstalledPack[], bannedPackIds: string[]): Set<string> {
  const banned = new Set(bannedPackIds);
  const ids = new Set<string>();
  for (const pack of installedPacks) {
    if (!banned.has(pack.id)) continue;
    for (const ref of pack.itemRefs) ids.add(ref.id);
  }
  return ids;
}
