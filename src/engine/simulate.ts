// src/engine/simulate.ts
// Generic before/after/diff preview primitive. Lets UI code show a player
// what a mutation (rest, feat grant, equip, ...) will actually do before
// they commit to it, reusing the engine's own pure recompute pipeline and
// the diffing utility already built for LAN sync (src/sync/diff.ts).
import { Entity, CampaignRules } from './types';
import { recomputeDerived } from './pipeline';
import { deepDiff } from '../sync/diff';
import { DEFAULT_RULES } from '../store/characterStore';

export type SimulationResult = {
  before: Entity;
  after:  Entity;
  diff:   unknown; // deepDiff(before, after) — whole entity, not just .derived
};

/**
 * Runs `mutator` against a scratch clone of `entity` and returns the
 * before/after entities plus a deep diff, without touching `entity` itself
 * or any store. `before`/`after` are both freshly recomputed so callers
 * never need to know whether `mutator` already recomputes internally.
 *
 * CAUTION: if `mutator` uses randomness (e.g. levelUp's rolled-HP mode),
 * the previewed `after` will NOT match what a second, real call to the
 * same mutator produces. Only use simulate() with deterministic mutators
 * until a seeded/fixed-roll variant exists for the random ones.
 */
export function simulate(
  entity:  Entity,
  mutator: (e: Entity) => Entity,
  rules:   CampaignRules = DEFAULT_RULES
): SimulationResult {
  const before = recomputeDerived(entity, rules);
  const after  = recomputeDerived(mutator(before), rules);
  return { before, after, diff: deepDiff(before, after) };
}
