// ============================================================================
// FILE: src/engine/hitDieTier.ts
// "Your Hit Die increases by one die size" (the Ballast species' Catastrophically Dense), as a
// derived effect on target 'hit_die_tier' (value = number of die steps).
//
// Design: STORED hit dice (entity.resources.hitDice.die / .pools[].die) are never touched. They
// stay the class's printed die, so every existing reader — level-up merging by die size, rest
// spending keyed by die size, saved characters — keeps working unchanged. The tier is applied at
// the two places it is observable:
//   1. the die ROLLED/DISPLAYED when a hit die is spent (rest.ts, the sheet), and
//   2. maximum HP, as part of the derived max-HP bonus recomputeDerived already reconciles
//      (pipeline.ts) — so it is retroactive for every level, picks up future levels
//      automatically (pools[].total grows with each level), and is removed with the feature.
//
// Per-class resolution ("resolve separately for each class") falls out for free: pools are
// keyed by the stored die, so a d12 Barbarian pool and a d6 Wizard pool are bumped independently,
// and two classes sharing a stored die behave identically (as they must).
//
// Pure — no imports from pipeline.ts, so pipeline.ts can use it without a cycle.
// ============================================================================
import { ActiveEffect, HitDiceBlock } from './types';
import { resolveEffectsForTarget } from './resolver';
import type { CampaignRules } from './types';

const MAX_DIE = 12;

/** Number of die-size steps the active effects grant (0 for nearly every character). */
export function hitDieTierFromEffects(effects: ActiveEffect[], rules: CampaignRules): number {
  return Math.max(0, Math.trunc(resolveEffectsForTarget('hit_die_tier', effects, rules) as number));
}

/** d6->d8->d10->d12, one step per tier. A d12 stays a d12 (see tierHpPerLevel for what it earns). */
export function bumpedHitDie(die: number, tier: number): number {
  let d = die;
  for (let i = 0; i < tier; i++) if (d < MAX_DIE) d += 2;
  return d;
}

/**
 * Extra maximum HP per level in a class whose stored die is `die`, for `tier` steps, using the
 * average-roll convention the rest of the engine uses (a die step of +2 faces is +1 on average).
 * A step taken at the d12 ceiling cannot raise the die, so it grants +3 HP per level instead.
 */
export function tierHpPerLevel(die: number, tier: number): number {
  let d = die;
  let hp = 0;
  for (let i = 0; i < tier; i++) {
    if (d < MAX_DIE) { d += 2; hp += 1; } else hp += 3;
  }
  return hp;
}

/** Total max-HP bonus across every hit-die pool (class-die group) the character has. */
export function tierHpBonus(hitDice: HitDiceBlock, tier: number): number {
  if (tier <= 0) return 0;
  const pools = hitDice.pools ?? (hitDice.total > 0 ? [{ die: hitDice.die, total: hitDice.total }] : []);
  return pools.reduce((sum, p) => sum + tierHpPerLevel(p.die, tier) * p.total, 0);
}
