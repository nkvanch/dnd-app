---
tags: [grimoire, engine]
type: "Engine"
source: "src/engine/rest.ts"
---

# rest

> **Engine**  ·  `src/engine/rest.ts`

Short and long rest recovery. A long rest fully restores HP, spell slots, and
resources marked full-on-long-rest. A short rest restores resources marked
short-rest and lets the player spend Hit Dice.

Reads the house rules (rest lengths, full-hit-dice-on-long-rest) so the
recovery behaviour matches the table's configured rules.

---

## Functions

### `discardHitDie(`

Player discards one hit die WITHOUT healing. Use when the player rolls
PHYSICAL dice and applies the healing themselves (the app's player-facing
resolution model) — this just decrements the remaining pool.

### `spendHitDie(`

── Short rest ────────────────────────────────────────────────────────────────
Short rest:
- Recharges resources tagged 'short_rest' or 'long_rest'.
- HP recovery via hit dice is player-initiated (call spendHitDie separately).
- Only Warlocks (Pact Magic) recover spell slots on short rest.
 
function shortRest(entity: Entity): Entity {
  const rechargedResources = entity.resources.custom.map(r => {
    if (r.recharge === 'short_rest' || r.recharge === 'long_rest') {
      return { ...r, current: r.maximum };
    }
    return r;
  });

  Only Warlocks recover spell slots on a short rest.
  All other spellcasting classes use long rest recovery.
  const isWarlock = entity.identity.classId === 'warlock';
  const rechargedSpellcasting = (entity.spellcasting && isWarlock)
    ? rechargeSlots(entity.spellcasting)
    : entity.spellcasting;

  return {
    ...entity,
    resources:    { ...entity.resources, custom: rechargedResources },
    spellcasting: rechargedSpellcasting,
  };
}

── Long rest ─────────────────────────────────────────────────────────────────
Long rest:
1. HP restored to maximum, temp HP cleared.
2. ALL resource pools recharged.
3. Hit dice partially restored (half level, minimum 1).
4. All spell slots restored.
5. Concentration dropped (can't concentrate while sleeping).
6. 'until_rest' conditions removed.
7. Exhaustion reduced by 1.
 
function longRest(entity: Entity, rules: CampaignRules = DEFAULT_RULES): Entity {
  let updated = entity;

  1. HP
  updated = {
    ...updated,
    resources: {
      ...updated.resources,
      hp: {
        current: updated.resources.hp.maximum,
        maximum: updated.resources.hp.maximum,
        temp:    0,
      },
    },
  };

  2. All custom resources
  updated = {
    ...updated,
    resources: {
      ...updated.resources,
      custom: updated.resources.custom.map(r => ({ ...r, current: r.maximum })),
    },
  };

  3. Hit dice. RAW restores half your level (rounded down, min 1). The
     'fullHitDiceOnLongRest' house rule restores the entire spent pool.
  const restoreCount = longRestRestoresAllHitDice(rules)
    ? updated.resources.hitDice.total
    : Math.max(1, Math.floor(updated.identity.level / 2));
  updated = {
    ...updated,
    resources: {
      ...updated.resources,
      hitDice: {
        ...updated.resources.hitDice,
        remaining: Math.min(
          updated.resources.hitDice.total,
          updated.resources.hitDice.remaining + restoreCount
        ),
      },
    },
  };

  4. Spell slots — long rest restores all slots for all spellcasting classes
  if (updated.spellcasting) {
    updated = {
      ...updated,
      spellcasting: rechargeSlots(updated.spellcasting),
    };
  }

  5. Drop concentration
  updated = dropConcentration(updated);

  6. Remove until_rest conditions
  const untilRestIds = updated.conditionMonitor.active
    .filter(c => c.duration?.unit === 'until_rest')
    .map(c => c.id);

  for (const id of untilRestIds) {
    updated = removeCondition(updated, id);
  }

  7. Reduce exhaustion by 1
  updated = reduceExhaustion(updated);

  return updated;
}

── Hit dice ──────────────────────────────────────────────────────────────────
Player spends one hit die during a short rest.
Rolls the die, adds CON modifier, heals the entity.
Minimum heal: 1. Cannot exceed maximum HP.

### `takeRest(`

── Entry point ───────────────────────────────────────────────────────────────

 Top-level rest dispatcher. Call this from the UI rest buttons.

---

## Imports

- [[src__engine__combat|combat]]  ·  `src/engine/combat.ts`
- [[src__engine__conditions|conditions]]  ·  `src/engine/conditions.ts`
- [[src__engine__houseRules|houseRules]]  ·  `src/engine/houseRules.ts`
- [[src__engine__pipeline|pipeline]]  ·  `src/engine/pipeline.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`
- [[src__store__characterStore|characterStore]]  ·  `src/store/characterStore.ts`

## Used by

- [[app__sheet__[id]|[id]]]  ·  `app/sheet/[id].tsx`
- [[src__components__sheet__TabCharacter|TabCharacter]]  ·  `src/components/sheet/TabCharacter.tsx`
- [[src__test-engine|test-engine]]  ·  `src/test-engine.ts`
