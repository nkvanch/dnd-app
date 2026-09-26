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
 */
export function applyActionCardUse(
  entity: Entity, card: ActionCard, rules: CampaignRules, chosenOption?: ActivationOption, selectedPayment?: SpellPaymentOption,
  bypassSpellPreparation?: boolean, selectedSpellCastingContext?: SpellCastingContext,
  content: Pick<CardGenOptions, 'classDefs' | 'homebrewSpells' | 'races' | 'items'> = {},
  bypassIncapacitated?: boolean,
): Entity {
  let updated = entity;
  const cost = chosenOption?.resourceCost ?? card.resourceCost;
  if (!isFeatureAvailable({ activation: { ...card.activation, options: undefined, resourceCost: cost } }, entity, bypassIncapacitated).available) return entity;
  const classDefs = content.classDefs ?? ALL_CHAR_CLASSES;

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
    const revalidated = resolveSpellCastingContexts(entity, card.featureId, classDefs)
      .find(c => c.contextKey === requested.contextKey);
    if (!revalidated) return entity; // source disappeared since the card was generated — fail safely, never silently switch
    if (!bypassSpellPreparation && !revalidated.legal) return entity;
  } else if (!bypassSpellPreparation && !isSpellPreparationLegal(entity, card.featureId, classDefs)) {
    return entity;
  }

  // A-25: mark the action-economy slot used, when the entity is actively
  // tracking a turn (see TurnState's doc comment — a no-op otherwise).
  const actionType = card.activation.actionType;
  if (actionType === 'action' || actionType === 'bonus_action' || actionType === 'reaction') {
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

  // Look in both entity.features and equipped-item features since either
  // can produce an action card.
  const sourceFeature =
    updated.features.find(f => f.id === card.featureId) ??
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

