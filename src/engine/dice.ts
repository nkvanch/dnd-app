// ============================================================================
// FILE: src/engine/dice.ts
// PROJECT: Dice Expression Parser & Roller
//
// Supports standard D&D notation:
//   "1d20"        — single die
//   "2d6+3"       — multiple dice with flat modifier
//   "1d20-2"      — negative modifier
//   "4d6kh3"      — roll 4d6, keep highest 3 (ability score generation)
//   "4d6kl3"      — roll 4d6, keep lowest 3
//   "8"           — flat number (no die)
//
// All randomness flows through rollDie() so it can be seeded for tests.
// ============================================================================

import { DiceRoll } from './types';

// ── Seeding ───────────────────────────────────────────────────────────────────

/**
 * Replaceable random source. Default: Math.random().
 * Override in tests: setRandomSource(() => 0.5)
 */
let randomSource: () => number = Math.random;
export function setRandomSource(fn: () => number): void { randomSource = fn; }

/** Rolls a single die with n sides. Returns 1..n inclusive. */
export function rollDie(sides: number): number {
  return Math.floor(randomSource() * sides) + 1;
}

// ── Main API ──────────────────────────────────────────────────────────────────

/**
 * Parses and resolves a dice expression.
 * Throws a descriptive error if the expression is not recognised.
 *
 * @param expression  Dice notation string e.g. "2d6+3"
 * @param label       Optional label for the roll log e.g. "Attack roll"
 */
export function rollExpression(expression: string, label?: string): DiceRoll {
  const clean = expression.toLowerCase().replace(/\s/g, '');

  // ── 4d6kh3 / 4d6kl3 (keep highest / keep lowest) ────────────────────────
  const keepMatch = clean.match(/^(\d+)d(\d+)k([hl])(\d+)([+-]\d+)?$/);
  if (keepMatch) {
    const count    = parseInt(keepMatch[1], 10);
    const sides    = parseInt(keepMatch[2], 10);
    const keepDir  = keepMatch[3] as 'h' | 'l';
    const keepN    = parseInt(keepMatch[4], 10);
    const flatMod  = keepMatch[5] ? parseInt(keepMatch[5], 10) : 0;

    const allRolls = Array.from({ length: count }, () => rollDie(sides));
    const sorted   = [...allRolls].sort((a, b) => b - a);   // descending
    const kept     = keepDir === 'h' ? sorted.slice(0, keepN) : sorted.slice(-keepN);
    const total    = kept.reduce((s, r) => s + r, 0) + flatMod;

    return {
      id: uid(), expression,
      rolls: kept, modifier: flatMod, total,
      label: label ?? null, timestamp: Date.now(),
    };
  }

  // ── Standard: 2d6+3 / 1d20 / 2d6-1 ─────────────────────────────────────
  const stdMatch = clean.match(/^(\d+)d(\d+)([+-]\d+)?$/);
  if (stdMatch) {
    const count   = parseInt(stdMatch[1], 10);
    const sides   = parseInt(stdMatch[2], 10);
    const flatMod = stdMatch[3] ? parseInt(stdMatch[3], 10) : 0;

    const rolls = Array.from({ length: count }, () => rollDie(sides));
    const total = rolls.reduce((s, r) => s + r, 0) + flatMod;

    return {
      id: uid(), expression,
      rolls, modifier: flatMod, total,
      label: label ?? null, timestamp: Date.now(),
    };
  }

  // ── Flat number: "8" ─────────────────────────────────────────────────────
  const flat = parseInt(clean, 10);
  if (!isNaN(flat)) {
    return {
      id: uid(), expression,
      rolls: [flat], modifier: 0, total: flat,
      label: label ?? null, timestamp: Date.now(),
    };
  }

  throw new Error(`Cannot parse dice expression: "${expression}"`);
}

/**
 * Builds a DiceRoll from a hand-entered total instead of rolling — for a
 * player rolling physical dice at a real table. Recovers the flat modifier
 * from the expression's trailing signed integer (the same shape every
 * notation branch above already parses via `([+-]\d+)?$`), so a manual
 * result's rolls/modifier breakdown renders identically to a digital one's.
 */
export function manualRoll(expression: string, enteredTotal: number, label?: string): DiceRoll {
  const clean = expression.toLowerCase().replace(/\s/g, '');
  const modMatch = clean.match(/([+-]\d+)$/);
  const modifier = modMatch ? parseInt(modMatch[1], 10) : 0;
  return {
    id: uid(), expression,
    rolls: [enteredTotal - modifier], modifier, total: enteredTotal,
    label: label ?? null, timestamp: Date.now(),
  };
}

// ── Batch helpers ─────────────────────────────────────────────────────────────

/** Rolls 4d6 and keeps the highest 3 — standard ability score method. */
export function rollAbilityScore(): DiceRoll {
  return rollExpression('4d6kh3', 'Ability score');
}

/** Rolls a full set of 6 ability scores using 4d6kh3. */
export function rollAbilityScoreSet(): number[] {
  return Array.from({ length: 6 }, () => rollAbilityScore().total);
}

/** Rolls a d20 with an optional modifier. */
export function rollD20(modifier = 0, label?: string): DiceRoll {
  const expr = modifier === 0 ? '1d20' : modifier > 0 ? `1d20+${modifier}` : `1d20${modifier}`;
  return rollExpression(expr, label);
}

/** Rolls with advantage: two d20s, returns the higher. */
export function rollWithAdvantage(modifier = 0, label?: string): DiceRoll {
  const a = rollD20(modifier);
  const b = rollD20(modifier);
  const winner = a.total >= b.total ? a : b;
  return { ...winner, label: label ?? 'Advantage', expression: `2d20kh1${modifier !== 0 ? (modifier > 0 ? `+${modifier}` : modifier) : ''}` };
}

/** Rolls with disadvantage: two d20s, returns the lower. */
export function rollWithDisadvantage(modifier = 0, label?: string): DiceRoll {
  const a = rollD20(modifier);
  const b = rollD20(modifier);
  const loser = a.total <= b.total ? a : b;
  return { ...loser, label: label ?? 'Disadvantage', expression: `2d20kl1${modifier !== 0 ? (modifier > 0 ? `+${modifier}` : modifier) : ''}` };
}

/**
 * Doubles the DICE portion of a damage expression for a critical hit —
 * "2d6+4" → "4d6+4", "1d8" → "2d8" — leaving the flat modifier untouched,
 * per the real 5e rule (roll extra dice, don't double the total). Works on
 * the standard "NdX(+/-M)" and keep-highest/lowest "NdXkhY(+/-M)" shapes
 * rollExpression itself already parses; returns the expression unchanged
 * (not thrown) if it doesn't match either, since a caller can always just
 * not double an expression it doesn't recognise as dice-shaped.
 */
export function doubleDiceCount(expression: string): string {
  const clean = expression.toLowerCase().replace(/\s/g, '');
  const keepMatch = clean.match(/^(\d+)(d\d+k[hl]\d+(?:[+-]\d+)?)$/);
  if (keepMatch) return `${parseInt(keepMatch[1], 10) * 2}${keepMatch[2]}`;
  const stdMatch = clean.match(/^(\d+)(d\d+(?:[+-]\d+)?)$/);
  if (stdMatch) return `${parseInt(stdMatch[1], 10) * 2}${stdMatch[2]}`;
  return expression;
}

// ── Utility ───────────────────────────────────────────────────────────────────

/** Returns a random 8-character alphanumeric ID. */
function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Returns the average result of a dice expression (for "fixed HP" mode).
 * "1d8+3" → 7.5 (floor to 7 in practice, but we return the raw float here).
 */
export function averageRoll(expression: string): number {
  const clean = expression.toLowerCase().replace(/\s/g, '');

  const stdMatch = clean.match(/^(\d+)d(\d+)([+-]\d+)?$/);
  if (stdMatch) {
    const count   = parseInt(stdMatch[1], 10);
    const sides   = parseInt(stdMatch[2], 10);
    const flatMod = stdMatch[3] ? parseInt(stdMatch[3], 10) : 0;
    return count * (sides + 1) / 2 + flatMod;
  }

  const flat = parseInt(clean, 10);
  if (!isNaN(flat)) return flat;

  throw new Error(`Cannot compute average for: "${expression}"`);
}
