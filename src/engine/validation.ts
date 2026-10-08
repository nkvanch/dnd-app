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
import { getToolById } from '../content/tools';
import { getLanguageById } from '../content/languages';

// CHOICE-EXPANSION-1: every ChoiceDefinition.kind this app can actually
// resolve with a real picker today (see TabFeatures.tsx's dispatch). Kept
// here (not exported) purely to drive the unresolved_choice_kind check
// below — 'custom' is the one kind in the type union with no structured
// meaning anywhere in this schema (see leveling.ts's canAutoResolve/
// resolveChoice), so it's deliberately excluded rather than given
// speculative rendering semantics.
const SUPPORTED_CHOICE_KINDS = new Set([
  'skill', 'spell', 'subclass', 'infusion', 'feature_pool', 'asi', 'feat',
  'equipment', 'spellcasting_ability', 'expertise', 'tool', 'language',
]);

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
  // LIVE-RULESET-3 (item 5): resolved WITHOUT a ruleset filter first (same
  // two-step shape as race/class/background above) so "missing entirely"
  // and "exists, but tagged for a different ruleset" stay distinct issue
  // codes/messages rather than collapsing into one.
  if (spellcasting) {
    for (const spellId of spellIdsOnEntity(entity)) {
      const resolvedSpell = resolveSpellById(spellId, contentDB.spells);
      if (!resolvedSpell) {
        issues.push({
          severity: 'warning', code: 'missing_spell',
          message: `Spell "${spellId}" isn't in the current content library.`,
          affectedId: spellId, source: 'spellcasting',
          suggestedFix: 'Reinstall the pack that provides this spell, or remove it.',
        });
      } else if (rulesetId && resolvedSpell.rulesetId && !matchesRuleset(resolvedSpell.rulesetId, rulesetId)) {
        issues.push({
          severity: 'info', code: 'ruleset_mismatch',
          message: `Spell "${resolvedSpell.name}" belongs to a different ruleset than this character.`,
          affectedId: spellId, source: 'spellcasting',
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
    const resolvedItem = resolveItemById(itemId, contentDB.items);
    if (!resolvedItem) {
      issues.push({
        severity: 'warning', code: 'missing_item',
        message: `Item "${itemId}" isn't in the current content library.`,
        affectedId: itemId, source: 'inventory',
        suggestedFix: 'Reinstall the pack that provides this item, or remove it.',
      });
    } else if (rulesetId && resolvedItem.rulesetId && !matchesRuleset(resolvedItem.rulesetId, rulesetId)) {
      issues.push({
        severity: 'info', code: 'ruleset_mismatch',
        message: `Item "${resolvedItem.name}" belongs to a different ruleset than this character.`,
        affectedId: itemId, source: 'inventory',
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

  // ── Tool / Language selections against the registry (CHOICE-EXPANSION-1) ──
  // Same shape as the feat/spell check above, now that tool/language have a
  // real registry to check against — previously deliberately skipped (see
  // this file's own test suite's prior documentation of that gap).
  for (const choice of choices) {
    if (!choice.resolved) continue;
    const kind = choice.definition.kind;
    if (kind !== 'tool' && kind !== 'language') continue;
    for (const sel of choice.selections) {
      const missing = kind === 'tool' ? !getToolById(sel) : !getLanguageById(sel);
      if (missing) {
        issues.push({
          severity: 'warning',
          code: kind === 'tool' ? 'missing_tool_definition' : 'missing_language_definition',
          message: `A previously-chosen ${kind} ("${sel}") isn't in the current registry.`,
          affectedId: sel, source: `choices["${choice.id}"]`,
          suggestedFix: 'Reinstall the pack that provides this content, or revisit the choice.',
        });
      }
    }
  }

  // ── Invalid Expertise targets (item 28) ────────────────────────────────────
  // Expertise is only ever legal to SELECT while the target skill is
  // trained (enforced at resolution time by applyExpertiseChoiceToEntity).
  // The one path in this engine where a skill can legitimately go from
  // trained to untrained afterward is swapBackground's skill-retrain
  // checklist — if that happens, the resolved choice is never silently
  // reassigned to a different skill; it's surfaced here instead.
  for (const choice of choices) {
    if (!choice.resolved || choice.definition.kind !== 'expertise') continue;
    for (const sel of choice.selections) {
      const entry = entity.skills.skills[sel as keyof typeof entity.skills.skills];
      if (!entry?.trained) {
        issues.push({
          severity: 'warning', code: 'invalid_expertise_target',
          message: `Expertise was chosen in "${sel}", but this character is no longer proficient in that skill.`,
          affectedId: sel, source: `choices["${choice.id}"]`,
          suggestedFix: 'Regain proficiency in this skill, or have your DM adjust this Expertise choice manually.',
        });
      }
    }
  }

  // ── Unsupported pending choice kinds (item 17/29) ──────────────────────────
  // A choice that isn't silently dropped from TabFeatures's pending list
  // (it always renders its prompt/count) but has no picker to resolve it —
  // surfaced as a real Issue too, not ONLY as UI text in one screen.
  for (const choice of choices) {
    if (choice.resolved) continue;
    if (SUPPORTED_CHOICE_KINDS.has(choice.definition.kind)) continue;
    issues.push({
      severity: 'info', code: 'unresolved_choice_kind',
      message: `"${choice.definition.prompt}" has no in-app picker for its choice type ("${choice.definition.kind}") yet.`,
      affectedId: choice.id, source: `choices["${choice.id}"]`,
      suggestedFix: 'Resolve this with your DM for now.',
    });
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
