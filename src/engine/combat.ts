// ============================================================================
// FILE: src/engine/combat.ts
// PROJECT: Initiative Tracker, Concentration Gate & Combat Clock
// ============================================================================
import { findBeastForm } from '../content/runtimeRules';
import { lookupConditionFor } from '../content/conditions/lookup';
import { Entity, CampaignRules, Spell, FeatureInstance, AbilityEffect, DurationTracker, FeatureActivation, CustomResource } from './types';
import { recomputeDerived, collectAllEffects } from './pipeline';
import { resolveResistance } from './resolver';
import { tickDurations, applyCondition, removeCondition } from './conditions';
import { lookupCondition } from '../content/conditions/index';
import { rollD20 as rollD20Dice } from './dice';
import { DEFAULT_RULES } from '../store/characterStore';
import { deathSavesPersist } from './houseRules';

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

/** Rolls one entity's initiative — the app-roll convenience, shared by
 *  startEncounter/addToEncounter's roll:true path and by any UI (a per-row
 *  "🎲 Roll" button, "Roll All") that wants the exact same d20 + effective-
 *  DEX-and-bonus math rather than reimplementing it. Entity.derived.initiative
 *  already accounts for effective (not raw) DEX plus any flat initiative
 *  bonus effects (e.g. Alert) — a local reimplementation would silently miss
 *  both. */
export function rollInitiativeValue(entity: Entity): number {
  return rollD20Dice(entity.derived.initiative).total;
}

function initiativeEntryFor(entity: Entity, roll: boolean): InitiativeEntry {
  return {
    entityId:     entity.id,
    name:         entity.identity.name,
    // Table-first (see docs/... table-first resolution): starting combat or
    // adding reinforcements no longer forces an app-generated roll. roll:false
    // (the default a DM reaches by pressing the primary "Start Combat"/"Deploy"
    // button) seeds every entry at 0, stable-sorted by tiebreak alone, so the
    // DM can enter table-rolled results or just reorder rows directly — see
    // CombatantRow's inline initiative editor and setOrder's up/down swap.
    // roll:true (the secondary "🎲 Roll All" convenience) reproduces the
    // exact previous auto-roll-on-start behavior via rollInitiativeValue.
    initiative:   roll ? rollInitiativeValue(entity) : 0,
    tiebreak:     entity.derived.initiative,
    isPlayer:     entity.kind === 'character',
    hasTakenTurn: false,
  };
}

/** Exported (not just used internally) so combatStore's own setInitiative
 *  can share the exact same comparator rather than re-implementing it —
 *  closure fix: the two had drifted into two copies of the identical sort,
 *  a real risk for silent divergence if either one were tweaked later. */
export function sortInitiative(order: InitiativeEntry[]): InitiativeEntry[] {
  return [...order].sort((a, b) =>
    b.initiative - a.initiative ||
    b.tiebreak   - a.tiebreak
  );
}

/**
 * Closure fix (initiative persistence + active-actor stability): every
 * mutation that can re-sort or reorder `combat.order` — a numeric
 * initiative edit, an explicit manual reorder, "Roll All Initiative", or a
 * reinforcement merge — used to leave `turnIndex` as a bare array position.
 * That silently reassigned "whose turn it is" to whichever entity happened
 * to land at that same numeric slot after the mutation, rather than
 * following the entity that actually had the turn. Every one of those call
 * sites now captures `combat.order[combat.turnIndex]?.entityId` BEFORE
 * mutating, then calls this to find that same entity's new position
 * afterward. Falls back to the previous index (clamped to the new order's
 * bounds) only if that entity is no longer present at all — a pure
 * reorder/resort/roll never removes anyone, so that branch is defensive
 * only; a real removal (removeFromEncounter) has its own dedicated
 * re-anchoring logic already, unaffected by this helper.
 */
export function reanchorTurnIndex(
  order: InitiativeEntry[],
  currentEntityId: string | undefined,
  previousIndex: number,
): number {
  if (currentEntityId) {
    const found = order.findIndex(e => e.entityId === currentEntityId);
    if (found >= 0) return found;
  }
  return Math.min(previousIndex, Math.max(0, order.length - 1));
}

/**
 * Starts a combat encounter. `roll` (default true, matching this function's
 * pre-existing behavior for any caller/test that doesn't pass it) controls
 * whether initiative is app-rolled for every entity or left at 0 for
 * manual/table entry. The UI's primary "Start Combat" path explicitly
 * passes `roll: false` — table-first resolution: the DM enters results or
 * reorders rows directly by default — and its secondary "🎲 Roll All
 * Initiative" convenience explicitly passes `roll: true`.
 */
export function startEncounter(
  entities:    Entity[],
  encounterId: string,
  sourcePreparedEncounterId?: string,
  roll = true,
): CombatState {
  const order = sortInitiative(entities.map(e => initiativeEntryFor(e, roll)));

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
    // Extra Attack sequence closure: a fresh turn always closes out any
    // leftover in-progress Attack-action sequence from before — a new turn
    // means a new Action to spend, never a continuation of an old one.
    attackSequence: null,
    resources: hasStartOfTurn
      ? { ...entity.resources, custom: entity.resources.custom.map(r => r.recharge === 'start_of_turn' ? { ...r, current: r.maximum } : r) }
      : entity.resources,
  };
}

/**
 * Extra Attack sequence closure, Part O (Cancel/Done): explicitly closes the
 * entity's currently in-progress Attack-action sequence WITHOUT touching
 * anything else — the Action already spent by the lead attack (if any) stays
 * spent, and any unused attack opportunities are simply discarded. A no-op
 * (returns entity unchanged) when no sequence is active. The UI calls this
 * when the player presses "Done" after a partial sequence, or "Cancel" (also
 * a no-op there specifically, since Cancel before any successful attack
 * means entity.attackSequence was never set in the first place — see
 * applyActionCardUse's own doc comment, actionUse.ts).
 */
export function endAttackSequence(entity: Entity): Entity {
  if (!entity.attackSequence) return entity;
  return { ...entity, attackSequence: null };
}

// stripTransientRuntimeState (Extra Attack sequence closure, Part B) lives
// in types.ts, not here — db/entityRepo.ts's own per-row read path
// (parseEntityRow) is one of its required call sites, and combat.ts
// transitively imports DEFAULT_RULES from store/characterStore.ts, which
// itself imports entityRepo.ts — importing combat.ts from entityRepo.ts
// would create a cycle. types.ts has no such dependency, so the shared
// normalizer is defined there instead and re-exported here for convenience.
export { stripTransientRuntimeState } from './types';

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
/**
 * `roll` (default true, matching this function's pre-existing behavior)
 * controls whether the new entities' initiative is app-rolled or left at 0
 * for manual/table entry — same table-first default as startEncounter; the
 * UI's primary "Deploy" path passes `roll: false`.
 */
export function addToEncounter(combat: CombatState, newEntities: Entity[], roll = true): CombatState {
  if (!combat.active || newEntities.length === 0) return combat;

  const newEntries = newEntities.map(e => initiativeEntryFor(e, roll));

  const currentEntityId = combat.order[combat.turnIndex]?.entityId;
  const merged = sortInitiative([...combat.order, ...newEntries]);

  return {
    ...combat,
    order:     merged,
    turnIndex: reanchorTurnIndex(merged, currentEntityId, combat.turnIndex),
  };
}

/**
 * Rolls (or re-rolls) initiative for every entity currently in the order —
 * the "🎲 Roll All Initiative" secondary convenience, callable both before
 * anyone has entered a manual value and after (a DM changing their mind).
 * Re-sorts afterward; does not otherwise touch turnIndex/round/hasTakenTurn,
 * matching setOrder's existing "manual DM correction" semantics rather than
 * addToEncounter's turn-pointer-preserving merge (there's no new entity
 * being inserted here, so nothing needs preserving across the resort beyond
 * what setOrder callers already accept).
 */
export function rollAllInitiative(combat: CombatState, entities: Entity[]): CombatState {
  const currentEntityId = combat.order[combat.turnIndex]?.entityId;
  const byId = new Map(entities.map(e => [e.id, e]));
  const order = sortInitiative(combat.order.map(entry => {
    const entity = byId.get(entry.entityId);
    return entity ? { ...entry, initiative: rollInitiativeValue(entity), tiebreak: entity.derived.initiative } : entry;
  }));
  return { ...combat, order, turnIndex: reanchorTurnIndex(order, currentEntityId, combat.turnIndex) };
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
 * Names of the effects that end together with the current concentration —
 * features tagged source.kind='spell' for the concentrated spell (exactly the
 * set dropConcentration removes). Empty when not concentrating or when the
 * spell carries no mechanical effect of its own.
 */
export function concentrationLinkedEffectNames(entity: Entity): string[] {
  const id = entity.spellcasting?.concentrating;
  if (!id) return [];
  return entity.features
    .filter(f => f.source.kind === 'spell' && f.source.refId === id)
    .map(f => f.name);
}

/**
 * The player/DM ends concentration by hand — the human-confirmed path the
 * table-first design calls for (a broken save, a dispel or a ruling all end
 * up here). Same deterministic cleanup as a failed concentration save:
 * dropConcentration clears the tracker and the linked spell features, and the
 * recompute makes sure nothing derived from those features lingers.
 * No-op when not concentrating.
 */
export function endConcentration(entity: Entity, rules: CampaignRules = DEFAULT_RULES): Entity {
  if (!entity.spellcasting?.concentrating) return entity;
  return recomputeDerived(dropConcentration(entity), rules);
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
 * Computes DC + rolls the CON save for a concentration check, WITHOUT
 * applying any consequence — the pure "app roll" half of the table-first
 * split. Supports War Caster advantage. Callers pass the `passed` result to
 * resolveConcentrationOutcome, the exact same deterministic path a DM/player
 * tapping the manual Success/Failure buttons calls directly — so the two
 * resolution paths (roll in app vs. record a table result) never diverge.
 */
export function rollConcentrationSave(
  entity:      Entity,
  damageTaken: number,
): { passed: boolean; dc: number; roll: number } {
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

  return { passed: roll >= dc, dc, roll };
}

/**
 * Deterministic bookkeeping once a concentration save's outcome is known —
 * table-first: the primary Success/Failure buttons call this directly with
 * a human-supplied result, and rollConcentrationSave's app-roll convenience
 * calls it too, with its own computed `passed`. No-op if not concentrating.
 */
export function resolveConcentrationOutcome(entity: Entity, passed: boolean): Entity {
  if (!entity.spellcasting?.concentrating) return entity;
  return passed ? entity : dropConcentration(entity);
}

/**
 * Called when a concentrating entity takes damage.
 * DC = max(10, damage / 2). Rolls CON save (app-roll convenience).
 * Supports War Caster advantage via the entity's feature flags.
 * If the save fails, concentration is dropped.
 * Composes rollConcentrationSave + resolveConcentrationOutcome — kept as its
 * own function since it's already the tested, documented entry point for
 * "roll and resolve in one call" (e.g. non-UI callers, existing tests).
 */
export function concentrationCheck(
  entity:      Entity,
  damageTaken: number,
  rules:       CampaignRules = DEFAULT_RULES
): Entity {
  if (!entity.spellcasting?.concentrating) return entity;
  const { passed } = rollConcentrationSave(entity, damageTaken);
  return resolveConcentrationOutcome(entity, passed);
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
    const effects = collectAllEffects(entity);
    const response = resolveResistance(damageType, effects);
    if (response === 'immunity') return entity;
    if (response === 'resistance') resolvedDamage = Math.floor(damage / 2);
    else if (response === 'vulnerability') resolvedDamage = damage * 2;
    // Flat per-hit reduction ("reduces slashing damage it takes by 2 from each hit" — Glassback's
    // Ceramic Shell): an `add` stat_modifier on target `damage_reduction:<type>`, taken off after
    // resistance/vulnerability, never below 0.
    const flat = effects.reduce((sum, ae) =>
      ae.effect.target === `damage_reduction:${damageType}` && ae.effect.operation === 'add' && typeof ae.effect.value === 'number'
        ? sum + ae.effect.value : sum, 0);
    if (flat > 0) resolvedDamage = Math.max(0, resolvedDamage - flat);
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
  //
  // Rules-correctness fix (HIGH batch, B): this branch used to also require
  // `!deathSaves.stable`, so a STABLE creature at 0 HP that took further
  // qualifying damage silently stayed stable and never recorded a failure —
  // wrong (a stable creature takes damage, it stops being stable and starts
  // failing death saves again, PHB p.197). `stable` is now explicitly
  // cleared here instead of gating the whole branch on it; existing
  // failures are preserved and incremented by exactly one, never reset.
  let deathSaves = entity.resources.deathSaves;
  if (newCurrent === 0 && !wasAtZero) {
    deathSaves = {
      successes: 0,
      failures:  deathSavesPersist(rules) ? deathSaves.failures : 0,
      stable:    false,
    };
  } else if (newCurrent === 0 && wasAtZero && remainingDmg > 0) {
    deathSaves = {
      ...deathSaves,
      stable:   false,
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

// ── Status legality (HIGH batch, C): 0 HP / Unconscious / Dead ──────────────

/**
 * 2014 condition-mechanics closure, Part D: every standard condition whose
 * OWN RAW text either grants the Incapacitated condition outright, or is
 * itself defined as "the creature is incapacitated" — Paralyzed, Stunned,
 * and Petrified all read "A/An X creature is incapacitated..." — plus the
 * bare `incapacitated` condition itself (granted directly by some
 * spells/features with no separate named condition of their own — see
 * content/conditions/index.ts). `unconscious` was already checked here
 * before this closure (see isIncapacitated's own prior history); folded
 * into this one list instead of a separate special case so there is exactly
 * ONE authoritative set of "which condition ids block Actions/Reactions",
 * consulted by both isIncapacitated and incapacitationReason below.
 *
 * Ordered — incapacitationReason below returns the FIRST matching label, so
 * this also doubles as a fixed priority when more than one is active at
 * once (deterministic, not "whichever happened to be pushed last").
 */
const INCAPACITATING_CONDITION_IDS: readonly string[] = ['unconscious', 'paralyzed', 'stunned', 'petrified', 'incapacitated'];

/**
 * True if the entity is incapacitated for normal gameplay ActionCard use —
 * either currently at 0 HP, or carrying one of INCAPACITATING_CONDITION_IDS
 * above (independent of HP — e.g. Sleep, Hold Person, a Paralyzed monster at
 * full HP). Deliberately just these existing, authoritative pieces of
 * state — no new flag is introduced; `hp.current === 0` and `entity.conditions`
 * already exist and drive every other part of this app. isFeatureAvailable
 * (actionCards.ts) is the ONE place that consults this for normal-action
 * legality, mirroring isSpellPreparationLegal's own "one authoritative
 * check, used by both card generation and cast-time enforcement" pattern.
 *
 * `hp.maximum > 0` guards against an entity that has never actually been
 * initialized with real hit points (a bare fixture/placeholder — every real
 * character/monster gets a positive max HP immediately on creation) so a
 * freshly-created entity isn't treated as "at 0 HP" before it has any HP
 * concept at all.
 */
export function isIncapacitated(entity: Entity): boolean {
  return (entity.resources.hp.maximum > 0 && entity.resources.hp.current === 0)
    || entity.conditions.some(c => INCAPACITATING_CONDITION_IDS.includes(c.id));
}

/**
 * 2014 condition-mechanics closure: the human-readable reason string for
 * WHY isIncapacitated() is true right now — extracted so every caller (both
 * isFeatureAvailable and generateSpellCard's own separately-computed
 * statusReason, actionCards.ts) shows the actual active cause instead of
 * the old hardcoded "0 HP or else it must be Unconscious" binary guess,
 * which silently mislabeled a Paralyzed/Stunned/Petrified/plain-Incapacitated
 * creature at full HP as "Unconscious". 0 HP is checked first (unchanged
 * from before this closure — the common case), then each condition id in
 * INCAPACITATING_CONDITION_IDS's own fixed priority order. Only ever called
 * when isIncapacitated(entity) is already known true, so the final fallback
 * is unreachable in practice — present only so this always returns a string.
 */
export function incapacitationReason(entity: Entity): string {
  if (entity.resources.hp.maximum > 0 && entity.resources.hp.current === 0) return 'At 0 HP';
  const label: Record<string, string> = {
    unconscious: 'Unconscious', paralyzed: 'Paralyzed', stunned: 'Stunned',
    petrified: 'Petrified', incapacitated: 'Incapacitated',
  };
  for (const id of INCAPACITATING_CONDITION_IDS) {
    if (entity.conditions.some(c => c.id === id)) return label[id];
  }
  return 'Incapacitated';
}

/**
 * True once death-save failures have reached 3 — this engine has no
 * separate "dead" flag (see recordDeathSave's own doc comment). Unlike
 * isIncapacitated, this is a HARD blocker on normal ActionCard use: never
 * offered a Use Anyway override (C12) — a dead creature's own table-first
 * exception is Free Edit/a DM ruling, not a one-off per-action override.
 */
export function isDead(entity: Entity): boolean {
  return entity.resources.deathSaves.failures >= 3;
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
 * finding ARCH-2). Condition features are resolved via lookupCondition
 * (official content, then the homebrew conditions the homebrew store
 * registers — this file lives in src/engine/, which deliberately has no
 * dependency on src/store/*, so the store pushes them into
 * content/conditions/index.ts's registry instead).
 *
 * grant_speed and spend_resource (beyond the base activation cost) are
 * still intentionally left for a future pass — not silently claimed as
 * done. grant_speed specifically would need a genuine temporary-effect-
 * tracking mechanism of its own (there's no existing "timed feature grant
 * that isn't a condition" concept to reuse — tickDurations is hardcoded to
 * entity.conditionMonitor.active/.conditions), which is real new
 * architecture, not a contained fix; deferred rather than bolted on as a
 * parallel state system.
 *
 * TABLE-FIRST CORRECTION: apply_condition/remove_condition are gated by
 * `activation` (when the caller passes it — every real call site does).
 * The ARCH-2 fix above made these two effect types apply for real, which
 * was correct for a genuinely self-directed, unconditional ability (Rage-
 * style — target:'self', no save required). It did NOT distinguish that
 * case from a target-contingent one ("target makes a CON save; on failure,
 * becomes Paralyzed" — target:'single'/'area'/'multiple', or gated behind
 * requiresSave): those were applying the condition to the ENTITY USING THE
 * ABILITY, immediately on "Use", regardless of whether a save was ever
 * made or who it was actually meant to affect — e.g. a monster's own
 * Paralyzing Touch would paralyze the monster itself the instant the DM
 * tapped Use. `isSelfAndUnconditional` below is that distinction: only a
 * self-targeting, no-save activation still applies apply_condition/
 * remove_condition immediately. Everything else is left for the human to
 * resolve at the table and apply via the app's existing manual condition
 * picker (QuickPanel/TabCharacter) once the save/hit is actually known —
 * the ability's own description text (always shown on its action card)
 * already states the contingency in prose. Resource spend and action-
 * economy marking (both handled by applyActionCardUse, not here) are
 * unaffected either way — RAW abilities that spend on use regardless of
 * outcome keep doing so.
 */
export function applyAbilityEffects(
  entity:     Entity,
  effects:    AbilityEffect[],
  rules:      CampaignRules = DEFAULT_RULES,
  activation?: FeatureActivation,
): Entity {
  let updated = entity;
  const isSelfAndUnconditional = !activation || (activation.target === 'self' && activation.requiresSave === null);

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
    } else if (effect.type === 'apply_condition' && isSelfAndUnconditional) {
      const features = lookupConditionFor(effect.conditionId, updated.rulesetId)?.features;
      updated = applyCondition(updated, effect.conditionId, 'ability', rules, features, effect.duration);
    } else if (effect.type === 'remove_condition' && isSelfAndUnconditional) {
      updated = removeCondition(updated, effect.conditionId, rules);
    }
    // 'damage' / 'heal': intentionally left to the manual roll+HP-modal flow.
    // 'grant_speed' / 'spend_resource': not yet wired — see the doc comment above.
    // A target-contingent apply_condition/remove_condition (not
    // isSelfAndUnconditional) is intentionally skipped here — see the
    // TABLE-FIRST CORRECTION note above this function.
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
  const form = findBeastForm(formId);
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
 * Applies damage to a Wild-Shaped entity's BEAST hp pool first, not the
 * player's real HP directly.
 *
 * Rules-engine blocker CLOSURE fix (re-audit): the previous implementation
 * split the RAW incoming damage against the beast pool first and only
 * resolved resistance/immunity/vulnerability on the OVERFLOW portion,
 * AFTER reverting — meaning a resisted/vulnerable hit that killed the form
 * had its type-based discount applied to the wrong slice of the hit (the
 * leftover after the form's own HP, not the whole hit), and temp HP never
 * participated in the beast-pool absorption step at all (only the overflow
 * ever touched it). Example the previous version got wrong: form HP 5,
 * fire-resistant, incoming raw fire 10 — old code: overflow = 10-5 = 5
 * (undiscounted) → reverted, applyDamage resolves resistance on THAT →
 * base loses 2. Correct: resistance applies ONCE to the full raw 10 →
 * effective 5 → 5 >= beastHp(5) → reverts with 0 overflow → base loses 0.
 *
 * Corrected order (defenses → temp HP → form HP → overflow → base HP):
 *   1. Resolve resistance/immunity/vulnerability ONCE against the CURRENTLY
 *      TRANSFORMED entity's active effects (collectAllEffects(entity) while
 *      wildShapeState is still active — never re-resolved afterward).
 *   2. Temp HP absorbs from the resolved damage, same as applyDamage's own
 *      semantics — spent exactly once here, whether or not the hit ends up
 *      overflowing the form.
 *   3. The remaining HP damage splits against the beast pool:
 *        D = resolved HP damage (post-defenses, post-temp-HP), F = beastHp
 *        D <  F: form absorbs it all, remains transformed
 *        D >= F: form absorbs F, reverts; (D - F) is ALREADY-RESOLVED
 *                overflow — routed through applyDamage with NO damageType,
 *                so the reverted (base-form) entity's own defenses never
 *                re-process the same hit a second time. Temp HP was
 *                already spent in step 2 (reflected in the reverted
 *                entity's own hp.temp), so applyDamage's own temp-HP
 *                absorption is a correct, harmless no-op there.
 *   D === F is a revert with zero overflow (RAW: hitting exactly 0 still
 *   ends the transformation) — applyDamage is a safe no-op on damage <= 0.
 *
 * Call this INSTEAD of applyDamage while transformed; the caller (UI) is
 * responsible for checking wildShapeState.active first.
 */
export function applyWildShapeDamage(
  entity: Entity,
  damage: number,
  rules:  CampaignRules = DEFAULT_RULES,
  /** Consulted ONCE, up front, against the transformed entity's own active
   *  effects — never re-consulted after reversion (see above). */
  damageType?: string,
  /**
   * Rules-engine blocker RE-AUDIT closure (3B): table-first, PER-HIT fact —
   * "is this damage from a nonmagical weapon/attack?" — the DM/player
   * answers explicitly at the point damage is entered (a checkbox next to
   * the existing damage-type field), never inferred by the engine (which
   * has no concept of an attack being magical). Only consulted when
   * damageType is bludgeoning/piercing/slashing AND the active BeastForm
   * declares nonmagicalPhysicalResistance (see its own doc comment,
   * types.ts). Defaults to false — "unanswered = not nonmagical, resistance
   * does NOT silently apply" — the same conservative-default philosophy
   * Effect.situational already uses elsewhere in this app, so an omitted
   * caller (every pre-existing call site) never gains a discount it wasn't
   * told about.
   */
  isNonmagicalAttack: boolean = false,
): Entity {
  if (!entity.wildShapeState?.active || damage <= 0) return entity;

  const activeForm = findBeastForm(entity.wildShapeState!.formId);
  const nonmagicalBPSApplies = isNonmagicalAttack && !!activeForm?.nonmagicalPhysicalResistance
    && (damageType === 'bludgeoning' || damageType === 'piercing' || damageType === 'slashing');

  let resolvedDamage = damage;
  if (damageType) {
    const response = resolveResistance(damageType, collectAllEffects(entity));
    if (response === 'immunity') return entity;
    // 5e RAW: multiple simultaneous reasons for resistance to the SAME hit
    // still only halve it ONCE — never stacked. nonmagicalBPSApplies is a
    // second, independent reason a hit might be resisted; folded into the
    // SAME single halving as the general resistance check, not a second
    // sequential halving.
    if (response === 'resistance' || nonmagicalBPSApplies) resolvedDamage = Math.floor(damage / 2);
    else if (response === 'vulnerability') resolvedDamage = damage * 2;
  }

  const { hp } = entity.resources;
  const tempAbsorbed = Math.min(hp.temp, resolvedDamage);
  const hpDamage      = resolvedDamage - tempAbsorbed;
  const withTempSpent: Entity = tempAbsorbed > 0
    ? { ...entity, resources: { ...entity.resources, hp: { ...hp, temp: hp.temp - tempAbsorbed } } }
    : entity;

  const beastHp = withTempSpent.wildShapeState!.beastHp;

  if (hpDamage < beastHp) {
    // Remains transformed — the beast form absorbs the already-resolved
    // (post-defense, post-temp-HP) HP damage.
    const updated: Entity = {
      ...withTempSpent,
      wildShapeState: { ...withTempSpent.wildShapeState!, beastHp: beastHp - hpDamage },
    };
    return recomputeDerived(updated, rules);
  }

  const overflow = hpDamage - beastHp;
  const reverted = endWildShape(withTempSpent, rules);
  // No damageType here — resolvedDamage/tempAbsorbed above already fully
  // resolved this hit exactly once; re-passing damageType would let the
  // reverted (base-form) entity's own resistance/vulnerability re-process
  // the same overflow a second time.
  return applyDamage(reverted, overflow, rules);
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

// ── Recharge (e.g. "Recharge 5-6") ───────────────────────────────────────────

/**
 * Parses a "Recharge X-6" / "Recharge X" style recharge TAG (the exact,
 * short canonical form — CustomResource.recharge's open `| string` case,
 * see its own doc comment) into the minimum d6 face needed to succeed.
 * Callers use the null/non-null result to decide whether an app-roll
 * convenience even makes sense to offer for this resource. Table-first:
 * this only ever computes whether a roll WOULD succeed: the primary path
 * (manually marking a resource recharged) already exists via the
 * resource's own +/- controls / a dedicated [Recharge] button and never
 * goes through this function.
 *
 * Closure 3E: strict, ANCHORED parsing — the entire (trimmed) string must
 * be exactly "Recharge N" or "Recharge N-6" (case-insensitive, hyphen or
 * en-dash), N in 2-6. This used to be a loose, unanchored `.match()` that
 * accepted a match found anywhere inside a longer string (so "Recharge 5-6
 * extra junk," or any text merely containing the word "recharge" near a
 * digit, silently parsed) and treated "Recharge 4-5" as threshold 4 by
 * simply ignoring the non-matching "-5" suffix — a pattern this app's
 * engine has no "X-5" semantics for at all (5e recharge abilities are
 * always "Recharge N" or "Recharge N-6," nothing else). Returns null for
 * anything that isn't an exact match: rest-based recharge
 * ('short_rest'/'long_rest'/'dawn'/'never'/'start_of_turn'), freeform
 * homebrew text, or a malformed/partial recharge string.
 */
export function parseRechargeThreshold(recharge: string): number | null {
  const match = recharge.trim().match(/^recharge\s+(\d)(?:\s*[-–]\s*6)?$/i);
  if (!match) return null;
  const threshold = parseInt(match[1], 10);
  return threshold >= 2 && threshold <= 6 ? threshold : null;
}

/**
 * Closure 3A: extracts a monster feature's own "Recharge N[-6]." clause
 * from the START of its printed description — the standard SRD stat-block
 * convention (e.g. "Recharge 5-6. The dragon exhales fire in a..."). Used
 * ONLY at spawn time (monsterFactory.ts) to synthesize a matching
 * CustomResource + resourceCost for a feature that has neither today, so
 * using/recharging it flows through the SAME generic resource-spend/
 * availability machinery every other resource-gated feature (spell slots,
 * Legendary Actions) already uses — no new subsystem. Deliberately
 * anchored to the START of the description, not "found anywhere in it" —
 * the recharge notice is always the opening clause in real stat-block
 * text, and scraping a recharge-shaped substring out of the middle of
 * unrelated prose is exactly the over-permissive behavior closure 3E
 * disallows. Returns the canonical short tag (e.g. "Recharge 5-6", no
 * trailing period) — parseRechargeThreshold above accepts exactly this
 * format back, so the two functions share one definition of "valid."
 */
export function extractRechargeTag(description: string): string | null {
  const match = description.trim().match(/^recharge\s+(\d)(?:\s*[-–]\s*6)?\s*\./i);
  if (!match) return null;
  const threshold = parseInt(match[1], 10);
  if (threshold < 2 || threshold > 6) return null;
  return match[0].slice(0, -1).trim(); // drop the trailing "."
}

/**
 * Closure 2C: extracts a monster feature's "Recharge N[-6]" clause from a
 * canonical `"(Recharge N[-6])"` SUFFIX on its own NAME — real content,
 * e.g. the Ghost's `"Possession (Recharge 6)"`, has no recharge clause at
 * the start of its description at all; the notice is only in the name.
 * Anchored to the END of the (trimmed) name, requiring the exact
 * parenthesized form — controlled parsing, not a substring scan: a name
 * like `"Leadership (Recharges After a Short/Long Rest)"` (real content on
 * a different monster) does NOT match, since "Recharges" (plural) isn't
 * followed by whitespace+digit the way "Recharge 6)" is. Returns the same
 * canonical short tag format extractRechargeTag/parseRechargeThreshold
 * already use (e.g. "Recharge 6"), so all three functions agree on one
 * definition of "valid."
 */
export function extractRechargeTagFromName(name: string): string | null {
  const match = name.trim().match(/\(recharge\s+(\d)(?:\s*[-–]\s*6)?\)$/i);
  if (!match) return null;
  const threshold = parseInt(match[1], 10);
  if (threshold < 2 || threshold > 6) return null;
  return match[0].slice(1, -1).trim(); // drop the surrounding "(" / ")"
}

/**
 * Closure 2C: the single entry point monsterFactory.ts calls to resolve a
 * feature's recharge tag — combines extractRechargeTagFromName and
 * extractRechargeTag under one controlled priority order (the canonical
 * name-suffix form wins over a leading description clause when a feature
 * somehow carries both, so exactly one tag — and therefore exactly one
 * synthesized resource — is ever produced for a single feature). Real
 * content only ever has one or the other (Chimera's Fire Breath: leading
 * description only; Ghost's Possession: name suffix only), so this
 * ordering is defensive rather than something any current content
 * actually exercises both branches of.
 */
export function resolveFeatureRechargeTag(name: string, description: string): string | null {
  return extractRechargeTagFromName(name) ?? extractRechargeTag(description);
}

/**
 * Rolls 1d6 against a "Recharge X-6" threshold — the secondary app-roll
 * convenience. Does NOT restore the resource itself: callers apply the
 * SAME resource-restore mutation (e.g. onResourceChange in the UI, already
 * the resource's own manual "mark recharged" path) only when `success` is
 * true, so both paths always agree on how a resource actually gets
 * restored.
 */
export function rollRecharge(threshold: number): { roll: number; success: boolean } {
  const roll = Math.floor(Math.random() * 6) + 1;
  return { roll, success: roll >= threshold };
}

/**
 * Closure 2 (rechargeable monster ability live use): finds every feature
 * on `entity` whose OWN `activation.resourceCost` resolves to a
 * CustomResource whose `recharge` string parseRechargeThreshold
 * recognizes as a genuine "Recharge N[-6]" pool — e.g. a spawned Chimera's
 * Fire Breath or a spawned Ghost's Possession, both synthesized this way
 * by monsterFactory.ts's spawnMonster. This is the ONE shared discovery
 * used by app/dm/encounter.tsx's QuickPanel to build its "🔄 Rechargeable
 * Abilities" list — extracted here (rather than left as component-local
 * JSX logic) so it's independently testable with real spawned content,
 * proving the actual UI-facing path works, not just a hand-mutated
 * resource. Naturally excludes Legendary Actions' own pool
 * (recharge:'start_of_turn' never matches) and every rest-based/freeform
 * resource — nothing here duplicates another control.
 */
export function findRechargeableFeatures(entity: Entity): { feature: FeatureInstance; resource: CustomResource; threshold: number }[] {
  return entity.features
    .map(f => {
      const resourceId = f.activation?.resourceCost?.resourceId;
      const resource = resourceId ? entity.resources.custom.find(r => r.id === resourceId) : undefined;
      const threshold = resource ? parseRechargeThreshold(resource.recharge) : null;
      return resource && threshold !== null ? { feature: f, resource, threshold } : null;
    })
    .filter((x): x is { feature: FeatureInstance; resource: CustomResource; threshold: number } => x !== null);
}
