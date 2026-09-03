---
tags: [grimoire, engine]
type: "Engine"
source: "src/engine/dice.ts"
---

# dice

> **Engine**  ·  `src/engine/dice.ts`

Dice rolling utilities. rollExpression parses and evaluates dice strings like
"2d6+3" or "4d6kh3" (keep highest 3). Returns a DiceRoll with the total,
individual rolls, modifier, and an optional label.

Used directly by the GlobalDiceRoller and by engine functions that need
randomness (initiative, rolled HP on level-up, death saves).

---

## Functions

### `averageRoll(expression: string): number`

── Utility ───────────────────────────────────────────────────────────────────

 Returns a random 8-character alphanumeric ID. 
function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}
Returns the average result of a dice expression (for "fixed HP" mode).
"1d8+3" → 7.5 (floor to 7 in practice, but we return the raw float here).

### `rollAbilityScore(): DiceRoll`

── Batch helpers ─────────────────────────────────────────────────────────────

 Rolls 4d6 and keeps the highest 3 — standard ability score method.

### `rollAbilityScoreSet(): number[]`

Rolls a full set of 6 ability scores using 4d6kh3.

### `rollD20(modifier`

Rolls a d20 with an optional modifier.

### `rollDie(sides: number): number`

── Seeding ───────────────────────────────────────────────────────────────────
Replaceable random source. Default: Math.random().
Override in tests: setRandomSource(() => 0.5)
 
let randomSource: () => number = Math.random;
export function setRandomSource(fn: () => number): void { randomSource = fn; }

 Rolls a single die with n sides. Returns 1..n inclusive.

### `rollExpression(expression: string, label?: string): DiceRoll`

Parses and evaluates a dice expression string ("2d6+3", "4d6kh3", "1d20-1"). Returns a DiceRoll with total, individual rolls array, modifier, optional label, and a unique id used by diceLogStore to detect new rolls.

### `rollWithAdvantage(modifier`

Rolls with advantage: two d20s, returns the higher.

### `rollWithDisadvantage(modifier`

Rolls with disadvantage: two d20s, returns the lower.

---

## Imports

- [[src__engine__types|types]]  ·  `src/engine/types.ts`

## Used by

- [[app__tabs__index|(tabs)]]  ·  `app/(tabs)/index.tsx`
- [[app__creation__scores|scores]]  ·  `app/creation/scores.tsx`
- [[src__components__sheet__TabActions|TabActions]]  ·  `src/components/sheet/TabActions.tsx`
- [[src__components__sheet__TabCharacter|TabCharacter]]  ·  `src/components/sheet/TabCharacter.tsx`
- [[src__components__sheet__TabSpells|TabSpells]]  ·  `src/components/sheet/TabSpells.tsx`
- [[src__engine__combat|combat]]  ·  `src/engine/combat.ts`
- [[src__engine__monsterFactory|monsterFactory]]  ·  `src/engine/monsterFactory.ts`
- [[src__store__diceLogStore|diceLogStore]]  ·  `src/store/diceLogStore.ts`
