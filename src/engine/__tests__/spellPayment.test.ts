// src/engine/__tests__/spellPayment.test.ts
// Re-audit items 1/2/24 (A12): the one shared spell-slot payment resolver.
// Dedicated coverage for the invariant itself (spend can never become a
// restoration, never exceeds total, never goes negative) plus the
// exact/higher/pact payment-option resolution isFeatureAvailable and
// applyActionCardUse both now delegate to.
import {
  legalSpellPaymentOptions, hasLegalSpellPayment, resolveDefaultPayment,
  spendSpellSlot, restoreSpellSlot,
} from '../spellPayment';
import { SpellcastingBlock, SpellSlots } from '../types';

function slots(overrides: Partial<Record<string, { total: number; used: number }>> = {}): SpellSlots {
  const tiers = ['1','2','3','4','5','6','7','8','9'] as const;
  const out = {} as SpellSlots;
  for (const t of tiers) out[t] = { total: 0, used: 0 };
  return { ...out, ...overrides };
}

function block(overrides: Partial<SpellcastingBlock> = {}): SpellcastingBlock {
  return { ability: 'int', slots: slots(), cantrips: [], known: [], prepared: [], concentrating: null, ...overrides };
}

describe('spendSpellSlot — the invariant', () => {
  it('spends one use of an exact tier with room', () => {
    const sc = block({ slots: slots({ '1': { total: 2, used: 0 } }) });
    const after = spendSpellSlot(sc, { kind: 'normal', tier: '1' });
    expect(after.slots['1']).toEqual({ total: 2, used: 1 });
  });

  it('never allows a spend to increase availability: at 0 remaining, spending again is a no-op, not an increase', () => {
    const sc = block({ slots: slots({ '1': { total: 2, used: 2 } }) });
    const after = spendSpellSlot(sc, { kind: 'normal', tier: '1' });
    expect(after).toBe(sc); // unchanged reference — genuinely a no-op
    expect(after.slots['1']).toEqual({ total: 2, used: 2 });
  });

  it('never lets used exceed total across repeated spends', () => {
    let sc = block({ slots: slots({ '1': { total: 1, used: 0 } }) });
    for (let i = 0; i < 5; i++) sc = spendSpellSlot(sc, { kind: 'normal', tier: '1' });
    expect(sc.slots['1'].used).toBeLessThanOrEqual(sc.slots['1'].total);
    expect(sc.slots['1']).toEqual({ total: 1, used: 1 });
  });

  it('spends from a pact slot when kind: pact', () => {
    const sc = block({ slots: slots(), pactSlots: slots({ '2': { total: 1, used: 0 } }) });
    const after = spendSpellSlot(sc, { kind: 'pact', tier: '2' });
    expect(after.pactSlots!['2']).toEqual({ total: 1, used: 1 });
    expect(after.slots['2']).toEqual({ total: 0, used: 0 }); // normal pool untouched
  });

  it('no-ops when the pool is absent entirely (e.g. pact requested but no pactSlots)', () => {
    const sc = block({ slots: slots({ '1': { total: 2, used: 0 } }) });
    const after = spendSpellSlot(sc, { kind: 'pact', tier: '1' });
    expect(after).toBe(sc);
  });
});

describe('restoreSpellSlot — the invariant, symmetric', () => {
  it('restores one use', () => {
    const sc = block({ slots: slots({ '3': { total: 2, used: 1 } }) });
    const after = restoreSpellSlot(sc, { kind: 'normal', tier: '3' });
    expect(after.slots['3']).toEqual({ total: 2, used: 0 });
  });

  it('never lets used go negative — restoring at 0 used is a no-op', () => {
    const sc = block({ slots: slots({ '3': { total: 2, used: 0 } }) });
    const after = restoreSpellSlot(sc, { kind: 'normal', tier: '3' });
    expect(after).toBe(sc);
    expect(after.slots['3']).toEqual({ total: 2, used: 0 });
  });
});

describe('legalSpellPaymentOptions / hasLegalSpellPayment / resolveDefaultPayment', () => {
  it('requires selection when more than one normal tier has room', () => {
    const sc = block({ slots: slots({ '1': { total: 1, used: 0 }, '2': { total: 1, used: 0 } }) });
    expect(resolveDefaultPayment(sc, 1)).toBeNull();
  });

  it('falls back to a higher tier when the exact tier is exhausted (closes A12)', () => {
    const sc = block({ slots: slots({ '1': { total: 1, used: 1 }, '2': { total: 1, used: 0 } }) });
    expect(hasLegalSpellPayment(sc, 1)).toBe(true); // availability check
    expect(resolveDefaultPayment(sc, 1)).toEqual({ kind: 'normal', tier: '2' }); // actual debit picks the SAME option
  });

  it('falls back to a pact slot when no normal slot at or above the tier has room', () => {
    const sc = block({ slots: slots({ '1': { total: 1, used: 1 } }), pactSlots: slots({ '1': { total: 1, used: 0 } }) });
    expect(resolveDefaultPayment(sc, 1)).toEqual({ kind: 'pact', tier: '1' });
  });

  it('reports no legal option and resolves null when everything at or above the tier is exhausted', () => {
    const sc = block({ slots: slots({ '1': { total: 1, used: 1 }, '2': { total: 1, used: 1 } }) });
    expect(hasLegalSpellPayment(sc, 1)).toBe(false);
    expect(resolveDefaultPayment(sc, 1)).toBeNull();
    expect(legalSpellPaymentOptions(sc, 1)).toEqual([]);
  });

  it('never offers a tier below the minimum required', () => {
    const sc = block({ slots: slots({ '1': { total: 1, used: 0 } }) });
    expect(legalSpellPaymentOptions(sc, 2)).toEqual([]);
  });
});

// Closure item 1: TabCharacter.tsx's spell-slot pip row used to compute
// `i < slot.used ? onRestoreSlot(tier) : onSpendSlot(tier)` per pip — once
// every pip was "used" (slot.used === slot.total), EVERY tap satisfied
// `i < slot.used`, so an ordinary tap on a fully-exhausted slot row could
// only ever restore, silently healing a slot back with no explicit intent.
// Fixed by making every pip tap call spend unconditionally (restoration is
// now a separate, explicit "+" control) — this locks in the underlying
// invariant that fix depends on: spending against an exhausted pool is a
// pure no-op, never a de-facto restore.
describe('spendSpellSlot — exhausted pool never restores (closure item 1)', () => {
  it('total=2, used=2: repeated "spend" calls (what an ordinary pip tap now always sends) leave used=2', () => {
    const sc = block({ slots: slots({ '1': { total: 2, used: 2 } }) });
    const afterFirstTap  = spendSpellSlot(sc, { kind: 'normal', tier: '1' });
    const afterSecondTap = spendSpellSlot(afterFirstTap, { kind: 'normal', tier: '1' });
    expect(afterFirstTap.slots['1']).toEqual({ total: 2, used: 2 });
    expect(afterSecondTap.slots['1']).toEqual({ total: 2, used: 2 });
    expect(afterFirstTap).toBe(sc); // unchanged reference — genuinely a no-op, not a 0-delta mutation
  });

  it('restoration only happens via the explicit restore call, never as a side effect of spend', () => {
    const sc = block({ slots: slots({ '1': { total: 2, used: 2 } }) });
    expect(spendSpellSlot(sc, { kind: 'normal', tier: '1' }).slots['1'].used).toBe(2);
    expect(restoreSpellSlot(sc, { kind: 'normal', tier: '1' }).slots['1'].used).toBe(1);
  });
});
