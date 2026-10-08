jest.mock('react-native/Libraries/Modal/Modal', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => children }));
import React from 'react';
import { useSpellPayment } from '../SpellPaymentChooser';
import { makeEmptyEntity } from '../../../store/characterStore';
import { slotsFromCountArray } from '../../../content/classes/spellSlotTables';
import { ActionCard } from '../../../engine/types';
const { create, act } = require('react-test-renderer');

describe('payment chooser', () => {
  it('cancellation has no debit and an explicit selected pact option is delivered exactly once', () => {
    const entity = { ...makeEmptyEntity('chooser'), spellcasting: {
      ability: 'int' as const, known: [], cantrips: [], prepared: [], concentrating: null,
      slots: slotsFromCountArray([0, 1, 0, 0, 0, 0, 0, 0, 0]),
      pactSlots: slotsFromCountArray([0, 1, 0, 0, 0, 0, 0, 0, 0]),
    } };
    const before = JSON.stringify(entity);
    let api!: ReturnType<typeof useSpellPayment>;
    function Harness() { api = useSpellPayment(entity); return api.paymentChooser; }
    let renderer: ReturnType<typeof create>;
    const card = { resourceCost: { resourceId: 'spell_slots', spellSlotTier: 1, quantity: 1 } } as ActionCard;
    const commit = jest.fn();
    act(() => { renderer = create(<Harness />); });
    act(() => api.requestPayment(card, undefined, commit));
    expect(commit).not.toHaveBeenCalled();
    let buttons = renderer.root.findAll((node: { props: Record<string, unknown> }) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function');
    const staleCommit = buttons[1].props.onPress;
    act(() => buttons[2].props.onPress());
    act(() => staleCommit());
    expect(commit).not.toHaveBeenCalled();
    expect(JSON.stringify(entity)).toBe(before);
    act(() => api.requestPayment(card, undefined, commit));
    buttons = renderer.root.findAll((node: { props: Record<string, unknown> }) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function');
    const choose = buttons[1].props.onPress;
    act(() => { choose(); choose(); });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith({ kind: 'pact', tier: '2' });
    act(() => renderer.unmount());
  });
});
