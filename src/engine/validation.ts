// src/engine/validation.ts
// A-54: structured Issue[] diagnostics for a character. Pure and read-only —
// never mutates the entity, never blocks it from opening. Detects the
// concrete, checkable cases this app can actually observe today: a race/
// subrace/class/subclass/background/spell/item id that no longer resolves
// against the current content library (deleted homebrew, uninstalled pack),
// a declared ruleset mismatch, and an orphaned feat/spell choice selection.
//
// Deliberately NOT attempted here (no reliable signal to check against yet):
// prerequisite validation (no structured Prerequisite type exists in this
// engine), "unsupported mechanic" (every Effect the pipeline understands is
// already applied — nothing is currently silently unrepresentable), and
// pack version-mismatch (the pack registry, src/db/packRegistryRepo.ts,
// doesn't track a version field yet). Those stay open, disclosed gaps —
// see A-62 (pack diagnostics), which is meant to build on this file once
// the registry itself carries more to check.
import { Entity, ContentDB, HomebrewSubclass, Issue, matchesRuleset } from './types';
import { getClassLevels } from './multiclass';
import { getSubclassEntryMerged } from '../content/subclasses/subclassBrowse';
import { resolveSpellById, resolveItemById } from '../content/contentResolution';
import { spellIdsOnEntity } from '../content/spellRepo.types';

export function validateEntity(
  entity: Entity,
  contentDB: ContentDB,
  homebrewSubclasses: HomebrewSubclass[],
): Issue[] {
  // Monster/npc/companion entities reuse raceId/classId as unrelated
  // template ids (see Identity's own doc comment on companionOf/classes) —
  // none of these content-reference checks apply to them.
  if (entity.kind !== 'character') return [];

  const issues: Issue[] = [];
  const { identity, spellcasting, inventory, choices, rulesetId } = entity;

  // ── Race / subrace ──────────────────────────────────────────────────────
  let resolvedRace: ContentDB['races'][number] | null = null;
  if (identity.raceId) {
    resolvedRace = contentDB.races.find(r => r.id === identity.raceId) ?? null;
    if (!resolvedRace) {
      issues.push({
        severity: 'error', code: 'missing_race',
        message: `Race "${identity.raceId}" isn't in the current content library.`,
        affectedId: identity.raceId, source: 'identity.raceId',
        suggestedFix: 'Reinstall the pack that provides this race, or pick a different one.',
      });
    } else if (rulesetId && resolvedRace.rulesetId && !matchesRuleset(resolvedRace.rulesetId, rulesetId)) {
      issues.push({
        severity: 'info', code: 'ruleset_mismatch',
        message: `Race "${resolvedRace.name}" belongs to a different ruleset than this character.`,
        affectedId: identity.raceId, source: 'identity.raceId',
      });
    }
  }
  if (identity.subRaceId && resolvedRace) {
    const found = resolvedRace.subraces?.some(sr => sr.id === identity.subRaceId);
    if (!found) {
      issues.push({
        severity: 'error', code: 'missing_subrace',
        message: `Subrace "${identity.subRaceId}" isn't found under race "${resolvedRace.name}".`,
        affectedId: identity.subRaceId, source: 'identity.subRaceId',
        suggestedFix: 'Reinstall the pack that provides this subrace, or pick a different one.',
      });
    }
  }

  // ── Classes / subclasses ─────────────────────────────────────────────────
  for (const cls of getClassLevels(entity)) {
    const resolvedClass = contentDB.classes.find(c => c.id === cls.classId);
    if (!resolvedClass) {
      issues.push({
        severity: 'error', code: 'missing_class',
        message: `Class "${cls.classId}" isn't in the current content library.`,
        affectedId: cls.classId, source: 'identity.classes[].classId',
        suggestedFix: 'Reinstall the pack that provides this class.',
      });
      continue; // no point checking a subclass under a class that's gone
    }
    if (rulesetId && resolvedClass.rulesetId && !matchesRuleset(resolvedClass.rulesetId, rulesetId)) {
      issues.push({
        severity: 'info', code: 'ruleset_mismatch',
        message: `Class "${resolvedClass.name}" belongs to a different ruleset than this character.`,
        affectedId: cls.classId, source: 'identity.classes[].classId',
      });
    }
    if (cls.subclassId) {
      const entry = getSubclassEntryMerged(cls.classId, cls.subclassId, homebrewSubclasses);
      if (!entry) {
        issues.push({
          severity: 'error', code: 'missing_subclass',
          message: `Subclass "${cls.subclassId}" isn't found under class "${resolvedClass.name}".`,
          affectedId: cls.subclassId, source: 'identity.classes[].subclassId',
          suggestedFix: 'Reinstall the pack that provides this subclass, or pick a different one.',
        });
      }
    }
  }

  // ── Background ────────────────────────────────────────────────────────────
  if (identity.backgroundId) {
    const resolvedBg = contentDB.backgrounds.find(b => b.id === identity.backgroundId);
    if (!resolvedBg) {
      issues.push({
        severity: 'error', code: 'missing_background',
        message: `Background "${identity.backgroundId}" isn't in the current content library.`,
        affectedId: identity.backgroundId, source: 'identity.backgroundId',
        suggestedFix: 'Reinstall the pack that provides this background, or pick a different one.',
      });
    } else if (rulesetId && resolvedBg.rulesetId && !matchesRuleset(resolvedBg.rulesetId, rulesetId)) {
      issues.push({
        severity: 'info', code: 'ruleset_mismatch',
        message: `Background "${resolvedBg.name}" belongs to a different ruleset than this character.`,
        affectedId: identity.backgroundId, source: 'identity.backgroundId',
      });
    }
  }

  // ── Spells known/prepared/cantrips ──────────────────────────────────────
  if (spellcasting) {
    for (const spellId of spellIdsOnEntity(entity)) {
      if (!resolveSpellById(spellId, contentDB.spells)) {
        issues.push({
          severity: 'warning', code: 'missing_spell',
          message: `Spell "${spellId}" isn't in the current content library.`,
          affectedId: spellId, source: 'spellcasting',
          suggestedFix: 'Reinstall the pack that provides this spell, or remove it.',
        });
      }
    }
  }

  // ── Inventory items ────────────────────────────────────────────────────────
  const itemIds = new Set([
    ...inventory.carried.map(i => i.itemId),
    ...inventory.equipped.map(i => i.itemId),
  ]);
  for (const itemId of itemIds) {
    if (!resolveItemById(itemId, contentDB.items)) {
      issues.push({
        severity: 'warning', code: 'missing_item',
        message: `Item "${itemId}" isn't in the current content library.`,
        affectedId: itemId, source: 'inventory',
        suggestedFix: 'Reinstall the pack that provides this item, or remove it.',
      });
    }
  }

  // ── Orphaned choice selections (feat / spell only — see file header) ──────
  for (const choice of choices) {
    if (!choice.resolved) continue;
    const kind = choice.definition.kind;
    if (kind !== 'feat' && kind !== 'spell') continue;
    for (const sel of choice.selections) {
      const missing = kind === 'feat'
        ? !(contentDB.feats ?? []).some(f => f.id === sel)
        : !resolveSpellById(sel, contentDB.spells);
      if (missing) {
        issues.push({
          severity: 'warning', code: 'orphaned_choice_selection',
          message: `A previously-chosen ${kind} ("${sel}") isn't in the current content library.`,
          affectedId: sel, source: `choices["${choice.id}"]`,
          suggestedFix: 'Reinstall the pack that provides this content, or revisit the choice.',
        });
      }
    }
  }

  return issues;
}

/**
 * Every content id an Entity actually references — race/subrace/class(es)/
 * subclass(es)/background, known spells, carried+equipped items, and
 * resolved choice selections — regardless of whether that id currently
 * resolves. Unlike validateEntity() above, this never reports a problem;
 * it's a plain collection, used by src/engine/packDiagnostics.ts (A-62) to
 * answer "would removing this pack leave any saved character with a
 * dangling reference?" by intersecting against a pack's own item ids.
 */
export function collectEntityContentIds(entity: Entity): Set<string> {
  const ids = new Set<string>();
  if (entity.kind !== 'character') return ids;

  const { identity, spellcasting, inventory, choices } = entity;
  if (identity.raceId) ids.add(identity.raceId);
  if (identity.subRaceId) ids.add(identity.subRaceId);
  for (const cls of getClassLevels(entity)) {
    ids.add(cls.classId);
    if (cls.subclassId) ids.add(cls.subclassId);
  }
  if (identity.backgroundId) ids.add(identity.backgroundId);
  if (spellcasting) for (const spellId of spellIdsOnEntity(entity)) ids.add(spellId);
  for (const item of inventory.carried)  ids.add(item.itemId);
  for (const item of inventory.equipped) ids.add(item.itemId);
  for (const choice of choices) {
    if (!choice.resolved) continue;
    for (const sel of choice.selections) ids.add(sel);
  }

  return ids;
}
