// ============================================================================
// FILE: src/engine/rest.ts
// PROJECT: Short Rest & Long Rest Recovery Engine
// ============================================================================
import { Entity, SpellcastingBlock, SpellSlots, CampaignRules, HitDiceBlock } from './types';
import { recomputeDerived, modifier, collectAllEffects, applyStatModifiers } from './pipeline';
import { removeCondition, reduceExhaustion } from './conditions';
import { dropConcentration } from './combat';
import { longRestRestoresAllHitDice } from './houseRules';
import { DEFAULT_RULES } from '../store/characterStore';
import { getClassLevels } from './multiclass';
import { pactSlotTableFor } from '../content/classes/spellSlotTables';

// ── Entry point ───────────────────────────────────────────────────────────────

/** Top-level rest dispatcher. Call this from the UI rest buttons. */
export function takeRest(
  entity: Entity,
  kind:   'short' | 'long',
  rules:  CampaignRules = DEFAULT_RULES
): Entity {
  const restored = kind === 'short' ? shortRest(entity) : longRest(entity, rules);
  return recomputeDerived(restored, rules);
}

// ── Short rest ────────────────────────────────────────────────────────────────

/**
 * Short rest:
 * - Recharges resources tagged 'short_rest' or 'long_rest'.
 * - HP recovery via hit dice is player-initiated (call spendHitDie separately).
 * - Only Warlocks (Pact Magic) recover spell slots on short rest.
 */
function shortRest(entity: Entity): Entity {
  // Re-audit A15: a short rest must restore ONLY 'short_rest'-tagged
  // resources. This used to also restore 'long_rest' resources (a long_rest
  // pool at 0/3 recovered to 3/3 on a mere short rest) — the reproduced bug.
  // 'dawn' and any free-text homebrew recharge string are genuinely
  // unsupported categories (this engine has no time-of-day/dawn clock) —
  // left untouched rather than silently mapped onto either rest policy.
  const rechargedResources = entity.resources.custom.map(r => {
    if (r.recharge === 'short_rest') {
      return { ...r, current: r.maximum };
    }
    return r;
  });

  // Only pact casters (Warlock, and the homebrew Blood Hunter Profane Soul
  // order / Abyss Knight, which reuse the same "pact magic" recharge rule)
  // recover spell slots on a short rest. All other spellcasting classes use
  // long rest recovery.
  const classes    = getClassLevels(entity);
  const isPactCaster = classes.some(c => pactSlotTableFor(c.classId, c.subclassId));
  const multiclassed = classes.length > 1;
  let rechargedSpellcasting = entity.spellcasting;
  if (entity.spellcasting && isPactCaster) {
    // Multiclassed with pact slots split out (see levelUpClass): recharge
    // ONLY the pact pool, leaving the combined non-pact `.slots` alone.
    // Solo pact caster (never multiclassed): pact slots live in `.slots`
    // directly, exactly as before this change — same recharge call.
    rechargedSpellcasting = (multiclassed && entity.spellcasting.pactSlots)
      ? rechargePactSlots(entity.spellcasting)
      : rechargeSlots(entity.spellcasting);
  }

  return {
    ...entity,
    resources:    { ...entity.resources, custom: rechargedResources },
    spellcasting: rechargedSpellcasting,
  };
}

// ── Long rest ─────────────────────────────────────────────────────────────────

/**
 * Long rest:
 * 1. HP restored to maximum, temp HP cleared.
 * 2. ALL resource pools recharged.
 * 3. Hit dice partially restored (half level, minimum 1).
 * 4. All spell slots restored.
 * 5. Concentration dropped (can't concentrate while sleeping).
 * 6. 'until_rest' conditions removed.
 * 7. Exhaustion reduced by 1.
 */
function longRest(entity: Entity, rules: CampaignRules = DEFAULT_RULES): Entity {
  let updated = entity;

  // 1. HP (and death saves — a long rest fully restores HP, which would
  //    clear death saves via applyHealing's own logic, but this path sets
  //    HP directly rather than going through applyHealing, so it needs its
  //    own explicit clear. This is also where the deathSavesPersist house
  //    rule's promised failures reset actually happens.)
  updated = {
    ...updated,
    resources: {
      ...updated.resources,
      hp: {
        current: updated.resources.hp.maximum,
        maximum: updated.resources.hp.maximum,
        temp:    0,
      },
      deathSaves: { successes: 0, failures: 0, stable: false },
    },
  };

  // 2. Custom resources — re-audit A15: a long rest restores 'short_rest'
  //    and 'long_rest' tagged resources (a long rest is a superset of a
  //    short rest's recovery), but must NOT blindly restore every resource
  //    regardless of its declared policy. 'never' stays spent; 'dawn' and
  //    any free-text homebrew recharge string are genuinely unsupported by
  //    this engine (no time-of-day clock) — left untouched rather than
  //    silently treated as long-rest recovery, per the same "disclose, don't
  //    fake" rule shortRest above now follows.
  updated = {
    ...updated,
    resources: {
      ...updated.resources,
      custom: updated.resources.custom.map(r =>
        (r.recharge === 'short_rest' || r.recharge === 'long_rest') ? { ...r, current: r.maximum } : r
      ),
    },
  };

  // 3. Hit dice. RAW restores half your level (rounded down, min 1). The
  //    'fullHitDiceOnLongRest' house rule restores the entire spent pool.
  const restoreCount = longRestRestoresAllHitDice(rules)
    ? updated.resources.hitDice.total
    : Math.max(1, Math.floor(updated.identity.level / 2));
  updated = {
    ...updated,
    resources: {
      ...updated.resources,
      hitDice: restoreHitDice(updated.resources.hitDice, restoreCount),
    },
  };

  // 4. Spell slots — long rest restores all slots for all spellcasting
  //    classes, INCLUDING pact slots (pact magic also refreshes on a long
  //    rest, not just short rest — it just doesn't NEED to wait for one).
  if (updated.spellcasting) {
    let sc = rechargeSlots(updated.spellcasting);
    if (sc.pactSlots) sc = rechargePactSlots(sc);
    updated = { ...updated, spellcasting: sc };
  }

  // 5. Drop concentration
  updated = dropConcentration(updated);

  // 6. Remove until_rest conditions
  const untilRestIds = updated.conditionMonitor.active
    .filter(c => c.duration?.unit === 'until_rest')
    .map(c => c.id);

  for (const id of untilRestIds) {
    updated = removeCondition(updated, id);
  }

  // 7. Reduce exhaustion by 1
  updated = reduceExhaustion(updated);

  return updated;
}

// ── Hit dice ──────────────────────────────────────────────────────────────────

/**
 * Picks a pool to spend one hit die from — largest die first. RAW lets the
 * player choose freely; this app has no "which die to spend" picker UI yet,
 * so largest-first is a reasonable, deterministic default that (unlike the
 * bug this replaces) always spends a die size the character actually owns.
 * No-op shape (single-pool / no `pools`) behaves exactly as before this fix.
 */
function spendFromHitDicePools(hitDice: HitDiceBlock): { die: number; hitDice: HitDiceBlock } {
  const { pools } = hitDice;
  if (!pools) {
    return { die: hitDice.die, hitDice: { ...hitDice, remaining: hitDice.remaining - 1 } };
  }
  const spendable = [...pools].filter(p => p.remaining > 0).sort((a, b) => b.die - a.die);
  const chosen = spendable[0];
  const die = chosen?.die ?? hitDice.die; // defensive fallback; remaining>0 guarantees a match in practice
  const nextPools = pools.map(p => p.die === die ? { ...p, remaining: p.remaining - 1 } : p);
  return {
    die,
    hitDice: { ...hitDice, remaining: hitDice.remaining - 1, pools: nextPools },
  };
}

/** Restores up to `count` hit dice, pool by pool (in the order each die size
 *  was first acquired) when the character has a mixed pool; a flat count
 *  restore otherwise — identical to the pre-fix behavior in that case. */
function restoreHitDice(hitDice: HitDiceBlock, count: number): HitDiceBlock {
  if (!hitDice.pools) {
    return { ...hitDice, remaining: Math.min(hitDice.total, hitDice.remaining + count) };
  }
  let toRestore = count;
  const nextPools = hitDice.pools.map(p => {
    if (toRestore <= 0) return p;
    const restore = Math.min(p.total - p.remaining, toRestore);
    toRestore -= restore;
    return { ...p, remaining: p.remaining + restore };
  });
  return {
    ...hitDice,
    remaining: nextPools.reduce((sum, p) => sum + p.remaining, 0),
    pools: nextPools,
  };
}

/**
 * Player spends one hit die during a short rest.
 * Rolls the die, adds CON modifier, heals the entity.
 * Minimum heal: 1. Cannot exceed maximum HP.
 */
export function spendHitDie(
  entity: Entity,
  rules:  CampaignRules = DEFAULT_RULES
): Entity {
  if (entity.resources.hitDice.remaining <= 0) return entity;

  const { die, hitDice } = spendFromHitDicePools(entity.resources.hitDice);
  const roll     = Math.floor(Math.random() * die) + 1;
  // Use effective CON (race/feat bonuses included), consistent with HP calc.
  const effectiveStats = applyStatModifiers(entity.stats, collectAllEffects(entity));
  const conMod   = modifier(effectiveStats.con);
  const heal     = Math.max(1, roll + conMod);

  const newCurrent = Math.min(
    entity.resources.hp.maximum,
    entity.resources.hp.current + heal
  );

  const updated = {
    ...entity,
    resources: {
      ...entity.resources,
      hp: { ...entity.resources.hp, current: newCurrent },
      hitDice,
    },
  };

  return recomputeDerived(updated, rules);
}

/**
 * Player discards one hit die WITHOUT healing. Use when the player rolls
 * PHYSICAL dice and applies the healing themselves (the app's player-facing
 * resolution model) — this just decrements the remaining pool.
 */
export function discardHitDie(
  entity: Entity,
  rules:  CampaignRules = DEFAULT_RULES
): Entity {
  if (entity.resources.hitDice.remaining <= 0) return entity;
  const { hitDice } = spendFromHitDicePools(entity.resources.hitDice);
  const updated = {
    ...entity,
    resources: {
      ...entity.resources,
      hitDice,
    },
  };
  return recomputeDerived(updated, rules);
}

// ── Spell slot helpers ────────────────────────────────────────────────────────

/** Restores all `.slots` used counts to 0 (called on short rest for a solo pact caster, long rest for all). */
function rechargeSlots(block: SpellcastingBlock): SpellcastingBlock {
  const tiers = ['1','2','3','4','5','6','7','8','9'] as const;
  const slots = { ...block.slots } as SpellSlots;
  for (const tier of tiers) {
    slots[tier] = { ...slots[tier], used: 0 };
  }
  return { ...block, slots };
}

/** Restores all `.pactSlots` used counts to 0. No-op if pactSlots is absent
 * (non-pact caster, or a solo pact caster whose slots live in `.slots`). */
function rechargePactSlots(block: SpellcastingBlock): SpellcastingBlock {
  if (!block.pactSlots) return block;
  const tiers = ['1','2','3','4','5','6','7','8','9'] as const;
  const pactSlots = { ...block.pactSlots } as SpellSlots;
  for (const tier of tiers) {
    pactSlots[tier] = { ...pactSlots[tier], used: 0 };
  }
  return { ...block, pactSlots };
}
