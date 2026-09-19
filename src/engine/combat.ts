// ============================================================================
// FILE: src/engine/combat.ts
// PROJECT: Initiative Tracker, Concentration Gate & Combat Clock
// ============================================================================
import { Entity, CampaignRules, Spell, FeatureInstance, AbilityEffect, DurationTracker } from './types';
import { recomputeDerived, collectAllEffects } from './pipeline';
import { resolveResistance } from './resolver';
import { tickDurations, applyCondition, removeCondition } from './conditions';
import { CONDITIONS_BY_ID } from '../content/conditions/index';
import { rollD20 as rollD20Dice } from './dice';
import { DEFAULT_RULES } from '../store/characterStore';
import { deathSavesPersist } from './houseRules';
import { ALL_BEAST_FORMS } from '../content/beastforms';

// ── Initiative ────────────────────────────────────────────────────────────────

export type InitiativeEntry = {
  entityId:     string;
  name:         string;
  initiative:   number;
  tiebreak:     number;   // DEX modifier used to break equal initiative rolls
  isPlayer:     boolean;
  hasTakenTurn: boolean;
};

export type CombatState = {
  active:      boolean;
  round:       number;
  turnIndex:   number;
  order:       InitiativeEntry[];
  encounterId: string;
  /** Links this "ActiveEncounter" back to the PreparedEncounter template it
   *  was instantiated from, if any — undefined for a manually-assembled
   *  encounter (add party members / spawn monsters directly, the pre-
   *  existing flow). Used only to let "mark completed" find its way back
   *  to the template; never used to write live state back into it. */
  sourcePreparedEncounterId?: string;
};

/**
 * Starts a combat encounter. Rolls initiative for all entities,
 * sorts descending by roll then by initiative bonus as tiebreaker.
 */
export function startEncounter(
  entities:    Entity[],
  encounterId: string,
  sourcePreparedEncounterId?: string,
): CombatState {
  const order: InitiativeEntry[] = entities
    .map(e => ({
      entityId:     e.id,
      name:         e.identity.name,
      // entity.derived.initiative already accounts for effective (not raw)
      // DEX plus any flat initiative-bonus effects (e.g. Alert) — a local
      // reimplementation here (previously Math.floor((entity.stats.dex -
      // 10) / 2), the RAW score) silently missed both, giving the wrong
      // initiative roll for any entity with an effective DEX bonus from
      // race/items or an initiative-boosting feature.
      initiative:   rollD20Dice(e.derived.initiative).total,
      tiebreak:     e.derived.initiative,
      isPlayer:     e.kind === 'character',
      hasTakenTurn: false,
    }))
    .sort((a, b) =>
      b.initiative - a.initiative ||
      b.tiebreak   - a.tiebreak
    );

  return {
    active:      true,
    round:       1,
    turnIndex:   0,
    order,
    encounterId,
    sourcePreparedEncounterId,
  };
}

// ── Turn/action economy (A-25) ───────────────────────────────────────────────

/** Fresh turn — all 3 action-economy slots reset to unused. Also the first
 *  call that turns turnState from null into an actively-tracked object.
 *  Also refreshes any CustomResource tagged recharge:'start_of_turn' back
 *  to its maximum — generic (not legendary-action-specific), reusing
 *  CustomResource.recharge's existing open `| string` field the same way
 *  'short_rest'/'long_rest' already work, just ticked from a different
 *  event. First (and currently only) consumer: a monster's Legendary
 *  Actions pool, which refreshes at the start of its own turn rather than
 *  on any rest. */
export function startTurn(entity: Entity): Entity {
  const hasStartOfTurn = entity.resources.custom.some(r => r.recharge === 'start_of_turn');
  return {
    ...entity,
    turnState: { actionUsed: false, bonusActionUsed: false, reactionUsed: false },
    resources: hasStartOfTurn
      ? { ...entity.resources, custom: entity.resources.custom.map(r => r.recharge === 'start_of_turn' ? { ...r, current: r.maximum } : r) }
      : entity.resources,
  };
}

/**
 * The authoritative solo-player "End Turn" mutation — re-audit item 18.
 * Ticks round-based condition durations, ticks a concentration countdown
 * (if any), and starts a fresh turn (resets action economy, refreshes
 * start_of_turn resources) — the exact same composition
 * TabCharacter.tsx's own End Turn button already used inline. Extracted so
 * every entry point (Character tab, Actions tab, Spells tab) calls this
 * ONE function rather than each re-composing the same three calls, which
 * would risk them drifting out of sync over time. Distinct from endTurn()
 * above, which additionally advances a DM's multi-entity initiative order —
 * this is for a solo player with no active CombatState.
 */
export function playerEndTurn(entity: Entity, rules: CampaignRules = DEFAULT_RULES): Entity {
  return startTurn(tickConcentrationDuration(tickDurations(entity, rules), rules));
}

/** Marks one action-economy slot used. A no-op if turnState is null (not
 *  actively tracked — see the type's own doc comment) or already unused-
 *  irrelevant (a 'free'/'passive' actionType never calls this at all —
 *  callers only invoke it for 'action'/'bonus_action'/'reaction' cards). */
export function markActionSlotUsed(
  entity: Entity,
  slot:   'action' | 'bonus_action' | 'reaction',
): Entity {
  if (!entity.turnState) return entity;
  const key = slot === 'action' ? 'actionUsed' : slot === 'bonus_action' ? 'bonusActionUsed' : 'reactionUsed';
  return { ...entity, turnState: { ...entity.turnState, [key]: true } };
}

/** Flips one action-economy slot, for a player directly tapping the
 *  Combat-tab pill rather than using an action card — real play has
 *  actions the app doesn't model as a card at all (Dash/Dodge/Help/Search,
 *  a reaction spent narratively), so a manual correction needs to work in
 *  both directions, unlike markActionSlotUsed's card-use one-way set.
 *  Unlike markActionSlotUsed, this also INITIALIZES turnState (via
 *  startTurn) if it was null — a manual tap is itself "start tracking." */
export function toggleActionEconomy(
  entity: Entity,
  slot:   'action' | 'bonus_action' | 'reaction',
): Entity {
  const base = entity.turnState ? entity : startTurn(entity);
  const key = slot === 'action' ? 'actionUsed' : slot === 'bonus_action' ? 'bonusActionUsed' : 'reactionUsed';
  return { ...base, turnState: { ...base.turnState!, [key]: !base.turnState![key] } };
}

/**
 * Ends the current creature's turn.
 * - Ticks round-based durations on the acting entity.
 * - Advances the turn pointer.
 * - Increments the round counter when the order wraps.
 * - Starts a fresh turn (resets action economy) for whoever's turn is now current.
 */
export function endTurn(
  combat:   CombatState,
  entities: Entity[],
  rules:    CampaignRules = DEFAULT_RULES
): { combat: CombatState; entities: Entity[] } {
  const current = combat.order[combat.turnIndex];

  // Tick durations on the entity whose turn just ended
  const durationTicked = entities.map(e =>
    e.id === current.entityId ? tickConcentrationDuration(tickDurations(e, rules), rules) : e
  );

  // Advance turn pointer; wrap around at the end of the order
  const nextIndex = (combat.turnIndex + 1) % combat.order.length;
  const newRound  = nextIndex === 0 ? combat.round + 1 : combat.round;

  // Reset action economy for whoever's turn is now current.
  const nextEntityId = combat.order[nextIndex]?.entityId;
  const updatedEntities = durationTicked.map(e =>
    e.id === nextEntityId ? startTurn(e) : e
  );

  const updatedOrder = combat.order.map((entry, i) =>
    i === combat.turnIndex ? { ...entry, hasTakenTurn: true } : entry
  );

  // Reset hasTakenTurn when a new round starts
  const finalOrder = newRound > combat.round
    ? updatedOrder.map(e => ({ ...e, hasTakenTurn: false }))
    : updatedOrder;

  return {
    combat: {
      ...combat,
      round:     newRound,
      turnIndex: nextIndex,
      order:     finalOrder,
    },
    entities: updatedEntities,
  };
}

/** Ends the encounter and resets combat state. */
export function endEncounter(combat: CombatState): CombatState {
  return { ...combat, active: false, round: 0, turnIndex: 0, order: [] };
}

/**
 * Inserts reinforcements into an already-active encounter — rolls
 * initiative for the new entities only (reusing the same roll/tiebreak
 * shape startEncounter uses) and merges them into the existing order,
 * re-sorted. Preserves which entity currently has the turn across the
 * re-sort (the pointer is a plain array index, which a mid-array insertion
 * would otherwise silently invalidate).
 *
 * New arrivals are marked hasTakenTurn:false — they'll act once the turn
 * pointer reaches their rolled position. If that position already passed
 * this round, they're effectively skipped until the next round's
 * hasTakenTurn reset (endTurn, above) rather than retroactively inserted
 * into a round already in progress — a deliberate, disclosed
 * simplification (this app never auto-advances turns/rounds on its own;
 * the DM is always the one pressing the button), not an attempt to fully
 * model RAW's "you can act on your normal turn if it hasn't passed yet."
 */
export function addToEncounter(combat: CombatState, newEntities: Entity[]): CombatState {
  if (!combat.active || newEntities.length === 0) return combat;

  const newEntries: InitiativeEntry[] = newEntities.map(e => ({
    entityId:     e.id,
    name:         e.identity.name,
    initiative:   rollD20Dice(e.derived.initiative).total,
    tiebreak:     e.derived.initiative,
    isPlayer:     e.kind === 'character',
    hasTakenTurn: false,
  }));

  const currentEntityId = combat.order[combat.turnIndex]?.entityId;
  const merged = [...combat.order, ...newEntries].sort((a, b) =>
    b.initiative - a.initiative ||
    b.tiebreak   - a.tiebreak
  );
  const newTurnIndex = currentEntityId ? merged.findIndex(e => e.entityId === currentEntityId) : combat.turnIndex;

  return {
    ...combat,
    order:     merged,
    turnIndex: newTurnIndex >= 0 ? newTurnIndex : combat.turnIndex,
  };
}

// ── Concentration ─────────────────────────────────────────────────────────────

/**
 * Parses a spell's free-text `duration` field into a DurationTracker for
 * concentration tracking. Matches both the SRD content format
 * ("Concentration, up to 1 minute") and the homebrew spell-builder's bare
 * format ("1 minute" — app/homebrew/spell-builder.tsx tracks concentration
 * as a separate checkbox, with no "Concentration, up to " prefix at all in
 * its duration text). Real 5e concentration spells only ever use round/
 * minute/hour scales — sampled every `concentration: true` entry in
 * src/content/spells/*.ts and found exactly this range: "1 round",
 * "1 minute", "10 minutes", "1 hour", "8 hours".
 *
 * Fail-open: returns null for anything that doesn't contain a bare
 * "<N> round(s)/minute(s)/hour(s)" pattern — e.g. "Instantaneous", "Until
 * dispelled", or other freeform homebrew text. Concentration still starts
 * via beginConcentration either way; this only gates the ticking countdown.
 * Never throws.
 */
export function parseConcentrationDuration(durationText: string): DurationTracker | null {
  const match = durationText.match(/(\d+)\s*(round|rounds|minute|minutes|hour|hours)\b/i);
  if (!match) return null;

  const amount = parseInt(match[1], 10);
  const unit   = match[2].toLowerCase();

  const rounds =
    unit.startsWith('round')  ? amount :
    unit.startsWith('minute') ? amount * 10 :
    /* hour(s) */                amount * 600;

  return { unit: 'rounds', remaining: rounds };
}

/**
 * Drops the currently concentrated spell.
 * Removes all features tagged source.kind = 'spell' and source.refId = spellId.
 * Sets concentrating to null.
 * No-op if not concentrating.
 */
export function dropConcentration(entity: Entity): Entity {
  if (!entity.spellcasting?.concentrating) return entity;

  const droppedId = entity.spellcasting.concentrating;

  const cleanedFeatures = entity.features.filter(f =>
    !(f.source.kind === 'spell' && f.source.refId === droppedId)
  );

  return {
    ...entity,
    features: cleanedFeatures,
    spellcasting: entity.spellcasting
      ? { ...entity.spellcasting, concentrating: null, concentratingDuration: undefined }
      : null,
    conditionMonitor: {
      ...entity.conditionMonitor,
      flags: { ...entity.conditionMonitor.flags, concentrating: false },
    },
  };
}

/**
 * Begins concentrating on a spell.
 * Applies any onConcentrationFeatures from the spell definition.
 * Tags them with source = { kind: 'spell', refId: spell.id }
 * so dropConcentration can cleanly remove them.
 */
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
      ? {
          ...entity.spellcasting,
          concentrating:         spell.id,
          concentratingDuration: parseConcentrationDuration(spell.duration) ?? undefined,
        }
      : null,
    conditionMonitor: {
      ...entity.conditionMonitor,
      flags: { ...entity.conditionMonitor.flags, concentrating: true },
    },
  };

  return recomputeDerived(updated, rules);
}

/**
 * Cast a concentration spell.
 * Automatically drops the previous concentration before beginning the new one.
 * This is the Hex → Fly scenario: Hex drops silently, Fly takes over.
 */
export function castConcentrationSpell(
  entity: Entity,
  spell:  Spell,
  rules:  CampaignRules = DEFAULT_RULES
): Entity {
  let updated = dropConcentration(entity);
  updated     = beginConcentration(updated, spell, rules);
  return updated;
}

/**
 * Decrements the concentrating spell's tracked round countdown by 1 —
 * called from the same End Turn action that ticks entity.conditions'
 * 'rounds' durations (conditions.ts's tickDurations). Deliberately NOT
 * folded into tickDurations itself: conditions.ts is a lower-level module
 * combat.ts already imports from, so a function needing dropConcentration
 * has to live here to avoid a circular import — callers just chain both.
 * Auto-drops concentration via dropConcentration() when the countdown hits
 * 0, and explicitly recomputes afterward since dropConcentration() itself
 * does not.
 * No-op if not concentrating, or concentrating on a spell whose duration
 * didn't parse to a tracked countdown (parseConcentrationDuration returned
 * null at cast time).
 */
export function tickConcentrationDuration(
  entity: Entity,
  rules:  CampaignRules = DEFAULT_RULES
): Entity {
  const tracker = entity.spellcasting?.concentratingDuration;
  if (!tracker || tracker.unit !== 'rounds') return entity;

  const remaining = tracker.remaining - 1;
  if (remaining <= 0) {
    return recomputeDerived(dropConcentration(entity), rules);
  }

  return {
    ...entity,
    spellcasting: entity.spellcasting
      ? { ...entity.spellcasting, concentratingDuration: { ...tracker, remaining } }
      : null,
  };
}

// ── Concentration check (on damage) ──────────────────────────────────────────

/**
 * Called when a concentrating entity takes damage.
 * DC = max(10, damage / 2). Rolls CON save.
 * Supports War Caster advantage via the entity's feature flags.
 * If the save fails, concentration is dropped.
 */
export function concentrationCheck(
  entity:      Entity,
  damageTaken: number,
  rules:       CampaignRules = DEFAULT_RULES
): Entity {
  if (!entity.spellcasting?.concentrating) return entity;

  const dc = Math.max(10, Math.floor(damageTaken / 2));

  // Use the pipeline-computed CON saving throw, which already accounts for the
  // effective CON modifier (race/feat bonuses) AND saving-throw proficiency
  // (e.g. Resilient adds CON to proficiencies.savingThrows, which flows into
  // derived.savingThrows.con). Reading entity.stats.con directly would miss both.
  const conSaveBonus = entity.derived.savingThrows.con;

  // War Caster grants advantage on concentration saves. Match the actual feat
  // feature id (feat_<id>); the old 'war_caster'/'resilient_con' ids never
  // matched anything created by the feats system.
  const hasWarCaster = entity.features.some(f =>
    f.isActive && f.id === 'feat_war_caster'
  );

  const baseRoll = (): number => rollD20Dice(conSaveBonus).total;

  const roll = hasWarCaster
    ? Math.max(baseRoll(), baseRoll())   // Advantage: roll twice, keep higher
    : baseRoll();

  if (roll < dc) {
    return dropConcentration(entity);
  }

  return entity;
}

// ── HP damage with temp HP absorption ────────────────────────────────────────

/**
 * Applies damage to an entity.
 * Temp HP absorbs damage first before it touches current HP.
 * Also fires a concentration check if the entity is concentrating.
 */
export function applyDamage(
  entity:      Entity,
  damage:      number,
  rules:       CampaignRules = DEFAULT_RULES,
  /** Optional — when omitted, behaves exactly as before (no resistance math).
   * Manual player-typed damage often has no declared type, and that's a
   * legitimate choice, not a missing feature. */
  damageType?: string,
): Entity {
  if (damage <= 0) return entity;

  let resolvedDamage = damage;
  if (damageType) {
    const response = resolveResistance(damageType, collectAllEffects(entity));
    if (response === 'immunity') return entity;
    if (response === 'resistance') resolvedDamage = Math.floor(damage / 2);
    else if (response === 'vulnerability') resolvedDamage = damage * 2;
  }

  const { hp } = entity.resources;
  const wasAtZero    = hp.current === 0;
  const tempAbsorbed = Math.min(hp.temp, resolvedDamage);
  const remainingDmg = resolvedDamage - tempAbsorbed;
  const newCurrent   = Math.max(0, hp.current - remainingDmg);

  // Death saves: dropping to 0 for the first time starts a fresh count —
  // unless the deathSavesPersist house rule is on, in which case accumulated
  // failures from a prior dying episode carry over (cleared only by a long
  // rest, see rest.ts). Successes/stable always reset on a fresh drop either
  // way — only failures are ever persisted.
  // Taking damage while ALREADY at 0 HP counts as one automatic failure
  // (book rule) — this only applies to real damage getting through, not
  // damage fully absorbed by temp HP while already at 0.
  let deathSaves = entity.resources.deathSaves;
  if (newCurrent === 0 && !wasAtZero) {
    deathSaves = {
      successes: 0,
      failures:  deathSavesPersist(rules) ? deathSaves.failures : 0,
      stable:    false,
    };
  } else if (newCurrent === 0 && wasAtZero && remainingDmg > 0 && !deathSaves.stable) {
    deathSaves = {
      ...deathSaves,
      failures: Math.min(3, deathSaves.failures + 1),
    };
  }

  const updated = {
    ...entity,
    resources: {
      ...entity.resources,
      hp: {
        ...hp,
        current: newCurrent,
        temp:    hp.temp - tempAbsorbed,
      },
      deathSaves,
    },
  };

  // Concentration check is the player's responsibility via the UI modal.
  // Do NOT call concentrationCheck here — it would run twice alongside the UI roll.
  return recomputeDerived(updated, rules);
}

/** Heals an entity, capped at maximum HP. Any healing above 0 HP clears death saves. */
export function applyHealing(
  entity:  Entity,
  amount:  number,
  rules:   CampaignRules = DEFAULT_RULES
): Entity {
  if (amount <= 0) return entity;
  const newCurrent = Math.min(
    entity.resources.hp.maximum,
    entity.resources.hp.current + amount
  );
  const updated = {
    ...entity,
    resources: {
      ...entity.resources,
      hp: { ...entity.resources.hp, current: newCurrent },
      deathSaves: newCurrent > 0
        ? { successes: 0, failures: 0, stable: false }
        : entity.resources.deathSaves,
    },
  };
  return recomputeDerived(updated, rules);
}

/**
 * Records one death saving throw result while an entity is at 0 HP.
 * Success on 3 -> stable (stops rolling; still at 0 HP until healed).
 * Failure on 3 -> dead (UI is responsible for showing this state; the
 * engine doesn't have a separate "dead" flag beyond failures === 3).
 * A natural 20 (isNatural20) instead heals 1 HP immediately and clears
 * both counters, per the book rule — call applyHealing(entity, 1, rules)
 * from the UI in that case instead of this function.
 * No-op if already stable, already dead, or entity isn't at 0 HP.
 */
export function recordDeathSave(
  entity:  Entity,
  outcome: 'success' | 'failure',
  rules:   CampaignRules = DEFAULT_RULES
): Entity {
  const { hp, deathSaves } = entity.resources;
  if (hp.current !== 0) return entity;
  if (deathSaves.stable || deathSaves.failures >= 3) return entity;

  const next = outcome === 'success'
    ? { ...deathSaves, successes: Math.min(3, deathSaves.successes + 1) }
    : { ...deathSaves, failures:  Math.min(3, deathSaves.failures  + 1) };
  const stabilized = { ...next, stable: next.successes >= 3 };

  const updated = {
    ...entity,
    resources: { ...entity.resources, deathSaves: stabilized },
  };
  return recomputeDerived(updated, rules);
}

/**
 * Applies the non-dice AbilityEffects of a used Feature to the entity.
 *
 * BEFORE this existed, tapping "Use" on a card only spent its resource cost
 * (see app/components/sheet/TabActions.tsx) — the actual AbilityEffects were
 * never applied. This meant Rage's `set_flag: rage_active` never fired, so
 * Rage's damage-resistance effects (gated on that same flag in
 * collectAllEffects) silently never activated even though the resource was
 * spent and the card displayed correctly. Discovered while building Wild
 * Shape, which needed the same missing plumbing for its `transform` effect —
 * see docs/ROADMAP_1.0.md Phase 3.4 for the full writeup.
 *
 * Deliberately does NOT handle 'damage'/'heal' here — those stay a manual
 * player decision via the roll modal + HP modal, consistent with the app
 * having no attack-roll/hit resolution anywhere else. Everything else
 * (set_flag, transform) is a pure state change on the player's own entity
 * that has no combat-resolution ambiguity, so it applies immediately.
 *
 * apply_condition/remove_condition now route through the same
 * applyCondition()/removeCondition() engine functions the app's condition
 * pickers already use — the 40+ real content entries authoring these
 * (monster fear/poison/paralyze attacks, several subclass features) used
 * to display correctly but produce zero actual game-state change (audit
 * finding ARCH-2). Condition features are resolved via CONDITIONS_BY_ID
 * (official content only) — this file lives in src/engine/, which
 * deliberately has no dependency on src/store/* (confirmed elsewhere in
 * this codebase), so a homebrew condition applied this way gets its
 * features attached only if it happens to share an id with a known
 * official one; same disclosed limitation preparedEncounter.ts's own
 * identical CONDITIONS_BY_ID usage already has.
 *
 * grant_speed and spend_resource (beyond the base activation cost) are
 * still intentionally left for a future pass — not silently claimed as
 * done. grant_speed specifically would need a genuine temporary-effect-
 * tracking mechanism of its own (there's no existing "timed feature grant
 * that isn't a condition" concept to reuse — tickDurations is hardcoded to
 * entity.conditionMonitor.active/.conditions), which is real new
 * architecture, not a contained fix; deferred rather than bolted on as a
 * parallel state system.
 */
export function applyAbilityEffects(
  entity:  Entity,
  effects: AbilityEffect[],
  rules:   CampaignRules = DEFAULT_RULES,
): Entity {
  let updated = entity;

  for (const effect of effects) {
    if (effect.type === 'set_flag') {
      updated = {
        ...updated,
        conditionMonitor: {
          ...updated.conditionMonitor,
          flags: { ...updated.conditionMonitor.flags, [effect.flag]: effect.value },
        },
      };
    } else if (effect.type === 'transform') {
      updated = startWildShape(updated, effect.formId, rules);
    } else if (effect.type === 'restore_resource') {
      updated = restoreResource(updated, effect.resourceId, effect.amount);
    } else if (effect.type === 'apply_condition') {
      const features = CONDITIONS_BY_ID[effect.conditionId]?.features;
      updated = applyCondition(updated, effect.conditionId, 'ability', rules, features, effect.duration);
    } else if (effect.type === 'remove_condition') {
      updated = removeCondition(updated, effect.conditionId, rules);
    }
    // 'damage' / 'heal': intentionally left to the manual roll+HP-modal flow.
    // 'grant_speed' / 'spend_resource': not yet wired — see the doc comment above.
  }

  return recomputeDerived(updated, rules);
}

/**
 * Restores a resource an ability's abilityEffects declares regained (e.g.
 * Eldritch Master's "regain all spell slots", Vermillion mutagen's "+1
 * Blood Maledict use"). 'spell_slots' resets BOTH .slots and .pactSlots
 * (only 'full' is meaningful there — which tier a partial number would
 * apply to is ambiguous, so a numeric amount against 'spell_slots' is a
 * no-op, left for a future pass same as the other unhandled effect types
 * above). Any other resourceId is looked up in entity.resources.custom.
 */
function restoreResource(entity: Entity, resourceId: string, amount: number | 'full'): Entity {
  if (resourceId === 'spell_slots') {
    if (amount !== 'full' || !entity.spellcasting) return entity;
    const tiers = ['1','2','3','4','5','6','7','8','9'] as const;
    const resetSlots = (slots: typeof entity.spellcasting.slots) => {
      const next = { ...slots };
      for (const t of tiers) if (next[t]) next[t] = { ...next[t]!, used: 0 };
      return next;
    };
    return {
      ...entity,
      spellcasting: {
        ...entity.spellcasting,
        slots: resetSlots(entity.spellcasting.slots),
        pactSlots: entity.spellcasting.pactSlots ? resetSlots(entity.spellcasting.pactSlots) : undefined,
      },
    };
  }
  const resource = entity.resources.custom.find(r => r.id === resourceId);
  if (!resource) return entity;
  const newCurrent = amount === 'full' ? resource.maximum : Math.min(resource.maximum, resource.current + amount);
  return {
    ...entity,
    resources: {
      ...entity.resources,
      custom: entity.resources.custom.map(r => r.id === resourceId ? { ...r, current: newCurrent } : r),
    },
  };
}

/**
 * Starts Wild Shape: sets wildShapeState, which recomputeDerived (pipeline.ts)
 * reads to swap AC/speed/senses/movement/physical stats to the beast form's
 * while keeping the player's own mental scores and class features — same
 * non-mutating "apply on top" philosophy as DmOverride. The beast's own HP
 * pool is tracked separately in wildShapeState.beastHp; the player's real HP
 * is untouched and resumes exactly where it was on revert.
 * No-op if already transformed or the formId doesn't exist.
 */
export function startWildShape(
  entity: Entity,
  formId: string,
  rules:  CampaignRules = DEFAULT_RULES,
): Entity {
  if (entity.wildShapeState?.active) return entity;
  const form = ALL_BEAST_FORMS.find(f => f.id === formId);
  if (!form) return entity;

  // Duration: half druid level in hours, minimum 1 (book rule). Falls back to
  // character level if this isn't (yet) tracked as a separate class level.
  const hours = Math.max(1, Math.floor(entity.identity.level / 2));

  const updated: Entity = {
    ...entity,
    wildShapeState: {
      active:     true,
      formId:     form.id,
      beastHp:    form.hp,
      beastHpMax: form.hp,
      expiresAt:  { unit: 'hours', remaining: hours },
    },
  };
  return recomputeDerived(updated, rules);
}

/**
 * Ends Wild Shape, reverting to the player's normal stats. Per the book rule,
 * excess damage the beast form took does NOT carry over to the player's real
 * HP — only the state that was tracked is discarded; the player's own HP was
 * never touched while transformed, so it's simply already correct on revert.
 * Safe to call even if not currently transformed (no-op).
 */
export function endWildShape(
  entity: Entity,
  rules:  CampaignRules = DEFAULT_RULES,
): Entity {
  if (!entity.wildShapeState?.active) return entity;
  const updated: Entity = { ...entity, wildShapeState: null };
  return recomputeDerived(updated, rules);
}

/**
 * Applies damage to a Wild-Shaped entity's BEAST hp pool, not the player's
 * real HP. Per the book rule, if the beast's hp pool hits 0, the player
 * reverts to their normal form immediately with 0 hp gained/lost beyond
 * what was already on their sheet — excess damage past the beast's pool does
 * NOT carry over. Call this INSTEAD of applyDamage while transformed; the
 * caller (UI) is responsible for checking wildShapeState.active first.
 */
export function applyWildShapeDamage(
  entity: Entity,
  damage: number,
  rules:  CampaignRules = DEFAULT_RULES,
): Entity {
  if (!entity.wildShapeState?.active || damage <= 0) return entity;
  const newBeastHp = Math.max(0, entity.wildShapeState.beastHp - damage);

  if (newBeastHp === 0) {
    // Beast form "dies" -> revert immediately, no carryover damage.
    return endWildShape(entity, rules);
  }
  const updated: Entity = {
    ...entity,
    wildShapeState: { ...entity.wildShapeState, beastHp: newBeastHp },
  };
  return recomputeDerived(updated, rules);
}

/**
 * Applies temporary HP.
 * Temp HP does not stack — keep whichever pool is larger.
 */
export function applyTempHP(
  entity:  Entity,
  amount:  number,
  rules:   CampaignRules = DEFAULT_RULES
): Entity {
  if (amount <= entity.resources.hp.temp) return entity; // Current pool is larger
  const updated = {
    ...entity,
    resources: {
      ...entity.resources,
      hp: { ...entity.resources.hp, temp: amount },
    },
  };
  return recomputeDerived(updated, rules);
}
