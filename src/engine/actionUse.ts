import { isFeatureAvailable } from './actionCards';
import { Entity, ActionCard, CampaignRules, ActivationOption } from './types';
import { applyAbilityEffects, castConcentrationSpell, markActionSlotUsed } from './combat';
import { legalSpellPaymentOptions, commitSpellPayment, SpellPaymentOption } from './spellPayment';
import { recomputeDerived } from './pipeline';
import { spellRepo } from '../content/spellRepo';

/** Applies one use after selection. Activation options specify a requirement;
 * selectedPayment identifies the exact pool/tier. Ambiguous unpaid intent is inert. */
export function applyActionCardUse(
  entity: Entity, card: ActionCard, rules: CampaignRules, chosenOption?: ActivationOption, selectedPayment?: SpellPaymentOption,
): Entity {
  let updated = entity;
  const cost = chosenOption?.resourceCost ?? card.resourceCost;
  if (!isFeatureAvailable({ activation: { ...card.activation, options: undefined, resourceCost: cost } }, entity).available) return entity;

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
    updated = applyAbilityEffects(updated, sourceFeature.abilityEffects, rules);
  }

  // A spell-granted card's featureId is the spell's own id (see
  // generateSpellCard) — this keeps Actions-tab/Favorites casts of a
  // concentration spell consistent with TabSpells' own handleCast, rather
  // than spending the slot but silently never tracking concentration.
  const spell = spellRepo.getSpellSync(card.featureId);
  if (spell?.concentration) {
    updated = castConcentrationSpell(updated, spell, rules);
  }

  return recomputeDerived(updated, rules);
}

