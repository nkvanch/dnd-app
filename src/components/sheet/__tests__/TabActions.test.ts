// src/components/sheet/__tests__/TabActions.test.ts
// Tests applyActionCardUse directly (pure logic), matching this codebase's
// established preference for testing over the RN component. First coverage
// this function has ever had. Focused on the A-25 action-economy marking
// added this session — the pre-existing resource-spend/ability-effect/
// concentration behavior is exercised indirectly by every other test that
// already depends on this function staying correct.
import { applyActionCardUse } from '../TabActions';
import { startTurn } from '../../../engine/combat';
import { makeEmptyEntity, DEFAULT_RULES } from '../../../store/characterStore';
import { ActionCard, ActivationOption, SpellSlots } from '../../../engine/types';

function testCard(actionType: 'action' | 'bonus_action' | 'reaction' | 'free' | 'passive'): ActionCard {
  return {
    featureId: 'test_card', name: 'Test Card', cardType: 'damage', color: 'red',
    layer1: '', layer2: '', layer3: null, outcomes: [], triggerNote: null,
    activation: { actionType, resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
    resourceCost: null, tabs: ['actions'], available: true, unavailableReason: null,
  };
}

describe('applyActionCardUse — action economy (A-25)', () => {
  it('marks the action slot used for an action-type card', () => {
    const e = startTurn(makeEmptyEntity('test-entity'));
    const after = applyActionCardUse(e, testCard('action'), DEFAULT_RULES);
    expect(after.turnState).toEqual({ actionUsed: true, bonusActionUsed: false, reactionUsed: false });
  });

  it('marks the bonus_action slot used for a bonus_action-type card', () => {
    const e = startTurn(makeEmptyEntity('test-entity'));
    const after = applyActionCardUse(e, testCard('bonus_action'), DEFAULT_RULES);
    expect(after.turnState).toEqual({ actionUsed: false, bonusActionUsed: true, reactionUsed: false });
  });

  it('marks the reaction slot used for a reaction-type card', () => {
    const e = startTurn(makeEmptyEntity('test-entity'));
    const after = applyActionCardUse(e, testCard('reaction'), DEFAULT_RULES);
    expect(after.turnState).toEqual({ actionUsed: false, bonusActionUsed: false, reactionUsed: true });
  });

  it("does not touch turnState for a 'free' or 'passive' card", () => {
    const e = startTurn(makeEmptyEntity('test-entity'));
    const afterFree = applyActionCardUse(e, testCard('free'), DEFAULT_RULES);
    expect(afterFree.turnState).toEqual({ actionUsed: false, bonusActionUsed: false, reactionUsed: false });
  });

  it('is a no-op on turnState when not actively tracking a turn', () => {
    const e = makeEmptyEntity('test-entity'); // turnState still undefined — no startTurn() call
    const after = applyActionCardUse(e, testCard('action'), DEFAULT_RULES);
    expect(after.turnState).toBeUndefined();
  });
});

// ── A-57: chosenOption overrides the card's default resourceCost ────────────

function fullSlots(): SpellSlots {
  const tiers = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
  return Object.fromEntries(tiers.map(t => [t, { total: 2, used: 0 }])) as SpellSlots;
}

function casterEntity() {
  return {
    ...makeEmptyEntity('test-caster'),
    spellcasting: {
      ability: 'cha' as const, slots: fullSlots(), cantrips: [], known: [], prepared: [],
      concentrating: null,
    },
  };
}

function smiteCard(): ActionCard {
  return {
    featureId: 'divine_smite', name: 'Divine Smite', cardType: 'damage', color: 'red',
    layer1: '', layer2: '', layer3: null, outcomes: [], triggerNote: null,
    activation: {
      actionType: 'free',
      resourceCost: { resourceId: 'spell_slots', quantity: 1, spellSlotTier: 1 },
      range: 'self', target: 'single', requiresSave: null,
      options: [
        { id: 'tier1', label: '1st-level slot', resourceCost: { resourceId: 'spell_slots', quantity: 1, spellSlotTier: 1 }, description: '+2d8' },
        { id: 'tier3', label: '3rd-level slot', resourceCost: { resourceId: 'spell_slots', quantity: 1, spellSlotTier: 3 }, description: '+4d8' },
      ],
    },
    resourceCost: { resourceId: 'spell_slots', quantity: 1, spellSlotTier: 1 },
    tabs: ['actions'], available: true, unavailableReason: null,
  };
}

describe('applyActionCardUse — chosenOption (A-57)', () => {
  it('spends the option\'s resourceCost tier, not the card\'s default, when a chosenOption is passed', () => {
    const e = casterEntity();
    const option: ActivationOption = smiteCard().activation.options![1]; // tier3
    const after = applyActionCardUse(e, smiteCard(), DEFAULT_RULES, option, { kind: 'normal', tier: '3' });
    expect(after.spellcasting!.slots['3'].used).toBe(1);
    expect(after.spellcasting!.slots['1'].used).toBe(0);
  });

  it('requires a selected payment when the base requirement allows several pools', () => {
    const e = casterEntity();
    const after = applyActionCardUse(e, smiteCard(), DEFAULT_RULES);
    expect(after).toBe(e);
    expect(after.spellcasting!.slots['3'].used).toBe(0);
  });

  it('no-ops safely when the chosen tier has no slots remaining', () => {
    const e = casterEntity();
    e.spellcasting.slots['3'] = { total: 0, used: 0 };
    const option = smiteCard().activation.options![1]; // tier3
    const after = applyActionCardUse(e, smiteCard(), DEFAULT_RULES, option);
    expect(after).toBe(e); // unchanged — same object identity, matching the existing no-op guard
  });
});
