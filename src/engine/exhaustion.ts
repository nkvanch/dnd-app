// ============================================================================
// FILE: src/engine/exhaustion.ts
// Exhaustion under both rule sets. The 2014 rules have six tiers of effects; the 2024 rules (System Reference Document
// 5.2.1, "Rules Glossary", Exhaustion) make it cumulative: each level lowers every D20 Test by 2 and Speed by 5 feet, and level 6
// is death. Only the Speed reduction is a derived number here (the app does not resolve rolls, so the D20 Test penalty is shown
// as text); the 2014 tiers stay descriptive, as they were.
// ============================================================================
import type { Entity } from './types';

const RULESET_2024 = 'dnd5e-2024';

export function usesCumulativeExhaustion(entity: Pick<Entity, 'rulesetId'>): boolean {
  return (entity.rulesetId as string | undefined) === RULESET_2024;
}

/** Feet taken off Speed by Exhaustion: 5 per level under the 2024 rules, nothing computed under the 2014 tiers. */
export function exhaustionSpeedPenalty(entity: Pick<Entity, 'rulesetId' | 'conditionMonitor'>): number {
  return usesCumulativeExhaustion(entity) ? 5 * Math.max(0, entity.conditionMonitor?.exhaustion ?? 0) : 0;
}

const TIERS_2014: Record<number, string> = {
  1: 'Disadvantage on ability checks',
  2: 'Speed halved',
  3: 'Disadvantage on attacks and saving throws',
  4: 'Hit point maximum halved',
  5: 'Speed reduced to 0',
  6: 'Death',
};

/** What the sheet shows for an Exhaustion level. */
export function exhaustionEffectText(level: number, entity: Pick<Entity, 'rulesetId'>): string {
  if (!usesCumulativeExhaustion(entity)) return TIERS_2014[level] ?? '';
  if (level >= 6) return 'Death';
  return `D20 Tests −${2 * level}, Speed −${5 * level} ft. A Long Rest removes 1 level.`;
}
