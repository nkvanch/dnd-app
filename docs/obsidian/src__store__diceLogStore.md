---
tags: [grimoire, store]
type: "Store"
source: "src/store/diceLogStore.ts"
---

# diceLogStore

> **Store**  ·  `src/store/diceLogStore.ts`

Shared dice-roll history (capped at 20 entries). Both the GlobalDiceRoller and
the exploration tab's tap-to-roll skill checks write here. The roller subscribes
and auto-opens when a new roll arrives from outside it.

---

## Constants

### `useDiceLogStore`

Zustand store with three actions: pushRoll (log a pre-computed DiceRoll), rollAndLog (roll an expression string + push result), clear. History is capped at 20 entries. The GlobalDiceRoller auto-opens when a new roll id appears.

---

## Imports

- [[src__engine__dice|dice]]  ·  `src/engine/dice.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`

## Used by

- [[src__components__GlobalDiceRoller|GlobalDiceRoller]]  ·  `src/components/GlobalDiceRoller.tsx`
- [[src__components__sheet__TabExploration|TabExploration]]  ·  `src/components/sheet/TabExploration.tsx`
