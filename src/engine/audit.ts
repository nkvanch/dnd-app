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
  Entity, Ability, SkillName, AuditEntry, AuditTrail, AuditSourceKind, ActiveEffect,
} from './types';
import {
  modifier, collectAllEffects, applyStatModifiers, effectiveAbilityScores,
  proficiencyBonus, AC_DC_BASE, selectBestAcFormula,
} from './pipeline';
import { resolveCombine } from './resolver';
import { ALL_BEAST_FORMS } from '../content/beastforms';

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
  const calculated = entries.reduce((sum, e) => sum + e.value, 0);
  const override = appendDmOverrides(entity, stat, entries, calculated);

  // The total is the honest sum of the contributing entries. Using
  // entity.derived[stat] directly would hide real calculation bugs (e.g. an AC
  // double-count) behind the already-computed number.
  const total = override ?? entries.reduce((sum, e) => sum + e.value, 0);

  return { stat, total, entries, calculated, override, effective: total };
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
    case 'passivePerception':    return buildPassivePerceptionEntries(entity);
    case 'passiveInvestigation': return buildPassiveInvestigationEntries(entity);
    case 'passiveInsight':       return buildPassiveInsightEntries(entity);
    case 'kiSaveDC':          return buildKiSaveDcEntries(entity);
    case 'proficiencyBonus': return buildProficiencyEntries(entity);
    case 'spellSaveDC':      return buildSpellSaveDcEntries(entity);
    case 'spellAttackBonus': return buildSpellAttackEntries(entity);
    default:                 return [];
  }
}

// ── AC ────────────────────────────────────────────────────────────────────────

function buildAcEntries(entity: Entity): AuditEntry[] {
  const allEffects = collectAllEffects(entity);

  // Wild Shape: recomputeDerived's own beastForm short-circuit replaces AC
  // entirely with the beast's flat total (calculatedBaseAc = beastForm.ac,
  // acBonus = 0 — no formula, no item/feature bonuses stack on top while
  // transformed). This function previously had zero Wild Shape awareness,
  // so a wildshaped entity's audit showed the player's own (irrelevant)
  // gear/formula breakdown instead of the actual AC in use.
  const beastForm = entity.wildShapeState?.active
    ? ALL_BEAST_FORMS.find(f => f.id === entity.wildShapeState!.formId) ?? null
    : null;
  if (beastForm) {
    return [entry(`${beastForm.name} (beast form)`, beastForm.ac, 'base', null)];
  }

  const entries: AuditEntry[] = [];
  // Use effective stats (base + race/feature modifiers) so the breakdown shows
  // the real DEX/CON contributions — not the raw assigned scores.
  const effectiveStats = applyStatModifiers(entity.stats, allEffects);
  const dexMod = modifier(effectiveStats.dex);

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

  // Flat AC bonuses (shields, magic items, feature bonuses) — every
  // stat_modifier effect targeting 'ac' (base_ac_formula is a separate
  // effect type, handled above). Bug fix: this used to hand-walk
  // entity.inventory.equipped/entity.features directly, which (a) skipped
  // collectAllEffects's condition-gating — a conditionally-suppressed AC
  // effect could incorrectly still show here — and (b) summed every
  // effect's raw value regardless of 'operation', silently treating a
  // 'multiply' effect as if it were 'add'. Now filters the same allEffects
  // recomputeDerived's own acBonus uses, and defers to resolveCombine (the
  // same function acBonus is computed with) for anything beyond a plain
  // sum of 'add' effects, so these entries can never sum to a different
  // total than entity.derived.ac actually is.
  entries.push(...buildTargetBonusEntries(allEffects, ['ac']));
  return entries;
}

// ── Initiative ────────────────────────────────────────────────────────────────

function buildInitiativeEntries(entity: Entity): AuditEntry[] {
  const entries: AuditEntry[] = [];
  const effectiveStats = effectiveAbilityScores(entity);
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

  // collectAllEffects already condition-gates (a suppressed condition's
  // speed effect won't appear) and carries sourceName/sourceKind/sourceId —
  // this used to hand-walk entity.features/entity.inventory.equipped
  // directly, which skipped that gating entirely.
  type Found = {
    label: string; value: number; kind: AuditSourceKind; id: string | null;
    op: string;
  };
  const found: Found[] = collectAllEffects(entity)
    .filter(ae => ae.effect.type === 'stat_modifier' && ae.effect.target === 'speed' && typeof ae.effect.value === 'number')
    .map(ae => ({
      label: ae.sourceKind === 'condition' ? `${ae.sourceName} (condition)` : ae.sourceName,
      value: ae.effect.value as number,
      kind:  ae.sourceKind ?? 'base',
      id:    ae.sourceId,
      op:    ae.effect.operation,
    }));

  const sets = found.filter(x => x.op === 'set');
  if (sets.length > 0) {
    // 'set' REPLACES the base speed (Dwarf 25, Grappled 0). Showing base 30
    // PLUS "25" was the old bug — a dwarf's audit displayed 55. Competing
    // sets now resolve by HIGHEST value — matching resolveCombine's own
    // order-independent tie-break — rather than "last collected", which is
    // order-dependent and was itself a bug (fixed in resolver.ts's Phase 1
    // hardening; this mirrors that fix instead of the stale ordering it
    // replaced).
    const winner = sets.reduce((best, x) => (x.value > best.value ? x : best));
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
  entries.push(...buildSkillEntries(entity, 'perception'));
  // Effect-based bonuses targeting the passive score itself (e.g. Observant's
  // +5 to passive Perception/Investigation) — recomputeDerived's own
  // passivePerception/passiveInvestigation/passiveInsight now fold these in
  // (architecture review U7); this used to only ever show the skill's own
  // breakdown, silently dropping any such bonus from the audit trail.
  entries.push(...buildTargetBonusEntries(collectAllEffects(entity), ['passivePerception']));
  return entries;
}

// ── Passive Investigation / Passive Insight ───────────────────────────────────
// Bug fix (architecture review E3): explainValue's switch had no case for
// these two stats (or kiSaveDC below) at all — falling through to the
// `default: return []` in buildEntries, so tapping either on the Abilities
// tab showed a misleading 0 with an empty breakdown while the real,
// correctly-computed value was displayed elsewhere on the same sheet.

function buildPassiveInvestigationEntries(entity: Entity): AuditEntry[] {
  const entries: AuditEntry[] = [];
  entries.push(entry('Base', 10, 'base', null));
  entries.push(...buildSkillEntries(entity, 'investigation'));
  entries.push(...buildTargetBonusEntries(collectAllEffects(entity), ['passiveInvestigation']));
  return entries;
}

function buildPassiveInsightEntries(entity: Entity): AuditEntry[] {
  const entries: AuditEntry[] = [];
  entries.push(entry('Base', 10, 'base', null));
  entries.push(...buildSkillEntries(entity, 'insight'));
  entries.push(...buildTargetBonusEntries(collectAllEffects(entity), ['passiveInsight']));
  return entries;
}

// ── Ki Save DC ─────────────────────────────────────────────────────────────────

function buildKiSaveDcEntries(entity: Entity): AuditEntry[] {
  if (!entity.features.some(f => f.id === 'martial_arts')) return [];
  const prof = proficiencyBonus(entity.identity.level);
  const allEffects = collectAllEffects(entity);
  const effectiveStats = applyStatModifiers(entity.stats, allEffects);
  const mod = modifier(effectiveStats.wis);
  return [
    entry('Base', AC_DC_BASE, 'base', null),
    entry('Proficiency bonus', prof, 'class', null),
    entry('WIS modifier', mod, 'base', null),
    ...buildTargetBonusEntries(allEffects, ['ki_save_dc']),
  ];
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
  const allEffects = collectAllEffects(entity);
  const effectiveStats = applyStatModifiers(entity.stats, allEffects);
  const mod     = modifier(effectiveStats[ability]);
  return [
    entry('Base', AC_DC_BASE, 'base', null),
    entry('Proficiency bonus', prof, 'class', null),
    entry(`${ability.toUpperCase()} modifier`, mod, 'base', null),
    // Effect-based bonuses (items/features granting +N to spell save DC).
    // recomputeDerived's own spellSaveDC accepts either target spelling
    // ('spell_save_dc'/'spellSaveDC') — this used to only ever emit the 3
    // entries above, silently dropping any such bonus from the breakdown
    // while it still correctly affected the real derived number.
    ...buildTargetBonusEntries(allEffects, ['spell_save_dc', 'spellSaveDC']),
  ];
}

// ── Spell Attack Bonus ────────────────────────────────────────────────────────

function buildSpellAttackEntries(entity: Entity): AuditEntry[] {
  if (!entity.spellcasting) return [];
  const prof    = proficiencyBonus(entity.identity.level);
  const ability = entity.spellcasting.ability;
  const allEffects = collectAllEffects(entity);
  const effectiveStats = applyStatModifiers(entity.stats, allEffects);
  const mod     = modifier(effectiveStats[ability]);
  return [
    entry('Proficiency bonus', prof, 'class', null),
    entry(`${ability.toUpperCase()} modifier`, mod, 'base', null),
    // Same effect-based-bonus gap as buildSpellSaveDcEntries above, for the
    // 'spell_attack_bonus'/'spellAttackBonus' target pair.
    ...buildTargetBonusEntries(allEffects, ['spell_attack_bonus', 'spellAttackBonus']),
  ];
}

// ── Shared: effect-based bonus entries for a stat_modifier target set ────────

/**
 * Per-source additive AuditEntry list for every stat_modifier effect
 * targeting any of `targets`, guaranteed to sum to exactly what
 * resolveCombine (the same function recomputeDerived's own acBonus/
 * spellSaveDC/spellAttackBonus bonuses are computed with) would produce for
 * that target. Plain 'add' effects each get their own line (the common
 * case, preserves per-source detail); any 'set'/'multiply' effects are
 * folded into one merged line, since no single line can represent a
 * multiplier's own contribution — this keeps the total always correct even
 * though no official content actually uses 'set'/'multiply' on these
 * targets today (homebrew can).
 */
function buildTargetBonusEntries(allEffects: ActiveEffect[], targets: string[]): AuditEntry[] {
  const entries: AuditEntry[] = [];
  for (const target of targets) {
    const relevant = allEffects.filter(ae => ae.effect.type === 'stat_modifier' && ae.effect.target === target);
    if (relevant.length === 0) continue;
    const addOnes = relevant.filter(ae => ae.effect.operation === 'add');
    const others  = relevant.filter(ae => ae.effect.operation !== 'add');
    for (const ae of addOnes) {
      entries.push(entry(ae.sourceName, ae.effect.value as number, ae.sourceKind ?? 'base', ae.sourceId));
    }
    if (others.length > 0) {
      const combined = resolveCombine(relevant);
      const addSum   = addOnes.reduce((s, ae) => s + (ae.effect.value as number), 0);
      const rep      = others[others.length - 1];
      entries.push(entry(`${rep.sourceName} (combined)`, combined - addSum, rep.sourceKind ?? 'base', rep.sourceId));
    }
  }
  return entries;
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
  const effectiveStats = effectiveAbilityScores(entity);
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

  const effectiveStats = effectiveAbilityScores(entity);
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
function appendDmOverrides(entity: Entity, stat: string, entries: AuditEntry[], calculated: number): number | null {
  let effective = calculated; let replacement: number | null = null;
  const layered=[...(entity.characterOverrides ?? []).map(o=>({ ...o, layer:'Character Override', kind:'character_override' as const })),...(entity.dmOverrides ?? []).map(o=>({ ...o, layer:'DM Override', kind:'dm_override' as const }))];
  for (const ov of layered.filter(o => o.active && o.stat === stat)) {
    if (ov.operation === 'set') { const from = effective; replacement = ov.value; effective = ov.value; entries.push({ label: ov.label ? ov.layer + ' — ' + ov.label : ov.layer, value: 0, sourceKind: ov.kind, sourceId: ov.id, replacement: { from, to: ov.value } }); }
    else { effective += ov.value; entries.push({ label: ov.layer + ' (add) — ' + ov.label, value: ov.value, sourceKind: ov.kind, sourceId: ov.id }); }
  }
  return replacement === null ? null : effective;
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
