// src/components/sheet/__tests__/FreeEditModal.test.tsx
// Behavioural lock for the Free Edit perf rewrite (CommitInput / memoized
// rows): one edit must produce exactly one apply, an untouched field must
// never create a phantom override, and the native inputs must never be
// recreated by a value change.
import React from 'react';
import { TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { makeEmptyEntity, DEFAULT_RULES } from '../../../store/characterStore';
import { recomputeDerived } from '../../../engine/pipeline';
import { FreeEditModal } from '../FreeEditModal';
import type { Entity } from '../../../engine/types';

const rules = { ...DEFAULT_RULES };

function setup(initial: Entity) {
  let entity = recomputeDerived(initial, rules);
  const applied: Entity[] = [];
  let renderer!: TestRenderer.ReactTestRenderer;
  const element = () => (
    <FreeEditModal
      visible
      entity={entity}
      rules={rules}
      onApply={(updated: Entity) => {
        applied.push(updated);
        entity = recomputeDerived(updated, rules);
        act(() => { renderer.update(element()); });
      }}
      onClose={() => {}}
    />
  );
  act(() => { renderer = TestRenderer.create(element()); });
  const inputs = () => renderer.root.findAllByType(TextInput);
  // The sections mount in staged chunks (PERF-3) — let them all land.
  const settle = () => { for (let i = 0; i < 8; i++) act(() => { jest.advanceTimersByTime(60); }); };
  const initialInputCount = inputs().length;
  settle();
  const stepperButtons = (input: TestRenderer.ReactTestInstance) => {
    let node = input.parent!;
    const isBtn = (n: TestRenderer.ReactTestInstance) => typeof (n.props as { onPress?: unknown })?.onPress === 'function';
    while (node.findAll(isBtn).length < 2) node = node.parent!;
    return node.findAll(isBtn);
  };
  return { applied, inputs, stepperButtons, getEntity: () => entity, initialInputCount };
}

describe('FreeEditModal', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('opens with just the sheet frame and mounts the heavy sections afterwards', () => {
    const t = setup(makeEmptyEntity('fe0'));
    expect(t.initialInputCount).toBe(0);
    // 25 = every non-spellcasting field (a caster adds 9 spell-slot rows).
    expect(t.inputs().length).toBe(25);
  });

  it('a + tap on a base ability applies exactly one change and recreates no native inputs', () => {
    const t = setup(makeEmptyEntity('fe1'));
    const before = t.inputs().map(i => (i as unknown as { _fiber: unknown })._fiber);
    const start = t.getEntity().stats.str;
    const btns = t.stepperButtons(t.inputs()[0]);
    act(() => { btns[btns.length - 1].props.onPress(); });
    expect(t.applied).toHaveLength(1);
    expect(t.applied[0].stats.str).toBe(start + 1);
    // Same TextInput fibers (or their alternates) — nothing was remounted.
    const after = t.inputs().map(i => (i as unknown as { _fiber: { alternate: unknown } })._fiber);
    const known = new Set<unknown>();
    before.forEach(f => { known.add(f); known.add((f as { alternate: unknown }).alternate); });
    expect(after.every(f => known.has(f))).toBe(true);
  });

  it('typing a value and receiving both blur and endEditing applies it once', () => {
    const t = setup(makeEmptyEntity('fe2'));
    act(() => { t.inputs()[0].props.onChangeText('16'); });
    act(() => {
      t.inputs()[0].props.onEndEditing({ nativeEvent: { text: '16' } });
      t.inputs()[0].props.onBlur({});
    });
    expect(t.applied).toHaveLength(1);
    expect(t.applied[0].stats.str).toBe(16);
    expect(t.inputs()[0].props.value).toBe('16');
  });

  it('a value above the ability maximum is clamped and the field shows the real value again', () => {
    const t = setup({ ...makeEmptyEntity('fe3'), stats: { ...makeEmptyEntity('fe3').stats, str: 30 } });
    act(() => { t.inputs()[0].props.onChangeText('99'); });
    act(() => { t.inputs()[0].props.onEndEditing({ nativeEvent: { text: '99' } }); });
    expect(t.applied[t.applied.length - 1].stats.str).toBe(30);
    expect(t.inputs()[0].props.value).toBe('30');
  });

  it('tapping into and out of an untouched override field creates no override', () => {
    const t = setup(makeEmptyEntity('fe4'));
    const overrideStr = t.inputs()[6]; // 6 base rows first, then the ability override rows
    act(() => { overrideStr.props.onBlur({}); });
    act(() => { t.inputs()[6].props.onEndEditing({ nativeEvent: { text: String(t.inputs()[6].props.value) } }); });
    expect(t.applied).toHaveLength(0);
  });

  it('non-numeric text is discarded and the field reverts', () => {
    const t = setup(makeEmptyEntity('fe5'));
    const start = t.getEntity().stats.str;
    act(() => { t.inputs()[0].props.onChangeText('abc'); });
    act(() => { t.inputs()[0].props.onEndEditing({ nativeEvent: { text: 'abc' } }); });
    expect(t.applied).toHaveLength(0);
    expect(t.inputs()[0].props.value).toBe(String(start));
  });
});
