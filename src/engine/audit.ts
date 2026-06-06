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
import { modifier, collectAllEffects, applyStatModifiers } from './pipeline';

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
  // the real DEX/CON contributions — not the raw assigned scores (which would
  // display "+0" for Unarmored Defense even after stats are assigned).
  const allEffects     = collectAllEffects(entity);
  const effectiveStats = applyStatModifiers(entity.stats, allEffects);
  const dexMod = modifier(effectiveStats.dex);

  // Determine which base formula is active
  const hasArmorFormula = entity.inventory.equipped.some(item =>
    item.features.some(f => f.effects.some(e => e.type === 'base_ac_formula'))
  );
  const hasUnarmoredDefense = entity.features.some(f =>
    f.isActive && f.effects.some(e => e.type === 'base_ac_formula')
  );

  if (!hasArmorFormula && !hasUnarmoredDefense) {
    // No armor, no formula — standard fallback
    entries.push(entry('Base', 10, 'base', null));
    entries.push(entry('DEX modifier', dexMod, 'base', null));
  }

  // Equipped items — armor and shields
  for (const item of entity.inventory.equipped) {
    for (const f of item.features) {
      for (const e of f.effects) {
        if (e.type === 'base_ac_formula') {
          entries.push(entry(item.itemId, e.value as number, 'item', item.itemId));
        } else if (e.type === 'stat_modifier' && e.target === 'ac' && typeof e.value === 'number') {
          entries.push(entry(item.itemId, e.value, 'item', item.itemId));
        }
      }
    }
  }

  // Feature AC modifiers (Unarmored Defense, Shield spell, etc.)
  for (const f of entity.features) {
    if (!f.isActive) continue;
    for (const e of f.effects) {
      if (e.type === 'base_ac_formula') {
        entries.push(entry(`${f.name} (base)`, e.value as number, f.source.kind, f.id));
        // Show each ability modifier contribution from the formula (effective stats)
        for (const ab of (e.formulaAbilities ?? [])) {
          entries.push(entry(
            `${ab.toUpperCase()} modifier`,
            modifier(effectiveStats[ab]),
            f.source.kind,
            f.id,
          ));
        }
      } else if (e.type === 'stat_modifier' && e.target === 'ac' && typeof e.value === 'number') {
        entries.push(entry(f.name, e.value, f.source.kind, f.id));
      }
    }
  }

  return entries;
}

// ── Initiative ────────────────────────────────────────────────────────────────

function buildInitiativeEntries(entity: Entity): AuditEntry[] {
  const entries: AuditEntry[] = [];
  const dexMod = modifier(entity.stats.dex);
  entries.push(entry('DEX modifier', dexMod, 'base', null));

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
  entries.push(entry('Base speed', entity.resources.speed, 'base', null));

  for (const f of entity.features) {
    if (!f.isActive) continue;
    for (const e of f.effects) {
      if (e.type === 'stat_modifier' && e.target === 'speed' && typeof e.value === 'number') {
        entries.push(entry(f.name, e.value, f.source.kind, f.id));
      }
    }
  }

  // Conditions that reduce speed (e.g. Grappled: speed 0)
  for (const c of entity.conditions) {
    // Conditions that set speed to 0 are marked with a set operation
    const relatedFeature = entity.features.find(f =>
      f.source.kind === 'condition' && f.source.refId === c.id &&
      f.effects.some(e => e.target === 'speed')
    );
    if (relatedFeature) {
      for (const e of relatedFeature.effects) {
        if (e.target === 'speed' && typeof e.value === 'number') {
          entries.push(entry(`${c.id} (condition)`, e.value, 'condition', c.id));
        }
      }
    }
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
  const prof = Math.ceil(1 + entity.identity.level / 4);
  return [entry(`Level ${entity.identity.level} (formula: ⌈1 + level/4⌉)`, prof, 'base', null)];
}

// ── Spell Save DC ─────────────────────────────────────────────────────────────

function buildSpellSaveDcEntries(entity: Entity): AuditEntry[] {
  if (!entity.spellcasting) return [];
  const prof    = Math.ceil(1 + entity.identity.level / 4);
  const ability = entity.spellcasting.ability;
  const mod     = modifier(entity.stats[ability]);
  return [
    entry('Base', 8, 'base', null),
    entry('Proficiency bonus', prof, 'class', null),
    entry(`${ability.toUpperCase()} modifier`, mod, 'base', null),
  ];
}

// ── Spell Attack Bonus ────────────────────────────────────────────────────────

function buildSpellAttackEntries(entity: Entity): AuditEntry[] {
  if (!entity.spellcasting) return [];
  const prof    = Math.ceil(1 + entity.identity.level / 4);
  const ability = entity.spellcasting.ability;
  const mod     = modifier(entity.stats[ability]);
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
  const mod  = modifier(entity.stats[ability]);
  const prof = Math.ceil(1 + entity.identity.level / 4);
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

  const abilityMod = modifier(entity.stats[skillEntry.ability]);
  const prof       = Math.ceil(1 + entity.identity.level / 4);

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
