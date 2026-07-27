---
tags: [grimoire, engine]
type: "Engine"
source: "src/engine/combat.ts"
---

# combat

> **Engine**  ·  `src/engine/combat.ts`

Combat resolution engine. Handles initiative rolling, turn sequencing, damage
application (with resistance/immunity), concentration checks, death save triggers,
and condition application / removal.

Does NOT store state — that lives in combatStore. This is a pure-ish module of
functions that take the current CombatState and return a new one.

---

## Types

### `CombatState`

Full snapshot of an active encounter: active boolean, the initiative order array, current round number, and the active turn index into the order.

### `InitiativeEntry`

One slot in the combat turn order: entityId, the rolled initiative value, and a tiebreaker. The initiative order is sorted descending by value.

## Functions

### `applyDamage(`

Applies damage to an entity: checks resistance / immunity from conditionMonitor, drains temp HP first, then reduces current HP. Returns updated entity.

### `applyHealing(`

Heals an entity, capped at maximum HP.

### `applyTempHP(`

Applies temporary HP.
Temp HP does not stack — keep whichever pool is larger.

### `castConcentrationSpell(`

Begins concentrating on a spell.
Applies any onConcentrationFeatures from the spell definition.
Tags them with source = { kind: 'spell', refId: spell.id }
so dropConcentration can cleanly remove them.
 
function beginConcentration(
  entity: Entity,
  spell:  Spell,
  rules:  CampaignRules
): Entity {
  const spellFeatures: FeatureInstance[] = (spell.onConcentrationFeatures ?? []).map(f => ({
    ...f,
    source:   { kind: 'spell' as const, refId: spell.id },
    level:    entity.identity.level,
    isActive: true,
  }));

  const updated = {
    ...entity,
    features: [...entity.features, ...spellFeatures],
    spellcasting: entity.spellcasting
      ? { ...entity.spellcasting, concentrating: spell.id }
      : null,
    conditionMonitor: {
      ...entity.conditionMonitor,
      flags: { ...entity.conditionMonitor.flags, concentrating: true },
    },
  };

  return recomputeDerived(updated, rules);
}
Cast a concentration spell.
Automatically drops the previous concentration before beginning the new one.
This is the Hex → Fly scenario: Hex drops silently, Fly takes over.

### `concentrationCheck(`

Rolls a CON saving throw when a concentrating caster takes damage. DC = max(10, damage / 2). Reads derived.savingThrows.con for the effective modifier (includes proficiency from Resilient feat). Grants advantage if the entity has the War Caster feat (feat_war_caster).

### `dropConcentration(entity: Entity): Entity`

── Concentration ─────────────────────────────────────────────────────────────
Drops the currently concentrated spell.
Removes all features tagged source.kind = 'spell' and source.refId = spellId.
Sets concentrating to null.
No-op if not concentrating.

### `endEncounter(combat: CombatState): CombatState`

Ends the encounter and resets combat state.

### `endTurn(`

Advances the active turn index, wrapping to the next round when the last combatant acts. Applies any end-of-turn condition ticks.

### `startEncounter(`

Rolls initiative for all combatants (1d20 + DEX modifier), sorts the order, and returns the initial CombatState with round 1 / turn 0.

---

## Imports

- [[src__engine__conditions|conditions]]  ·  `src/engine/conditions.ts`
- [[src__engine__dice|dice]]  ·  `src/engine/dice.ts`
- [[src__engine__pipeline|pipeline]]  ·  `src/engine/pipeline.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`
- [[src__store__characterStore|characterStore]]  ·  `src/store/characterStore.ts`

## Used by

- [[app__dm__character__[id]|[id]]]  ·  `app/dm/character/[id].tsx`
- [[app__dm__encounter|encounter]]  ·  `app/dm/encounter.tsx`
- [[app__sheet__[id]|[id]]]  ·  `app/sheet/[id].tsx`
- [[src__components__sheet__TabCharacter|TabCharacter]]  ·  `src/components/sheet/TabCharacter.tsx`
- [[src__db__combatRepo|combatRepo]]  ·  `src/db/combatRepo.ts`
- [[src__engine__rest|rest]]  ·  `src/engine/rest.ts`
- [[src__store__combatStore|combatStore]]  ·  `src/store/combatStore.ts`
- [[src__test-engine|test-engine]]  ·  `src/test-engine.ts`
