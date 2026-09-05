// ============================================================================
// FILE: src/engine/audit.ts
// PROJECT: Derived Value Explanation Engine
//
// PURPOSE:
//   Every number on the character sheet is tappable.
//   explainValue() returns the full breakdown of how that number was computed.
//
// USAGE:
//   const trail = explainValue(entity, 'ac');
//   // trail.entries = [
//   //   { label: "Base",           value: 10, sourceKind: 'base',  sourceId: null },
//   //   { label: "DEX modifier",   value:  3, sourceKind: 'base',  sourceId: null },
//   //   { label: "Chain shirt",    value:  4, sourceKind: 'item',  sourceId: 'chain_shirt' },
//   //   { label: "DM override — cursed", value: 0, sourceKind: 'dm_override', sourceId: 'ov_123' },
//   // ]
//   // trail.total = 17
//
// SUPPORTED STATS:
//   Scalar derived: 'ac', 'initiative', 'speed', 'passivePerception',
//                   'spellSaveDC', 'spellAttackBonus', 'proficiencyBonus'
//   Ability scores: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
//   Saving throws:  'save_str' | 'save_dex' | … | 'save_cha'
//   Skills:         any SkillName e.g. 'perception', 'athletics'
// ============================================================================

import {
  Entity, Ability, SkillName, AuditEntry, AuditTrail, AuditSourceKind,
} from './types';
import {
  modifier, collectAllEffects, applyStatModifiers,
  proficiencyBonus, AC_DC_BASE, selectBestAcFormula,
} from './pipeline';

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the full audit trail for a derived stat.
 * Every entry is one contribution (+value or −value) with its source labeled.
 * DM overrides are always appended last.
 *
 * Returns an empty trail (total: 0) for unrecognised stat keys rather than throwing.
 */
export function explainValue(entity: Entity, stat: string): AuditTrail {
  const entries = buildEntries(entity, stat);
  appendDmOverrides(entity, stat, entries);

  // The total is the honest sum of the contributing entries. Using
  // entity.derived[stat] directly would hide real calculation bugs (e.g. an AC
  // double-count) behind the already-computed number.
  const total = entries.reduce((sum, e) => sum + e.value, 0);

  return { stat, total, entries };
}

// ── Builders ──────────────────────────────────────────────────────────────────

function buildEntries(entity: Entity, stat: string): AuditEntry[] {
  // Ability scores
  if (isAbility(stat)) return buildAbilityEntries(entity, stat as Ability);

  // Saving throws: "save_str", "save_dex", etc.
  if (stat.startsWith('save_') && isAbility(stat.slice(5))) {
    return buildSaveEntries(entity, stat.slice(5) as Ability);
  }

  // Skills
  if (isSkill(stat)) return buildSkillEntries(entity, stat as SkillName);

  // Scalar derived stats
  switch (stat) {
    case 'ac':               return buildAcEntries(entity);
    case 'initiative':       return buildInitiativeEntries(entity);
    case 'speed':            return buildSpeedEntries(entity);
    case 'passivePerception': return buildPassivePerceptionEntries(entity);
    case 'proficiencyBonus': return buildProficiencyEntries(entity);
    case 'spellSaveDC':      return buildSpellSaveDcEntries(entity);
    case 'spellAttackBonus': return buildSpellAttackEntries(entity);
    default:                 return [];
  }
}

// ── AC ────────────────────────────────────────────────────────────────────────

function buildAcEntries(entity: Entity): AuditEntry[] {
  const entries: AuditEntry[] = [];
  // Use effective stats (base + race/feature modifiers) so the breakdown shows
  // the real DEX/CON contributions — not the raw assigned scores.
  const allEffects     = collectAllEffects(entity);
  const effectiveStats = applyStatModifiers(entity.stats, allEffects);
  const dexMod = modifier(effectiveStats.dex);

  // Gather every flat AC bonus (shields, magic items, feature bonuses).
  // The base formula (armor on equipped items, Unarmored Defense on features)
  // is resolved separately below via the same selectBestAcFormula()
  // recomputeDerived() uses, so this breakdown can never pick a different
  // winner than the actual entity.derived.ac calculation — including item-
  // granted formulas, which this used to miss entirely (it only walked
  // entity.features, not equipped-item effects).
  const flats: AuditEntry[] = [];

  for (const item of entity.inventory.equipped) {
    for (const f of item.features) {
      for (const e of f.effects) {
        if (e.type === 'stat_modifier' && e.target === 'ac' && typeof e.value === 'number') {
          flats.push(entry(f.name, e.value, 'item', item.itemId));
        }
      }
    }
  }

  for (const f of entity.features) {
    if (!f.isActive) continue;
    for (const e of f.effects) {
      if (e.type === 'stat_modifier' && e.target === 'ac' && typeof e.value === 'number') {
        flats.push(entry(f.name, e.value, f.source.kind as AuditSourceKind, f.id));
      }
    }
  }

  // Same 3-tier priority as recomputeDerived's calculatedBaseAc: a
  // base_ac_formula effect wins over armor, which wins over the flat
  // 10 + DEX fallback. Previously this only checked for a formula and fell
  // straight to "10 + DEX" otherwise — silently wrong whenever armor was
  // equipped via entity.resources.ac without going through the formula
  // system (found by the regression test this unification added).
  const best = selectBestAcFormula(allEffects, effectiveStats);
  if (best) {
    entries.push(entry(`${best.label} (base)`, best.base, best.kind, best.id));
    for (const ab of best.abilities) {
      entries.push(entry(`${ab.toUpperCase()} modifier`, modifier(effectiveStats[ab]), best.kind, best.id));
    }
  } else if (entity.resources.ac > 0) {
    entries.push(entry('Armor', entity.resources.ac, 'base', null));
  } else {
    entries.push(entry('Base', 10, 'base', null));
    entries.push(entry('DEX modifier', dexMod, 'base', null));
  }

  entries.push(...flats);
  return entries;
}

// ── Initiative ────────────────────────────────────────────────────────────────

function buildInitiativeEntries(entity: Entity): AuditEntry[] {
  const entries: AuditEntry[] = [];
  const effectiveStats = applyStatModifiers(entity.stats, collectAllEffects(entity));
  entries.push(entry('DEX modifier', modifier(effectiveStats.dex), 'base', null));

  for (const f of entity.features) {
    if (!f.isActive) continue;
    for (const e of f.effects) {
      if (e.type === 'stat_modifier' && e.target === 'initiative' && typeof e.value === 'number') {
        entries.push(entry(f.name, e.value, f.source.kind, f.id));
      }
    }
  }
  return entries;
}

// ── Speed ─────────────────────────────────────────────────────────────────────

function buildSpeedEntries(entity: Entity): AuditEntry[] {
  const entries: AuditEntry[] = [];

  // Single pass over every speed effect (features — which include condition-
  // sourced features — and equipped items), partitioned by operation.
  type Found = {
    label: string; value: number; kind: AuditSourceKind; id: string | null;
    op: string;
  };
  const found: Found[] = [];

  for (const f of entity.features) {
    if (!f.isActive) continue;
    const label = f.source.kind === 'condition' ? `${f.name} (condition)` : f.name;
    for (const e of f.effects) {
      if (e.type === 'stat_modifier' && e.target === 'speed' && typeof e.value === 'number') {
        found.push({ label, value: e.value, kind: f.source.kind as AuditSourceKind, id: f.id, op: e.operation });
      }
    }
  }
  for (const item of entity.inventory.equipped) {
    for (const f of item.features) {
      for (const e of f.effects) {
        if (e.type === 'stat_modifier' && e.target === 'speed' && typeof e.value === 'number') {
          found.push({ label: f.name, value: e.value, kind: 'item', id: item.itemId, op: e.operation });
        }
      }
    }
  }

  const sets = found.filter(x => x.op === 'set');
  if (sets.length > 0) {
    // 'set' REPLACES the base speed (Dwarf 25, Grappled 0). Showing base 30
    // PLUS "25" was the old bug — a dwarf's audit displayed 55. The pipeline's
    // last-collected set wins, so mirror that ordering here.
    const winner = sets[sets.length - 1];
    entries.push(entry(`${winner.label} (sets speed)`, winner.value, winner.kind, winner.id));
  } else {
    entries.push(entry('Base speed', entity.resources.speed, 'base', null));
  }

  // Additive bonuses (Fast Movement, magic items) stack on top.
  for (const a of found.filter(x => x.op === 'add')) {
    entries.push(entry(a.label, a.value, a.kind, a.id));
  }

  return entries;
}

// ── Passive Perception ────────────────────────────────────────────────────────

function buildPassivePerceptionEntries(entity: Entity): AuditEntry[] {
  const entries: AuditEntry[] = [];
  entries.push(entry('Base', 10, 'base', null));
  const percEntries = buildSkillEntries(entity, 'perception');
  entries.push(...percEntries);
  return entries;
}

// ── Proficiency bonus ─────────────────────────────────────────────────────────

function buildProficiencyEntries(entity: Entity): AuditEntry[] {
  const prof = proficiencyBonus(entity.identity.level);
  return [entry(`Level ${entity.identity.level} (formula: ⌈1 + level/4⌉)`, prof, 'base', null)];
}

// ── Spell Save DC ─────────────────────────────────────────────────────────────

function buildSpellSaveDcEntries(entity: Entity): AuditEntry[] {
  if (!entity.spellcasting) return [];
  const prof    = proficiencyBonus(entity.identity.level);
  const ability = entity.spellcasting.ability;
  const effectiveStats = applyStatModifiers(entity.stats, collectAllEffects(entity));
  const mod     = modifier(effectiveStats[ability]);
  return [
    entry('Base', AC_DC_BASE, 'base', null),
    entry('Proficiency bonus', prof, 'class', null),
    entry(`${ability.toUpperCase()} modifier`, mod, 'base', null),
  ];
}

// ── Spell Attack Bonus ────────────────────────────────────────────────────────

function buildSpellAttackEntries(entity: Entity): AuditEntry[] {
  if (!entity.spellcasting) return [];
  const prof    = proficiencyBonus(entity.identity.level);
  const ability = entity.spellcasting.ability;
  const effectiveStats = applyStatModifiers(entity.stats, collectAllEffects(entity));
  const mod     = modifier(effectiveStats[ability]);
  return [
    entry('Proficiency bonus', prof, 'class', null),
    entry(`${ability.toUpperCase()} modifier`, mod, 'base', null),
  ];
}

// ── Ability scores ────────────────────────────────────────────────────────────

function buildAbilityEntries(entity: Entity, ability: Ability): AuditEntry[] {
  const entries: AuditEntry[] = [];
  entries.push(entry('Base score', entity.stats[ability], 'base', null));

  for (const f of entity.features) {
    if (!f.isActive) continue;
    for (const e of f.effects) {
      if (
        e.type      === 'stat_modifier' &&
        e.target    === ability &&
        e.operation === 'add' &&
        typeof e.value === 'number'
      ) {
        entries.push(entry(f.name, e.value, f.source.kind, f.id));
      }
    }
  }
  return entries;
}

// ── Saving throws ─────────────────────────────────────────────────────────────

function buildSaveEntries(entity: Entity, ability: Ability): AuditEntry[] {
  const entries: AuditEntry[] = [];
  const effectiveStats = applyStatModifiers(entity.stats, collectAllEffects(entity));
  const mod  = modifier(effectiveStats[ability]);
  const prof = proficiencyBonus(entity.identity.level);
  const isProficient = entity.proficiencies.savingThrows.includes(ability);

  entries.push(entry(`${ability.toUpperCase()} modifier`, mod, 'base', null));
  if (isProficient) {
    entries.push(entry('Proficiency bonus', prof, 'class', null));
  }

  // Feature bonuses to saves (Paladin Aura, etc.)
  for (const f of entity.features) {
    if (!f.isActive) continue;
    for (const e of f.effects) {
      if (
        e.type === 'stat_modifier' &&
        e.target === `save_${ability}` &&
        typeof e.value === 'number'
      ) {
        entries.push(entry(f.name, e.value, f.source.kind, f.id));
      }
    }
  }

  return entries;
}

// ── Skills ────────────────────────────────────────────────────────────────────

function buildSkillEntries(entity: Entity, skill: SkillName): AuditEntry[] {
  const entries: AuditEntry[] = [];
  const skillEntry = entity.skills.skills[skill];
  if (!skillEntry) return entries;

  const effectiveStats = applyStatModifiers(entity.stats, collectAllEffects(entity));
  const abilityMod = modifier(effectiveStats[skillEntry.ability]);
  const prof       = proficiencyBonus(entity.identity.level);

  entries.push(entry(`${skillEntry.ability.toUpperCase()} modifier`, abilityMod, 'base', null));

  if (skillEntry.expertise) {
    entries.push(entry('Expertise (×2 proficiency)', prof * 2, 'class', null));
  } else if (skillEntry.trained) {
    entries.push(entry('Proficiency', prof, 'class', null));
  } else {
    // Half-proficiency (e.g. Jack of All Trades) would appear here
  }

  if (skillEntry.bonus) {
    entries.push(entry('Bonus (feat/item)', skillEntry.bonus, 'feat', null));
  }

  // Feature bonuses targeting this specific skill
  for (const f of entity.features) {
    if (!f.isActive) continue;
    for (const e of f.effects) {
      if (
        e.type === 'stat_modifier' &&
        e.target === `skill.${skill}` &&
        typeof e.value === 'number'
      ) {
        entries.push(entry(f.name, e.value, f.source.kind, f.id));
      }
    }
  }

  return entries;
}

// ── DM overrides (always appended last) ──────────────────────────────────────

/**
 * Appends active DM overrides for this stat to the entries list.
 * 'set' overrides are shown as notes (value: 0) since they replace rather than add.
 * 'add' overrides show their actual value contribution.
 */
function appendDmOverrides(entity: Entity, stat: string, entries: AuditEntry[]): void {
  for (const ov of (entity.dmOverrides ?? []).filter(o => o.active && o.stat === stat)) {
    entries.push({
      label:      `DM override (${ov.operation}) — ${ov.label}`,
      value:      ov.value,   // always show the actual value, not 0 for 'set'
      sourceKind: 'dm_override',
      sourceId:   ov.id,
    });
  }
}

// ── Type guards ───────────────────────────────────────────────────────────────

const ABILITIES   = new Set<string>(['str', 'dex', 'con', 'int', 'wis', 'cha']);
const SKILL_NAMES = new Set<string>([
  'athletics', 'acrobatics', 'sleight_of_hand', 'stealth',
  'arcana', 'history', 'investigation', 'nature', 'religion',
  'animal_handling', 'insight', 'medicine', 'perception', 'survival',
  'deception', 'intimidation', 'performance', 'persuasion',
]);

function isAbility(s: string): s is Ability     { return ABILITIES.has(s); }
function isSkill(s: string): s is SkillName     { return SKILL_NAMES.has(s); }

// ── Entry factory ─────────────────────────────────────────────────────────────

function entry(
  label:      string,
  value:      number,
  sourceKind: AuditSourceKind,
  sourceId:   string | null,
): AuditEntry {
  return { label, value, sourceKind, sourceId };
}
