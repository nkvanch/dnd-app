// ============================================================================
// FILE: src/engine/resolver.ts
// PROJECT: Stacking Strategy & Conflict Overwrite Engine
// ============================================================================
import { 
  ActiveEffect, StrategyKind, CampaignRules, AdvantageState, 
  Effect, Entity, ChoiceState, ChoiceDefinition
} from './types';

/**
 * Maps attribute paths to their core evaluation strategy.
 * Directs incoming variables into the correct stacking math loop.
 */
const TARGET_STRATEGY: Record<string, StrategyKind> = {
  "ac": "stat_modifier",
  "str": "stat_modifier",
  "dex": "stat_modifier",
  "speed": "stat_modifier",
  "melee_damage": "stat_modifier",
  "spell_save_dc": "stat_modifier",
  "named_bonus.attacks": "named_bonus",
  "named_bonus.saves": "named_bonus",
  "named_bonus.checks": "named_bonus",
  "adv.attack_rolls": "advantage_track",
  "adv.str_checks": "advantage_track",
  "adv.dex_saves": "advantage_track",
  "temp_hp": "temp_hp",
  "base_ac_formula": "base_ac_formula",
};

/**
 * Inspects a dot-notated attribute target to determine its target strategy.
 * Defaults to 'stat_modifier' if no custom overrides match.
 */
export function classifyTarget(target: string): StrategyKind {
  return TARGET_STRATEGY[target] ?? "stat_modifier";
}

/**
 * Core Orchestrator routing an array of active effects into their specific
 * validation loops based on the target configuration path.
 */
export function resolveEffectsForTarget(target: string, effects: ActiveEffect[], rules: CampaignRules): number | AdvantageState {
  // CRITICAL: filter to only effects that target this specific stat before resolving.
  // Without this, resolveCombine sums ALL effects (e.g. all 6 Human +1 bonuses sum to +6 speed).
  const relevant = effects.filter(ae => ae.effect.target === target);
  const kind = classifyTarget(target);
  switch (kind) {
    case "advantage_track": return resolveBinary(relevant);
    case "temp_hp":         return resolveChooseMax(relevant);
    case "named_bonus":     return resolveSameName(relevant);
    default:                return resolveCombine(relevant);
  }
}

/**
 * Strategy 1: Combine Modifications
 * Handles 'set', 'add', and 'multiply' operations in three fixed phases —
 * base, then additive, then multiplicative — so the result never depends on
 * collectAllEffects's iteration order. Shuffling the input must never change
 * the result. Two separate order-dependencies were found and fixed here:
 *   1. Competing 'set' operations now resolve by highest value, not
 *      whichever happened to be last in the array (mirrors pipeline.ts's
 *      selectBestAcFormula's own "highest wins" tie-break for competing
 *      base-AC formulas — generalized here to every 'set'-strategy target).
 *   2. 'add' and 'multiply' are no longer folded together in a single
 *      left-to-right reduce (which is order-sensitive whenever a multiply
 *      and an add are interleaved in different array positions) — every
 *      'add' is summed first, then every 'multiply' is applied as one
 *      product to (base + addSum). Both phases are individually
 *      order-independent (sum/product are commutative), and running them
 *      in a fixed base→add→multiply sequence keeps the whole function that
 *      way too.
 */
export function resolveCombine(effects: ActiveEffect[]): number {
  let base = 0;
  let hasSet = false;
  let addSum = 0;
  let multiplyProduct = 1;
  let hasMultiply = false;
  for (const ae of effects) {
    const { operation, value } = ae.effect;
    if (typeof value !== 'number') continue;
    if (operation === 'set') {
      if (!hasSet || value > base) base = value;
      hasSet = true;
    } else if (operation === 'add') {
      addSum += value;
    } else if (operation === 'multiply') {
      multiplyProduct *= value;
      hasMultiply = true;
    }
  }
  const withAdditive = base + addSum;
  return hasMultiply ? withAdditive * multiplyProduct : withAdditive;
}

/**
 * Strategy 2: Same Name Rule Deduplication
 * Groups modifiers with matching source descriptions (e.g. two castings of "Bless").
 * Only the highest value is applied, using application timestamps as a tiebreaker.
 */
function resolveSameName(effects: ActiveEffect[]): number {
  const byName: Record<string, ActiveEffect[]> = {};
  
  // Group effects by their descriptor name keys
  effects.forEach(ae => {
    if (!byName[ae.sourceName]) byName[ae.sourceName] = [];
    byName[ae.sourceName].push(ae);
  });
  
  let total = 0;
  // Evaluate groups independently to locate and apply the single highest modifier
  for (const name in byName) {
    const group = byName[name];
    const winner = group.sort((a, b) => {
      const potencyDiff = potency(b.effect) - potency(a.effect);
      // Fallback to application order if potency matches exactly
      return potencyDiff !== 0 ? potencyDiff : b.appliedAt - a.appliedAt;
    })[0];
    total += winner.effect.value as number;
  }
  return total;
}

/** Utility metric extractor prioritizing value hierarchies within matching names. */
function potency(effect: Effect): number {
  if (effect.operation === "add" || effect.operation === "set") return effect.value as number;
  return 0;
}

/**
 * Strategy 3: Binary Advantage Evaluation
 * Processes boolean tracks. If advantage and disadvantage modifiers are present
 * simultaneously, they neutralize down to a straight check regardless of volume.
 */
export function resolveBinary(effects: ActiveEffect[]): AdvantageState {
  const hasAdv  = effects.some(ae => ae.effect.operation === "advantage");
  const hasDisadv = effects.some(ae => ae.effect.operation === "disadvantage");
  if (hasAdv && hasDisadv) return "straight";
  if (hasAdv)              return "advantage";
  if (hasDisadv)           return "disadvantage";
  return "straight";
}

/**
 * Strategy 4: Choose Maximum
 * Isolates and uses the single highest calculation pool (e.g. Temporary Hit Points).
 */
export function resolveChooseMax(effects: ActiveEffect[]): number {
  if (effects.length === 0) return 0;
  return Math.max(...effects.map(ae => ae.effect.value as number));
}

/**
 * Extra Attack Optimization Pipeline
 * Implements multiclassing overrides. Prevents multiple Extra Attack features
 * from stacking together, utilizing the highest maximum value instead.
 */
export function resolveExtraAttack(effects: ActiveEffect[]): number {
  const extraAttackEffects = effects.filter(ae => ae.effect.target === "extra_attack");
  if (extraAttackEffects.length === 0) return 0;
  return Math.max(0, ...extraAttackEffects.map(ae => ae.effect.value as number));
}

/**
 * Damage Interaction Evaluator
 * Balances resistances, immunities, and vulnerabilities. If matching resistance
 * and vulnerability flags target the same type, they neutralize each other.
 */
export function resolveResistance(damageType: string, effects: ActiveEffect[]): 'none' | 'resistance' | 'immunity' | 'vulnerability' {
  // Plain target match (e.g. 'fire', 'poison') — matches how every real
  // grant_resistance/grant_immunity effect is actually authored (see
  // src/content/races/index.ts, src/content/traitCompiler.ts), not a
  // 'damage_type.'-prefixed target that no content anywhere ever writes.
  const relevant = effects.filter(ae => ae.effect.target === damageType);
  
  // Total immunity overrides all other modifications
  if (relevant.some(ae => ae.effect.operation === "immunity")) return "immunity";
  
  const hasResist = relevant.some(ae => ae.effect.operation === "resistance");
  const hasVuln = relevant.some(ae => ae.effect.operation === "vulnerability");
  
  // Conflicting rules neutralize down to normal damage
  if (hasResist && hasVuln) return "none";
  if (hasResist) return "resistance";
  if (hasVuln) return "vulnerability";
  return "none";
}