// ============================================================================
// FILE: src/engine/rest.ts
// PROJECT: Short Rest & Long Rest Recovery Engine
// ============================================================================
import { Entity, SpellcastingBlock, SpellSlots, CampaignRules, HitDiceBlock, HitDicePool } from './types';
import { recomputeDerived, modifier, collectAllEffects, applyStatModifiers } from './pipeline';
import { removeCondition, reduceExhaustion } from './conditions';
import { dropConcentration } from './combat';
import { longRestRestoresAllHitDice } from './houseRules';
import { DEFAULT_RULES } from '../store/characterStore';
import { getClassLevels } from './multiclass';
import { pactSlotTableFor } from '../content/classes/spellSlotTables';

// ── Entry point ───────────────────────────────────────────────────────────────

/**
 * Top-level rest dispatcher. Call this from the UI rest buttons.
 *
 * `hitDiceAllocation` (rules-completeness batch, long-rest recovery) — only
 * meaningful for `kind: 'long'`; ignored for a short rest, which never
 * restores hit dice at all. The caller (UI) is expected to call
 * hitDiceRecoveryNeedsAllocation FIRST, collect this from the player only
 * when it says a real choice exists, and call takeRest exactly once with
 * the final decision already made — see longRest's own doc comment for why
 * that ordering is what keeps this atomic.
 */
/** True when the character has at least one resource that recharges at dawn and is not full. */
export function hasSpentDawnResources(entity: Entity): boolean {
  return entity.resources.custom.some(r => r.recharge === 'dawn' && r.current < r.maximum);
}

/**
 * The explicit "a new day begins" event: refills every resource tagged recharge:'dawn' (a magic
 * item's "regains charges at dawn", a homebrew "1/day" ability that renews at dawn). It is
 * deliberately NOT part of a long rest — the app has no clock, so the player says when the day turns
 * — and it changes nothing else (no HP, slots or hit dice). Resources tagged short_rest, long_rest,
 * never, or free text are untouched.
 */
export function takeDawn(entity: Entity, rules: CampaignRules = DEFAULT_RULES): Entity {
  if (!hasSpentDawnResources(entity)) return entity;
  const refreshed: Entity = {
    ...entity,
    resources: {
      ...entity.resources,
      custom: entity.resources.custom.map(r => (r.recharge === 'dawn' ? { ...r, current: r.maximum } : r)),
    },
  };
  return recomputeDerived(refreshed, rules);
}

export function takeRest(
  entity: Entity,
  kind:   'short' | 'long',
  rules:  CampaignRules = DEFAULT_RULES,
  hitDiceAllocation?: HitDiceRecoveryAllocation,
): Entity {
  const restored = kind === 'short' ? shortRest(entity) : longRest(entity, rules, hitDiceAllocation);
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
  // 'dawn' is NOT a rest: it is refilled only by the explicit takeDawn() event
  // below (the sheet's ☀ Dawn button). Free-text homebrew recharge strings
  // ("per encounter", …) have no event the app can detect, so they are
  // restored manually with the + control. Neither is silently mapped onto
  // either rest policy.
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
 *
 * Rules-completeness batch (long-rest recovery), HIGH-fix closure, B7/B8:
 * `hitDiceAllocation`, when the recovery genuinely needs one (see
 * hitDiceRecoveryNeedsAllocation), is the player's OWN choice of which
 * expended pools receive the (unchanged) recovery budget — TABLE-FIRST,
 * never a largest/smallest/acquisition-order default. Omitting it when a
 * choice IS required, or supplying an invalid one (see restoreHitDice's own
 * doc comment for exactly what "invalid" means), refuses the ENTIRE long
 * rest atomically (returns `entity` unchanged) rather than applying HP/
 * resource/slot recovery while leaving hit dice unresolved — the caller
 * (UI) is expected to determine whether a choice is needed and collect it
 * BEFORE calling takeRest at all, exactly once, so a synchronous, single-
 * pass function like this one is never left partially applied.
 */
function longRest(entity: Entity, rules: CampaignRules = DEFAULT_RULES, hitDiceAllocation?: HitDiceRecoveryAllocation): Entity {
  // Rules-completeness batch (long-rest recovery), HIGH-fix closure, B5/B8:
  // checked FIRST, before any other rest consequence is computed — a
  // required-but-missing-or-invalid allocation refuses the whole rest with
  // zero mutation, never a half-applied one (HP/resources/slots restored
  // while hit dice silently keep their old, wrong-order recovery). An
  // explicitly SUPPLIED allocation is validated unconditionally (B5: "do
  // not trust UI alone"), even when hitDiceRecoveryNeedsAllocation would
  // say no real choice existed (e.g. a high-level character whose budget
  // covers every expended die) — a caller passing a garbage allocation in
  // that case must still be refused, never silently ignored/over-applied.
  const restoreCount = hitDiceRecoveryBudget(entity, rules);
  if (hitDiceAllocation) {
    if (!validateHitDiceAllocation(entity.resources.hitDice, restoreCount, hitDiceAllocation)) return entity;
  } else if (hitDiceRecoveryNeedsAllocation(entity, rules)) {
    return entity; // a real choice exists and none was supplied
  }

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
  //    regardless of its declared policy. 'never' stays spent; 'dawn' is
  //    refilled only by takeDawn() (a long rest is not a new day), and any
  //    free-text homebrew recharge string is restored manually — none is
  //    silently treated as long-rest recovery, per the same "disclose, don't
  //    fake" rule shortRest above follows.
  updated = {
    ...updated,
    resources: {
      ...updated.resources,
      custom: updated.resources.custom.map(r =>
        (r.recharge === 'short_rest' || r.recharge === 'long_rest') ? { ...r, current: r.maximum } : r
      ),
    },
  };

  // 3. Hit dice. RAW restores half your level (rounded down, min 1) — see
  //    hitDiceRecoveryBudget's own doc comment; UNCHANGED by this batch.
  //    'fullHitDiceOnLongRest' house rule restores the entire spent pool.
  //    Allocation (validated above, if it was supplied) decides WHICH pools
  //    receive it; the single/full-cover fast path (no allocation) keeps
  //    the exact pre-existing deterministic pool-order behavior — see
  //    restoreHitDice's own doc comment. Reuses the SAME `restoreCount`
  //    already computed (and validated against) above — `updated` hasn't
  //    touched `identity.level` by this point, so recomputing it against
  //    `entity` vs `updated` can never disagree.
  updated = {
    ...updated,
    resources: {
      ...updated.resources,
      hitDice: restoreHitDice(updated.resources.hitDice, restoreCount, hitDiceAllocation),
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
 * Rules-completeness batch (mixed hit-die pools), C2/C4: every spendable
 * (remaining > 0) pool, largest die first — purely a read, used by the UI
 * to render an explicit picker when 2+ distinct die sizes are actually
 * spendable right now. A single-pool character (no `pools`, or every other
 * pool already at 0) gets exactly one entry back, so callers can treat
 * "only one spendable option" and "explicit choice needed" uniformly.
 */
export function spendableHitDicePools(hitDice: HitDiceBlock): HitDicePool[] {
  if (!hitDice.pools) {
    return hitDice.remaining > 0 ? [{ die: hitDice.die, total: hitDice.total, remaining: hitDice.remaining }] : [];
  }
  return [...hitDice.pools].filter(p => p.remaining > 0).sort((a, b) => b.die - a.die);
}

/**
 * Rules-completeness batch (mixed hit-die pools), C2: resolves WHICH pool
 * one hit-die spend actually draws from. `dieSize`, when given, must name a
 * currently-spendable pool exactly — an unrecognized or already-exhausted
 * die size refuses (returns null) rather than silently falling back to a
 * different one, the same "never silently substitute" rule this app applies
 * everywhere else a caller can name an exact target. Omitting `dieSize` is
 * only ever safe when there's nothing to choose between (0 or 1 spendable
 * pool) — with 2+ genuinely spendable die sizes, this refuses rather than
 * auto-picking largest/smallest (the exact bug this batch fixes; the OLD
 * behavior — largest die first — is preserved ONLY as a fallback for a
 * single-pool character, where there's no real ambiguity to begin with).
 */
function spendFromHitDicePools(hitDice: HitDiceBlock, dieSize?: number): { die: number; hitDice: HitDiceBlock } | null {
  const spendable = spendableHitDicePools(hitDice);
  if (spendable.length === 0) return null;
  const die = dieSize !== undefined
    ? (spendable.some(p => p.die === dieSize) ? dieSize : null)
    : (spendable.length === 1 ? spendable[0].die : null);
  if (die === null) return null;
  if (!hitDice.pools) {
    return { die, hitDice: { ...hitDice, remaining: hitDice.remaining - 1 } };
  }
  const nextPools = hitDice.pools.map(p => p.die === die ? { ...p, remaining: p.remaining - 1 } : p);
  return {
    die,
    hitDice: { ...hitDice, remaining: hitDice.remaining - 1, pools: nextPools },
  };
}

/**
 * Rules-completeness batch (long-rest recovery), HIGH-fix closure, B4:
 * the player's own choice of how many of EACH expended die size to
 * recover this long rest — transient long-rest input only, never persisted
 * on the character (the resulting pool state is, via the normal
 * post-rest entity, exactly like every other rest consequence).
 */
export type HitDiceRecoveryAllocation = { dieSize: number; recover: number }[];

/**
 * Rules-completeness batch (long-rest recovery), B5: true only when
 * `allocation` is entirely legal against `hitDice` and `budget` — every
 * check below is a hard reject (false), never a silent clamp/repair, same
 * "never trust unvalidated input, never partially apply" convention this
 * app uses everywhere else an explicit target/allocation can be named
 * (e.g. hydrateLegacyItemInstanceIds' own supplied-vs-missing distinction).
 * Rejects when: the total recovered exceeds `budget`; any entry is
 * negative; a named die size doesn't exist on this HitDiceBlock; an entry
 * asks to recover more than that pool's OWN currently-expended count; or
 * the same die size appears more than once (ambiguous — which entry wins
 * is not this function's call to make).
 */
function validateHitDiceAllocation(hitDice: HitDiceBlock, budget: number, allocation: HitDiceRecoveryAllocation): boolean {
  const pools = hitDice.pools ?? [{ die: hitDice.die, total: hitDice.total, remaining: hitDice.remaining }];
  const seen = new Set<number>();
  let totalRequested = 0;
  for (const entry of allocation) {
    if (entry.recover < 0) return false;
    if (seen.has(entry.dieSize)) return false; // same pool named twice — ambiguous, refuse rather than guess which wins
    seen.add(entry.dieSize);
    const pool = pools.find(p => p.die === entry.dieSize);
    if (!pool) return false; // die size doesn't exist on this character
    const expended = pool.total - pool.remaining;
    if (entry.recover > expended) return false; // can't recover more than is actually spent
    totalRequested += entry.recover;
  }
  return totalRequested <= budget;
}

/**
 * Applies an explicit, already-validated `allocation` exactly — one entry
 * per die size, added straight onto that pool's `remaining` (capped
 * implicitly by validateHitDiceAllocation already having refused anything
 * that would exceed the pool's own expended count). A die size present on
 * the character but absent from `allocation` simply isn't touched (the
 * player chose not to recover any of it this rest).
 */
function applyHitDiceAllocation(hitDice: HitDiceBlock, allocation: HitDiceRecoveryAllocation): HitDiceBlock {
  if (!hitDice.pools) {
    const entry = allocation.find(a => a.dieSize === hitDice.die);
    return { ...hitDice, remaining: hitDice.remaining + (entry?.recover ?? 0) };
  }
  const nextPools = hitDice.pools.map(p => {
    const entry = allocation.find(a => a.dieSize === p.die);
    return entry ? { ...p, remaining: p.remaining + entry.recover } : p;
  });
  return {
    ...hitDice,
    remaining: nextPools.reduce((sum, p) => sum + p.remaining, 0),
    pools: nextPools,
  };
}

/**
 * Restores up to `count` hit dice. With an explicit, valid `allocation`
 * (required whenever hitDiceRecoveryNeedsAllocation says a real choice
 * exists — see longRest's own doc comment), applies EXACTLY that
 * allocation — never largest/smallest/acquisition-order. Without one —
 * the single-pool or budget-covers-everything fast path (B3), where no
 * allocation is ever required — falls back to the original deterministic
 * pool-order restore (pool by pool, in the order each die size was first
 * acquired), unchanged from before this batch; that fallback is provably
 * correct exactly because there's only one legal outcome in those cases,
 * not because the app is choosing FOR the player.
 */
function restoreHitDice(hitDice: HitDiceBlock, count: number, allocation?: HitDiceRecoveryAllocation): HitDiceBlock {
  if (allocation) return applyHitDiceAllocation(hitDice, allocation);
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
 * Rules-completeness batch (long-rest recovery), B1: the exact pre-existing
 * recovery-amount formula (RAW half level, minimum 1; the full spent pool
 * under the fullHitDiceOnLongRest house rule) — UNCHANGED, extracted only
 * so the UI can preview the budget before a long rest actually runs
 * (needed to render "Recover N Hit Dice" and to decide whether an
 * allocation choice is required at all — see hitDiceRecoveryNeedsAllocation).
 */
export function hitDiceRecoveryBudget(entity: Entity, rules: CampaignRules = DEFAULT_RULES): number {
  return longRestRestoresAllHitDice(rules)
    ? entity.resources.hitDice.total
    : Math.max(1, Math.floor(entity.identity.level / 2));
}

/** Every pool (or the single legacy pool) with at least one currently
 *  EXPENDED die (total > remaining) — used by the UI to render the mixed-
 *  pool recovery chooser (B6) and by hitDiceRecoveryNeedsAllocation below. */
export function expendedHitDicePools(hitDice: HitDiceBlock): HitDicePool[] {
  const pools = hitDice.pools ?? [{ die: hitDice.die, total: hitDice.total, remaining: hitDice.remaining }];
  return pools.filter(p => p.total > p.remaining);
}

/**
 * Rules-completeness batch (long-rest recovery), HIGH-fix closure, B2/B3:
 * true only when an explicit player allocation is actually required — 2+
 * pools have expended dice AND the recovery budget is too small to restore
 * every one of them. A single pool with expended dice, or a budget that
 * covers every expended die across every pool, has exactly one legal
 * outcome either way — no real choice to make — so the simple automatic
 * fast path stays available and no chooser needs to be shown.
 */
export function hitDiceRecoveryNeedsAllocation(entity: Entity, rules: CampaignRules = DEFAULT_RULES): boolean {
  const expended = expendedHitDicePools(entity.resources.hitDice);
  if (expended.length <= 1) return false;
  const totalExpended = expended.reduce((sum, p) => sum + (p.total - p.remaining), 0);
  return hitDiceRecoveryBudget(entity, rules) < totalExpended;
}

/**
 * The die size a hit-die spend will use — `dieSize` when explicitly given
 * (the player's own pool choice, once 2+ spendable pools exist and the UI
 * asked — see spendableHitDicePools), otherwise the single spendable pool
 * for a character with only one. Lets the UI show "Hit Die: d8" and
 * validate a manually-entered table roll against the right range (1 to
 * this value) before the die is actually spent. Falls back to the largest
 * spendable pool ONLY as a display default before a 2+-pool character has
 * made an explicit choice yet — spendHitDie/spendHitDieManual below never
 * accept that same ambiguity silently; they require the explicit choice.
 */
export function currentHitDieSize(entity: Entity, dieSize?: number): number {
  const { pools, die } = entity.resources.hitDice;
  if (dieSize !== undefined) return dieSize;
  if (!pools) return die;
  const spendable = [...pools].filter(p => p.remaining > 0).sort((a, b) => b.die - a.die);
  return spendable[0]?.die ?? die;
}

/** Shared final mutation for both hit-die paths below — spend one die
 *  (already removed from `hitDice`), add CON modifier to `roll`, heal,
 *  cap at max HP, persist. Table-first: the manual path supplies the
 *  physically-rolled `roll`; spendHitDie's in-app convenience supplies a
 *  random one. Neither path owns a separate consequence path. */
function healFromSpentHitDie(entity: Entity, roll: number, hitDice: Entity['resources']['hitDice'], rules: CampaignRules): Entity {
  // Use effective CON (race/feat bonuses included), consistent with HP calc.
  const effectiveStats = applyStatModifiers(entity.stats, collectAllEffects(entity));
  const conMod = modifier(effectiveStats.con);
  const heal   = Math.max(1, roll + conMod);

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
 * Player spends one hit die during a short rest — in-app roll convenience.
 * Rolls the die, adds CON modifier, heals the entity.
 * Minimum heal: 1. Cannot exceed maximum HP.
 *
 * Rules-completeness batch (mixed hit-die pools), C2/C4: `dieSize` names
 * EXACTLY which pool to spend — required (no-op, entity unchanged) whenever
 * 2+ distinct die sizes are currently spendable, so the engine never
 * silently picks the largest/smallest for the player. Optional only for a
 * single-pool character (the common case, and every character before
 * mixed pools existed) — omitting it there is unambiguous and behaves
 * exactly as before this batch.
 */
export function spendHitDie(
  entity:   Entity,
  rules:    CampaignRules = DEFAULT_RULES,
  dieSize?: number,
): Entity {
  if (entity.resources.hitDice.remaining <= 0) return entity;
  const spent = spendFromHitDicePools(entity.resources.hitDice, dieSize);
  if (!spent) return entity; // ambiguous (2+ pools, no explicit choice) or an invalid/exhausted dieSize — refuse, never guess
  const roll = Math.floor(Math.random() * spent.die) + 1;
  return healFromSpentHitDie(entity, roll, spent.hitDice, rules);
}

/**
 * Player spends one hit die during a short rest, table-first: `tableRoll`
 * is the physical die result already rolled at the table (validated by the
 * caller against currentHitDieSize(entity, dieSize) before this is called).
 * Spends the die, adds CON modifier, heals, caps at max HP — the exact same
 * healFromSpentHitDie mutation spendHitDie's in-app roll uses, so both
 * paths always agree on the final HP/hit-dice bookkeeping. `dieSize` — see
 * spendHitDie's own doc comment; same explicit-choice requirement.
 */
export function spendHitDieManual(
  entity:     Entity,
  tableRoll:  number,
  rules:      CampaignRules = DEFAULT_RULES,
  dieSize?:   number,
): Entity {
  if (entity.resources.hitDice.remaining <= 0) return entity;
  const spent = spendFromHitDicePools(entity.resources.hitDice, dieSize);
  if (!spent) return entity;
  return healFromSpentHitDie(entity, tableRoll, spent.hitDice, rules);
}

/**
 * Player discards one hit die WITHOUT healing. Use when the player rolls
 * PHYSICAL dice and applies the healing themselves (the app's player-facing
 * resolution model) — this just decrements the remaining pool. `dieSize` —
 * see spendHitDie's own doc comment; same explicit-choice requirement.
 */
export function discardHitDie(
  entity:   Entity,
  rules:    CampaignRules = DEFAULT_RULES,
  dieSize?: number,
): Entity {
  if (entity.resources.hitDice.remaining <= 0) return entity;
  const spent = spendFromHitDicePools(entity.resources.hitDice, dieSize);
  if (!spent) return entity;
  const updated = {
    ...entity,
    resources: {
      ...entity.resources,
      hitDice: spent.hitDice,
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
