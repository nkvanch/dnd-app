import { Entity, SpellcastingBlock, SpellSlots } from './types';

const TIERS = ['1','2','3','4','5','6','7','8','9'] as const;
export type SlotTier = (typeof TIERS)[number];

export type SpellPaymentOption = { kind: 'normal' | 'pact'; tier: SlotTier };

/**
 * Every currently-payable option for a cost requiring at least `minTier`,
 * in the same preference order isFeatureAvailable's own scan already used:
 * ascending tier, normal slot checked before that tier's pact slot. Returns
 * [] when nothing can legally pay (the "no legal slot" case).
 */
export function legalSpellPaymentOptions(
  spellcasting: SpellcastingBlock,
  minTier: number,
): SpellPaymentOption[] {
  const options: SpellPaymentOption[] = [];
  for (const t of TIERS) {
    if (Number(t) < minTier) continue;
    const normal = spellcasting.slots[t];
    if (normal && normal.used >= 0 && normal.used < normal.total) options.push({ kind: 'normal', tier: t });
    const pact = spellcasting.pactSlots?.[t];
    if (pact && pact.used >= 0 && pact.used < pact.total) options.push({ kind: 'pact', tier: t });
  }
  return options;
}

/** Availability only: does not select or mutate. */
export function hasLegalSpellPayment(spellcasting: SpellcastingBlock, minTier: number): boolean {
  return legalSpellPaymentOptions(spellcasting, minTier).length > 0;
}

/** Automatic selection is permitted only for a single legal option. */
export function resolveDefaultPayment(spellcasting: SpellcastingBlock, minTier: number): SpellPaymentOption | null {
  const options = legalSpellPaymentOptions(spellcasting, minTier);
  return options.length === 1 ? options[0] : null;
}

/** Stage C: consumes exactly the selected pool/tier; never resolves a fallback. */
export function commitSpellPayment(entity: Entity, selected: SpellPaymentOption): Entity {
  if (!entity.spellcasting) return entity;
  const spellcasting = spendSpellSlot(entity.spellcasting, selected);
  return spellcasting === entity.spellcasting ? entity : { ...entity, spellcasting };
}

function slotsOf(spellcasting: SpellcastingBlock, kind: SpellPaymentOption['kind']): SpellSlots | undefined {
  return kind === 'pact' ? spellcasting.pactSlots : spellcasting.slots;
}

/**
 * Atomically debits exactly one use of `option`. Invariant enforced
 * unconditionally: if the targeted slot doesn't exist or is already fully
 * spent (used >= total), returns `spellcasting` UNCHANGED — a spend can
 * never increase availability, and never allows `used` to exceed `total`.
 */
export function spendSpellSlot(spellcasting: SpellcastingBlock, option: SpellPaymentOption): SpellcastingBlock {
  const pool = slotsOf(spellcasting, option.kind);
  const slot = pool?.[option.tier];
  if (!pool || !slot || slot.used < 0 || slot.used >= slot.total) return spellcasting;
  const nextPool: SpellSlots = { ...pool, [option.tier]: { ...slot, used: slot.used + 1 } };
  return option.kind === 'pact' ? { ...spellcasting, pactSlots: nextPool } : { ...spellcasting, slots: nextPool };
}

/**
 * Atomically credits back exactly one use of `option` (manual "un-spend" /
 * DM correction / rest restoration building block). Invariant enforced
 * unconditionally: if the slot doesn't exist or is already at 0 used,
 * returns `spellcasting` UNCHANGED — a restore can never exceed `total` or
 * go negative.
 */
export function restoreSpellSlot(spellcasting: SpellcastingBlock, option: SpellPaymentOption): SpellcastingBlock {
  const pool = slotsOf(spellcasting, option.kind);
  const slot = pool?.[option.tier];
  if (!pool || !slot || slot.used <= 0) return spellcasting;
  const nextPool: SpellSlots = { ...pool, [option.tier]: { ...slot, used: slot.used - 1 } };
  return option.kind === 'pact' ? { ...spellcasting, pactSlots: nextPool } : { ...spellcasting, slots: nextPool };
}
