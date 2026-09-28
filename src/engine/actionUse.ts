import { isFeatureAvailable, isSpellPreparationLegal, resolveSpellCastingContexts, CardGenOptions } from './actionCards';
import { Entity, ActionCard, CampaignRules, ActivationOption, SpellCastingContext } from './types';
import { applyAbilityEffects, castConcentrationSpell, markActionSlotUsed } from './combat';
import { legalSpellPaymentOptions, commitSpellPayment, SpellPaymentOption } from './spellPayment';
import { recomputeDerived } from './pipeline';
import { spellRepo } from '../content/spellRepo';
import { ALL_CHAR_CLASSES } from '../content/classes';

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
 * deterministic official-only catalog (ALL_CHAR_CLASSES), matching every
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
 */
export function applyActionCardUse(
  entity: Entity, card: ActionCard, rules: CampaignRules, chosenOption?: ActivationOption, selectedPayment?: SpellPaymentOption,
  bypassSpellPreparation?: boolean, selectedSpellCastingContext?: SpellCastingContext,
  content: Pick<CardGenOptions, 'classDefs' | 'homebrewSpells' | 'races' | 'items'> = {},
  bypassIncapacitated?: boolean,
  castMode?: 'ritual',
): Entity {
  let updated = entity;
  const isRitual = castMode === 'ritual';
  // Ritual: no resourceCost at all (no slot, no other resource — RAW ritual
  // casting costs nothing but time) — `cost` staying null skips both the
  // availability check below AND the spend block further down automatically,
  // one falsy value doing both jobs rather than two separate ritual branches.
  const cost = isRitual ? null : (chosenOption?.resourceCost ?? card.resourceCost);
  // Ritual: reports actionType as 'passive' (a real FeatureActivation
  // value meaning "no action-economy tracked") so the turn-based action-
  // economy gate (isFeatureAvailable → resourceAndEconomyLegal) never
  // applies — a 10-minutes-longer ritual cast isn't the single 6-second
  // action/bonus action/reaction this tracking exists for (A5).
  const availabilityActivation = { ...card.activation, options: undefined, resourceCost: cost, actionType: isRitual ? 'passive' as const : card.activation.actionType };
  if (!isFeatureAvailable({ activation: availabilityActivation }, entity, bypassIncapacitated).available) return entity;
  const classDefs = content.classDefs ?? ALL_CHAR_CLASSES;

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
    const ritualSpell = spellRepo.getSpellSync(card.featureId) ?? content.homebrewSpells?.find(s => s.id === card.featureId);
    if (!ritualSpell?.ritual || !revalidatedContext?.ritualEligible) return entity;
  }

  // A-25: mark the action-economy slot used, when the entity is actively
  // tracking a turn (see TurnState's doc comment — a no-op otherwise).
  // Ritual: never marked — see castMode's own doc comment (A5).
  const actionType = card.activation.actionType;
  if (!isRitual && (actionType === 'action' || actionType === 'bonus_action' || actionType === 'reaction')) {
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
  const spell = spellRepo.getSpellSync(card.featureId);
  if (spell?.concentration) {
    updated = castConcentrationSpell(updated, spell, rules);
  }

  return recomputeDerived(updated, rules, content);
}

