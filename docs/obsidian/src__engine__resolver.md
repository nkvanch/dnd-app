---
tags: [grimoire, engine]
type: "Engine"
source: "src/engine/resolver.ts"
---

# resolver

> **Engine**  ·  `src/engine/resolver.ts`

Low-level effect resolver. Given a list of Effect objects for a stat, combines
them in the right order: set operations first, then add, then advantage track.

Used internally by pipeline.ts — components never call this directly.

---

## Functions

### `classifyTarget(target: string): StrategyKind`

Maps attribute paths to their core evaluation strategy.
Directs incoming variables into the correct stacking math loop.
 
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
Inspects a dot-notated attribute target to determine its target strategy.
Defaults to 'stat_modifier' if no custom overrides match.

### `resolveChooseMax(effects: ActiveEffect[]): number`

Strategy 1: Combine Modifications
Handles 'set', 'add', and 'multiply' operations.
'set' operations are applied first (last-writer-wins as base).
'add' and 'multiply' stack on top of the set base (or 0 if no set).
 
function resolveCombine(effects: ActiveEffect[]): number {
  Collect 'set' operations first — last one becomes the base value
  let base = 0;
  for (const ae of effects) {
    if (ae.effect.operation === 'set' && typeof ae.effect.value === 'number') {
      base = ae.effect.value;
    }
  }
  'add' and 'multiply' stack on top of the base
  return effects.reduce((sum, ae) => {
    if (ae.effect.operation === 'add'      && typeof ae.effect.value === 'number')
      return sum + ae.effect.value;
    if (ae.effect.operation === 'multiply' && typeof ae.effect.value === 'number')
      return sum * ae.effect.value;
    return sum;
  }, base);
}
Strategy 2: Same Name Rule Deduplication
Groups modifiers with matching source descriptions (e.g. two castings of "Bless").
Only the highest value is applied, using application timestamps as a tiebreaker.
 
function resolveSameName(effects: ActiveEffect[]): number {
  const byName: Record<string, ActiveEffect[]> = {};
  
  Group effects by their descriptor name keys
  effects.forEach(ae => {
    if (!byName[ae.sourceName]) byName[ae.sourceName] = [];
    byName[ae.sourceName].push(ae);
  });
  
  let total = 0;
  Evaluate groups independently to locate and apply the single highest modifier
  for (const name in byName) {
    const group = byName[name];
    const winner = group.sort((a, b) => {
      const potencyDiff = potency(b.effect) - potency(a.effect);
      Fallback to application order if potency matches exactly
      return potencyDiff !== 0 ? potencyDiff : b.appliedAt - a.appliedAt;
    })[0];
    total += winner.effect.value as number;
  }
  return total;
}

 Utility metric extractor prioritizing value hierarchies within matching names. 
function potency(effect: Effect): number {
  if (effect.operation === "add" || effect.operation === "set") return effect.value as number;
  return 0;
}
Strategy 3: Binary Advantage Evaluation
Processes boolean tracks. If advantage and disadvantage modifiers are present
simultaneously, they neutralize down to a straight check regardless of volume.
 
function resolveBinary(effects: ActiveEffect[]): AdvantageState {
  const hasAdv  = effects.some(ae => ae.effect.operation === "advantage");
  const hasDisadv = effects.some(ae => ae.effect.operation === "disadvantage");
  if (hasAdv && hasDisadv) return "straight";
  if (hasAdv)              return "advantage";
  if (hasDisadv)           return "disadvantage";
  return "straight";
}
Strategy 4: Choose Maximum
Isolates and uses the single highest calculation pool (e.g. Temporary Hit Points).

### `resolveEffectsForTarget(target: string, effects: ActiveEffect[], rules: CampaignRules): number | AdvantageState`

Core Orchestrator routing an array of active effects into their specific
validation loops based on the target configuration path.

### `resolveExtraAttack(effects: ActiveEffect[]): number`

Extra Attack Optimization Pipeline
Implements multiclassing overrides. Prevents multiple Extra Attack features
from stacking together, utilizing the highest maximum value instead.

### `resolveResistance(damageType: string, effects: ActiveEffect[]): 'none' | 'resistance' | 'immunity' | 'vulnerability'`

Damage Interaction Evaluator
Balances resistances, immunities, and vulnerabilities. If matching resistance
and vulnerability flags target the same type, they neutralize each other.

---

## Imports

- [[src__engine__types|types]]  ·  `src/engine/types.ts`

## Used by

- [[src__engine__pipeline|pipeline]]  ·  `src/engine/pipeline.ts`
