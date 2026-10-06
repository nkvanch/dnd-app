import { isFeatureAvailable, isSpellPreparationLegal, resolveSpellCastingContexts, CardGenOptions } from './actionCards';
import { officialClasses } from '../content/runtimeRules';
import { Entity, ActionCard, CampaignRules, ActivationOption, SpellCastingContext, AttackSequenceUse } from './types';
import { applyAbilityEffects, castConcentrationSpell, markActionSlotUsed } from './combat';
import { legalSpellPaymentOptions, commitSpellPayment, SpellPaymentOption } from './spellPayment';
import { recomputeDerived } from './pipeline';
import { spellRepo } from '../content/spellRepo';

/**
 * Applies one use after selection. Activation options specify a requirement;
 * selectedPayment identifies the exact pool/tier. Ambiguous unpaid intent is inert.
 *
 * `bypassSpellPreparation` is the table-first Quick Override ("Cast
 * Anyway") for a leveled spell blocked ONLY by preparation. Passing `true`
 * bypasses PREPARATION eligibility only, for this one cast — it never
 * touches entity.spellcasting.prepared, never marks the spell prepared, and
 * every other legality/cost check (slot, resource, action economy) below
 * still applies exactly as normal.
 *
 * `selectedSpellCastingContext` (rules-engine blocker RE-AUDIT closure 1B/
 * 1D) is the EXACT SpellCastingContext the player is casting through — the
 * card's own default (card.spellCastingContext) when there's nothing to
 * choose between, or the one they explicitly picked from a "Cast as..."
 * chooser when several mechanically distinct sources exist
 * (card.spellCastingContexts). This is revalidated FRESH against the
 * entity's CURRENT sources (by contextKey, not object identity or array
 * position) rather than trusted from generation time — if that exact
 * source no longer exists (e.g. the class/subclass/item that granted it
 * was removed since the card was shown), the cast fails safely here rather
 * than silently re-resolving to some OTHER source the player never chose.
 * Omitted entirely for a non-spell card (card.spellCastingContext is
 * undefined), which falls back to the legacy "is any source legal"
 * behavior unchanged.
 *
 * Both a normal legal cast and a Quick Override cast converge on this
 * exact same function and the exact same mutation logic below — there is
 * no separate/duplicate cast path for either.
 *
 * `content` (rules-engine blocker RE-AUDIT closure — dependency inversion,
 * 1A/1B/1H): the SAME explicit, application-resolved classes/races/homebrew
 * spells/items snapshot the card was generated against (CardGenOptions —
 * generateAllActionCards/generateSpellCard, actionCards.ts). This function
 * never reaches into a store for it; omitting it falls back to the
 * deterministic official-only catalog (officialClasses()), matching every
 * existing caller that hasn't been updated to pass homebrew-aware content.
 * Also threaded into the final recomputeDerived call so the entity's
 * freshly-regenerated actionCards reflect the SAME content this cast used.
 *
 * `bypassIncapacitated` (rules-engine HIGH-batch closure C4/C6/C10) is the
 * table-first Quick Override ("Use Anyway") for a normal action blocked
 * ONLY by the 0HP/Unconscious status restriction. Passing `true` bypasses
 * that ONE legality check for this one use — never healing, never clearing
 * Unconscious, never touching death-save state, and never bypassing the
 * hard `isDead` blocker or any resource/action-economy/preparation check
 * below (isFeatureAvailable itself keeps those independent — see its own
 * doc comment). Appended as the LAST parameter (rather than alongside
 * `bypassSpellPreparation`) so every existing positional call site is
 * unaffected. A card blocked by BOTH preparation and status can have both
 * flags passed together (C7) — they are independent, not mutually
 * exclusive.
 *
 * `castMode` (rules-completeness batch — ritual casting) is `'ritual'` for
 * an explicit ritual cast, undefined for every normal cast. Ritual mode
 * changes exactly two things versus a normal cast of the SAME card: no
 * spell slot (or any other resourceCost) is spent, and no action-economy
 * slot (action/bonus action/reaction) is marked used — see A5's own
 * rationale, a ritual's extra casting time isn't a single combat action,
 * so this app's per-turn economy tracking doesn't apply to it. It does
 * NOT change preparation legality, incapacitation, source/context
 * selection, concentration, or effect application — a ritual cast still
 * needs `bypassSpellPreparation` (Cast Anyway) to go through while
 * unprepared, exactly like a normal cast (see SpellCastingContext.
 * ritualEligible's own doc comment for why this app doesn't model the
 * real-RAW "ritual bypasses prep" nuance). Revalidated fresh here — never
 * trusted from `card.ritualEligible` alone — against the SAME selected
 * context's own `ritualEligible` flag, so a stale/spoofed ritual request
 * for a source that doesn't actually have Ritual Casting is rejected with
 * zero mutation rather than casting for free.
 *
 * `attackSequence` (Extra Attack sequence closure, replacing the removed
 * `isChainedAttack?: boolean` escape hatch) is the caller's request to treat
 * this use as part of a multi-attack Attack action (Extra Attack) or a
 * monster Multiattack — see AttackSequenceUse/AttackSequenceState's own doc
 * comments (types.ts) for the full authority model. A bare boolean could
 * previously be asserted by ANY caller with no verification at all; this is
 * resolved HERE, against `entity.attackSequence` (the engine-owned record of
 * what's actually in progress), never trusted from the caller's intent:
 *
 *   - `attackSequence` omitted: behaves exactly as any ordinary card use
 *     always has — no sequence created, no bypass, unaffected by this
 *     closure.
 *   - `attackSequence` provided, but `card.isWeaponAttack` is not true:
 *     rejected outright (zero mutation) — only a genuine weapon/unarmed
 *     attack card may ever start or continue a sequence (Part C — a spell,
 *     an arbitrary feature, a Bonus Action, or a Reaction can never be
 *     smuggled in as a "chained attack").
 *   - `attackSequence.sequenceId` matches `entity.attackSequence` (and its
 *     `actorId` equals this entity's own id, and it isn't already exhausted
 *     — `usedAttacks < maxAttacks`): a legitimate CHAINED continuation. The
 *     parent Action is NOT re-spent (it was already paid by the lead
 *     attack), but this attack's own `cost` is still fully evaluated and
 *     paid normally (H1 — e.g. a future per-attack resource like
 *     ammunition must remain chargeable).
 *   - Otherwise (no active sequence yet, or the token doesn't match one):
 *     always treated as a brand-new LEAD attack — pays its own Action
 *     exactly like a standalone attack always has, and additionally starts
 *     tracking `entity.attackSequence` on success so a LATER call with the
 *     SAME sequenceId can legally chain off of it. This is what makes an
 *     exhausted/closed/foreign sequence token safe to reuse: it simply
 *     starts a fresh lead attempt, which then fails normally if the Action
 *     was already spent this turn.
 *
 * The core invariant this exists to enforce is unchanged from before this
 * closure: one Attack action containing N attacks consumes exactly ONE
 * Action, never N. Preparation, incapacitation, item-instance revalidation,
 * and effect application are completely unaffected — a chained attack is
 * exactly as legal or illegal as the SAME card used standalone, just without
 * re-spending the Action.
 */
export function applyActionCardUse(
  entity: Entity, card: ActionCard, rules: CampaignRules, chosenOption?: ActivationOption, selectedPayment?: SpellPaymentOption,
  bypassSpellPreparation?: boolean, selectedSpellCastingContext?: SpellCastingContext,
  content: Pick<CardGenOptions, 'classDefs' | 'homebrewSpells' | 'races' | 'items'> = {},
  bypassIncapacitated?: boolean,
  castMode?: 'ritual',
  attackSequence?: AttackSequenceUse,
): Entity {
  let updated = entity;
  const isRitual = castMode === 'ritual';

  // Extra Attack sequence closure: resolve the caller's attackSequence
  // REQUEST (an opaque token) against this entity's OWN authoritative
  // state — never trusted as authority on its own. See AttackSequenceState's
  // doc comment (types.ts) for the full model this enforces.
  let sequenceKind: 'none' | 'lead' | 'chained' = 'none';
  if (attackSequence) {
    // Part C, and Extra Attack sequence closure two-issue final closure
    // (Part A1): only a genuine weapon/unarmed ACTION attack may ever start
    // or continue an Attack-action sequence — rejected with zero mutation
    // before any economy/resource logic runs otherwise. `isWeaponAttack`
    // alone is not trusted here even though card generation should already
    // only ever stamp it true for an actionType:'action' card (Part A2,
    // actionCards.ts) — this authoritative execution path independently
    // re-checks actionType so a misclassified or forged `isWeaponAttack:
    // true` on a Bonus Action/Reaction/passive card can never smuggle a free
    // action-economy bypass through, whether or not card generation's own
    // gate is (or ever becomes) the only place enforcing it.
    if (!card.isWeaponAttack || card.activation.actionType !== 'action') return entity;
    const active = entity.attackSequence;
    if (active && active.sequenceId === attackSequence.sequenceId && active.actorId === entity.id) {
      // A genuine continuation — but only while attacks remain (Part P.2/3/
      // 4/12: an exhausted sequence, even if the token still matches, may
      // never be reused to squeeze out one more free attack).
      if (active.usedAttacks >= active.maxAttacks) return entity;
      sequenceKind = 'chained';
    } else {
      // No active sequence, or the token doesn't match one currently active
      // for THIS entity — always treated as a fresh, independent LEAD
      // attack (Part F/P.10/P.11), never an implicit continuation of some
      // OTHER sequence's progress.
      sequenceKind = 'lead';
    }
  }
  const isChainedAttack = sequenceKind === 'chained';

  // A chained attack and a ritual cast both need the SAME action-economy
  // bypass, for independent reasons (already-spent-by-the-lead-attack vs.
  // no-economy-concept-at-all).
  const bypassActionEconomy = isRitual || isChainedAttack;
  // Ritual: no resourceCost at all (no slot, no other resource — RAW ritual
  // casting costs nothing but time) — `cost` staying null skips both the
  // availability check below AND the spend block further down automatically,
  // one falsy value doing both jobs rather than two separate ritual branches.
  // A chained attack, unlike ritual, still evaluates its OWN `cost` normally
  // — only the action-economy portion is bypassed for it (H1/Part L).
  const cost = isRitual ? null : (chosenOption?.resourceCost ?? card.resourceCost);
  // Part D (action type safety): the card's REAL actionType is preserved —
  // bypassActionEconomySlot (isFeatureAvailable's own 4th param) narrowly
  // skips only the "already used this turn" gate, rather than pretending a
  // ritual/chained attack is a 'passive' feature (which used to also be true
  // here, an architecturally sloppier way to reach the same result).
  const availabilityActivation = { ...card.activation, options: undefined, resourceCost: cost };
  if (!isFeatureAvailable({ activation: availabilityActivation }, entity, bypassIncapacitated, bypassActionEconomy).available) return entity;
  const classDefs = content.classDefs ?? officialClasses();

  // Item-identity closure (pass 2, finding D3/D4): a card generated from a
  // SPECIFIC equipped ItemInstance (card.sourceKind === 'item') must
  // revalidate that EXACT instance is still equipped BEFORE any economy/
  // resource side effect below runs — checked early, like every other
  // legality gate in this function, so a stale card (its instance was
  // removed/unequipped since the card was shown) is rejected with zero
  // partial mutation, never silently falls through to spend a resource
  // and then retarget an identical remaining copy's feature. A card with
  // no sourceId (a non-item card, or one generated before this fix) is
  // unaffected — see the flat-search fallback further below.
  if (card.sourceKind === 'item' && card.sourceId
      && !entity.inventory.equipped.some(inst => inst.id === card.sourceId)) {
    return entity;
  }

  let revalidatedContext: SpellCastingContext | undefined;
  if (card.spellCastingContext) {
    // A spell card — revalidate the SPECIFIC selected context, not "does
    // any source happen to be legal" (that would let a cast that showed
    // the player "Wizard — Not Prepared" execute silently as Sorcerer, or
    // vice versa, if array/tie-break order ever disagreed with what was
    // displayed — exactly the bug this closure fixes). Matched by the
    // context's EXACT identity (contextKey — see its own doc comment,
    // types.ts, for what makes two contexts distinct), never a coarse
    // source-kind/id match that could collide between two mechanically
    // different contexts sharing the same entitlement/feature.
    const requested = selectedSpellCastingContext ?? card.spellCastingContext;
    revalidatedContext = resolveSpellCastingContexts(entity, card.featureId, classDefs)
      .find(c => c.contextKey === requested.contextKey);
    if (!revalidatedContext) return entity; // source disappeared since the card was generated — fail safely, never silently switch
    // Rules-completeness batch (ritual casting), HIGH-fix closure: a
    // RITUAL attempt is gated by `ritualLegal`, never the normal-cast
    // `legal` — for a 'spellbook'-policy source (Wizard) these deliberately
    // disagree while unprepared: `legal` is false (normal casting still
    // requires preparation, untouched by this fix — see A6) but
    // `ritualLegal` is true (2014 RAW: a Wizard may ritual-cast straight
    // from the spellbook with no preparation at all), so Cast Anyway is
    // never needed for a legal Wizard-spellbook ritual. For a 'prepared'-
    // policy source (Cleric/Druid) the two happen to compute to the exact
    // same value (both driven by isPrepared), so nothing changes for them.
    const preparationLegal = isRitual ? revalidatedContext.ritualLegal === true : revalidatedContext.legal;
    if (!bypassSpellPreparation && !preparationLegal) return entity;
  } else if (!bypassSpellPreparation && !isSpellPreparationLegal(entity, card.featureId, classDefs)) {
    return entity;
  }

  // Rules-completeness batch (ritual casting): revalidated fresh against
  // the SAME already-revalidated context — never trusts card.ritualEligible
  // (precomputed at generation time against a best-effort default context,
  // possibly a DIFFERENT one than what's actually selected/still legal) or
  // the caller's own castMode alone. A non-spell card, or a spell that isn't
  // ritual-tagged, or a context whose source has no Ritual Casting policy,
  // all refuse with zero mutation — no free cast on stale/spoofed UI state.
  // (The preparation-legality gate just above already enforced ritualLegal
  // for a policy-bearing context; this ALSO catches the "context supports
  // no ritual policy at all" case — ritualEligible false — even though
  // ritualLegal is false there too, since `spell.ritual` itself still needs
  // checking independently of any class policy.)
  if (isRitual) {
    const ritualSpell = spellRepo.getSpellSync(card.featureId, entity.rulesetId) ?? content.homebrewSpells?.find(s => s.id === card.featureId);
    if (!ritualSpell?.ritual || !revalidatedContext?.ritualEligible) return entity;
  }

  // A-25: mark the action-economy slot used, when the entity is actively
  // tracking a turn (see TurnState's doc comment — a no-op otherwise).
  // Ritual: never marked (A5). Chained attack: never marked either — the
  // LEAD attack of the sequence already marked it; see attackSequence's own
  // doc comment for the full invariant this enforces.
  const actionType = card.activation.actionType;
  if (!bypassActionEconomy && (actionType === 'action' || actionType === 'bonus_action' || actionType === 'reaction')) {
    updated = markActionSlotUsed(updated, actionType);
  }

  if (cost) {
    if (cost.resourceId === 'spell_slots') {
      if (!updated.spellcasting) return entity;
      const legal = legalSpellPaymentOptions(updated.spellcasting, cost.spellSlotTier ?? 1);
      const payment = selectedPayment ?? (legal.length === 1 ? legal[0] : null);
      if (!payment || !legal.some(o => o.kind === payment.kind && o.tier === payment.tier)) return entity;
      const paid = commitSpellPayment(updated, payment);
      if (paid === updated) return entity;
      updated = paid;
    } else {
      const res = updated.resources.custom.find(r => r.id === cost.resourceId);
      if (!res || res.current < cost.quantity) return entity;
      updated = {
        ...updated,
        resources: {
          ...updated.resources,
          custom: updated.resources.custom.map(r =>
            r.id === cost.resourceId ? { ...r, current: Math.max(0, r.current - cost.quantity) } : r
          ),
        },
      };
    }
  }

  // Item-identity closure (pass 2, finding D1/D3): when this card came from
  // a specific ItemInstance, resolve the feature from THAT instance alone
  // (already revalidated as still-equipped above) — never a flat search
  // across every equipped instance's features, which would silently
  // resolve to whichever identical copy happens to appear first. A card
  // with no sourceId falls back to the original "entity.features, then any
  // equipped item's features" search, unchanged for non-item cards and any
  // legacy card generated before this fix.
  const sourceFeature = card.sourceKind === 'item' && card.sourceId
    ? updated.inventory.equipped.find(inst => inst.id === card.sourceId)?.features.find(f => f.id === card.featureId)
    : updated.features.find(f => f.id === card.featureId) ??
      updated.inventory.equipped.flatMap(inst => inst.features).find(f => f.id === card.featureId);
  if (sourceFeature?.abilityEffects && sourceFeature.abilityEffects.length > 0) {
    // Table-first: passing the source feature's own activation lets
    // applyAbilityEffects tell a self-directed, unconditional effect
    // (applies immediately) apart from a target-contingent one (left for
    // manual/table resolution) — see its own doc comment.
    updated = applyAbilityEffects(updated, sourceFeature.abilityEffects, rules, sourceFeature.activation);
  }

  // A spell-granted card's featureId is the spell's own id (see
  // generateSpellCard) — this keeps Actions-tab/Favorites casts of a
  // concentration spell consistent with TabSpells' own handleCast, rather
  // than spending the slot but silently never tracking concentration.
  const spell = spellRepo.getSpellSync(card.featureId, entity.rulesetId);
  if (spell?.concentration) {
    updated = castConcentrationSpell(updated, spell, rules);
  }

  // Extra Attack sequence closure: only reached once EVERY legality/resource
  // check above has already succeeded (Part J — a rejected attack, whatever
  // the reason, returns `entity` above and never reaches here, so it can
  // never advance/start sequence bookkeeping). `updated.attackSequence` is
  // still whatever `entity.attackSequence` was — nothing above this point
  // touches it — so reading it back for the 'chained' branch is exactly the
  // same object `active` was validated against earlier.
  if (sequenceKind === 'lead') {
    const maxAttacks = entity.derived.attackActionAttacks ?? 1;
    // Auto-close immediately when the lead attack IS the only attack this
    // Attack action allows (an ordinary character, maxAttacks 1) — mirrors
    // the 'chained' branch's own auto-close below, so a maxAttacks-1
    // character's sequence never lingers open for a follow-up to (harmlessly
    // but pointlessly) match against.
    updated = {
      ...updated,
      attackSequence: maxAttacks <= 1 ? null : {
        sequenceId: attackSequence!.sequenceId,
        actorId:    entity.id,
        maxAttacks,
        usedAttacks: 1,
      },
    };
  } else if (sequenceKind === 'chained') {
    const active = updated.attackSequence!;
    const usedAttacks = active.usedAttacks + 1;
    // Auto-close on exhaustion (Part R/O): once the last allowed attack
    // executes, the sequence closes itself — an exhausted-but-still-open
    // sequence would otherwise sit around only to be rejected by the
    // usedAttacks>=maxAttacks check above on the next attempt anyway; closing
    // it immediately is equivalent and simpler, and means a stale/foreign
    // reuse attempt is uniformly handled by the "no active sequence → treat
    // as a fresh lead attack, blocked by ordinary action economy" path.
    updated = { ...updated, attackSequence: usedAttacks >= active.maxAttacks ? null : { ...active, usedAttacks } };
  }

  return recomputeDerived(updated, rules, content);
}

