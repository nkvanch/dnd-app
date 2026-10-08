// ============================================================================
// FILE: src/engine/heroicInspiration.ts
// Heroic Inspiration (2024 rules / 5.5e, System Reference Document 5.2.1, Creative Commons Attribution 4.0).
//   Spend:  expend it to reroll any die immediately after rolling it; you must use the new roll.
//   Only one: a character can never have more than one. If something gives it to you while you already have
//             it, it is lost unless you give it to a player character in your group who lacks it.
//   Gain:   the GM awards it; some features grant it: Human's Resourceful (every Long Rest, an effect on the
//           feature, `heroic_inspiration_on_long_rest`) and Champion's Heroic Warrior (at the start of a turn
//           in combat, from the sheet's Gain button).
// It is a first-class bit of character state (`Entity.heroicInspiration`), not a counted resource, so the
// "never more than one" rule cannot be broken by a resource's maximum being edited.
// ============================================================================
import { Entity } from './types';

export const HEROIC_ON_LONG_REST = 'heroic_inspiration_on_long_rest';

export const hasHeroicInspiration = (e: Entity): boolean => e.heroicInspiration === true;

export type GainResult = {
  entity: Entity;
  /** True when the character already had it: this one is lost unless the player gives it to a party member who lacks it. */
  overflow: boolean;
};

/** Gains Heroic Inspiration. Never stacks: gaining it while holding it changes nothing and reports the overflow. */
export function gainHeroicInspiration(e: Entity): GainResult {
  if (hasHeroicInspiration(e)) return { entity: e, overflow: true };
  return { entity: { ...e, heroicInspiration: true }, overflow: false };
}

/** Expends it (to reroll a die, or to hand it to another player's character). A no-op when there is none. */
export function spendHeroicInspiration(e: Entity): Entity {
  if (!hasHeroicInspiration(e)) return e;
  return { ...e, heroicInspiration: false };
}

/** True when a feature of this character (Human's Resourceful) restores Heroic Inspiration on a Long Rest. */
export function grantsHeroicInspirationOnLongRest(e: Entity): boolean {
  return e.features.some(f => (f.effects ?? []).some(fx => fx.target === HEROIC_ON_LONG_REST && fx.operation === 'set' && !!fx.value));
}

/** Applies the Long Rest part of the rules; call from the rest engine. */
export function applyLongRestHeroicInspiration(e: Entity): Entity {
  return grantsHeroicInspirationOnLongRest(e) ? gainHeroicInspiration(e).entity : e;
}
