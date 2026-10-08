// Spells tab wiring: restore-a-slot button, manual End Concentration, and the
// separate "Ritual" / "Cast" buttons on a ritual-capable spell.
// Spell data is resident here (in-memory repo) — on device it is loaded first.
jest.mock('../../../content/spellRepo', () => jest.requireActual('../../../content/spellRepo.ts'));
const mockAlerts: { title: string; buttons: { text?: string; onPress?: () => void }[] }[] = [];
jest.mock('../../../utils/alert', () => ({
  Alert: { alert: (title: string, _m: string, buttons: { text?: string; onPress?: () => void }[]) => { mockAlerts.push({ title, buttons }); } },
}));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { makeEmptyEntity, DEFAULT_RULES } from '../../../store/characterStore';
import { acquireClass } from '../../../engine/leveling';
import { recomputeDerived } from '../../../engine/pipeline';
import { grantEntitlement } from '../../../engine/entitlements';
import { castConcentrationSpell } from '../../../engine/combat';
import { ALL_CHAR_CLASSES } from '../../../content/classes';
import { spellRepo } from '../../../content/spellRepo';
import { TabSpells } from '../TabSpells';
import type { Entity } from '../../../engine/types';

const rules = { ...DEFAULT_RULES, hpMode: 'max' as const };

function wizardWith(spellIds: string[]): Entity {
  const wiz = ALL_CHAR_CLASSES.find(c => c.id === 'wizard')!;
  let e = recomputeDerived(acquireClass(makeEmptyEntity('tabspells'), wiz, rules), rules);
  for (const id of spellIds) {
    e = grantEntitlement({ ...e, spellcasting: { ...e.spellcasting!, prepared: [...e.spellcasting!.prepared, id] } },
      { kind: 'spell_access', key: id, sourceKind: 'class', sourceId: 'wizard' });
  }
  return recomputeDerived(e, rules);
}

function mount(entity: Entity) {
  const calls = { update: [] as { e: Entity; label?: string }[], restore: [] as [string, string | undefined][], end: [] as string[] };
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 400, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <TabSpells
        entity={entity}
        rules={rules}
        onEntityUpdate={(e, label) => { calls.update.push({ e, label }); }}
        onEndTurn={() => {}}
        onRestoreSlot={(tier, kind) => { calls.restore.push([tier, kind]); }}
        onEndConcentration={name => { calls.end.push(name); }}
      />
      </SafeAreaProvider>,
    );
  });
  const byLabel = (label: string) => {
    const hit = r.root.findAll(n => n.props?.accessibilityLabel === label && typeof n.props.onPress === 'function');
    return hit[0];
  };
  const press = (label: string) => { const n = byLabel(label); expect(n).toBeDefined(); act(() => { n.props.onPress(); }); };
  return { r, calls, byLabel, press };
}

beforeEach(() => { mockAlerts.length = 0; });

describe('TabSpells — restore a slot', () => {
  it('the + button restores one used slot through the shared handler', async () => {
    await spellRepo.ensureLoaded(['detect_magic']);
    const e = wizardWith(['detect_magic']);
    const used = { ...e, spellcasting: { ...e.spellcasting!, slots: { ...e.spellcasting!.slots, '1': { total: 2, used: 1 } } } };
    const t = mount(recomputeDerived(used, rules));
    t.press('Restore a level 1 slot');
    expect(t.calls.restore).toEqual([['1', 'normal']]);
  });

  it('is disabled when no slot of that level is spent', async () => {
    await spellRepo.ensureLoaded(['detect_magic']);
    const t = mount(wizardWith(['detect_magic']));
    const btn = t.byLabel('Restore a level 1 slot');
    expect(btn.props.disabled).toBe(true);
  });
});

describe('TabSpells — manual End Concentration', () => {
  const bless = {
    id: 'bless', name: 'Bless', level: 1, school: 'Enchantment', castingTime: '1 action', range: '30 feet',
    components: ['V', 'S'], duration: 'Concentration, up to 1 minute', description: '', upcast: null,
    ritual: false, concentration: true, classes: ['cleric'],
  };
  it('shows an End button, asks first, and only ends after confirming', async () => {
    await spellRepo.ensureLoaded(['detect_magic']);
    const e = castConcentrationSpell(wizardWith(['detect_magic']), bless as never, rules);
    const t = mount(e);
    t.press('End concentration');
    expect(t.calls.end).toEqual([]);                       // nothing yet — it asked first
    expect(mockAlerts).toHaveLength(1);
    expect(mockAlerts[0].title).toMatch(/End concentration on/i);
    act(() => { mockAlerts[0].buttons.find(b => b.text === 'End Concentration')!.onPress!(); });
    expect(t.calls.end).toHaveLength(1);
  });

  it('choosing "Keep Concentrating" ends nothing', async () => {
    const e = castConcentrationSpell(wizardWith([]), bless as never, rules);
    const t = mount(e);
    t.press('End concentration');
    act(() => { mockAlerts[0].buttons.find(b => b.text === 'Keep Concentrating')!.onPress?.(); });
    expect(t.calls.end).toEqual([]);
  });

  it('shows no End button when not concentrating', async () => {
    await spellRepo.ensureLoaded(['detect_magic']);
    expect(mount(wizardWith(['detect_magic'])).byLabel('End concentration')).toBeUndefined();
  });
});

describe('TabSpells — ritual vs spell slot', () => {
  it('a ritual-capable spell shows two distinct buttons', async () => {
    await spellRepo.ensureLoaded(['detect_magic']);
    const t = mount(wizardWith(['detect_magic']));
    expect(t.byLabel('Cast Detect Magic as a ritual, no spell slot')).toBeDefined();
    expect(t.byLabel('Cast Detect Magic using a spell slot')).toBeDefined();
  });

  it('a non-ritual spell has just the ordinary Cast button', async () => {
    await spellRepo.ensureLoaded(['magic_missile']);
    const t = mount(wizardWith(['magic_missile']));
    expect(t.byLabel('Cast Magic Missile')).toBeDefined();
    expect(t.byLabel('Cast Magic Missile as a ritual, no spell slot')).toBeUndefined();
  });

  it('Ritual casts without spending a slot and is labelled (Ritual)', async () => {
    await spellRepo.ensureLoaded(['detect_magic']);
    const e = wizardWith(['detect_magic']);
    const t = mount(e);
    t.press('Cast Detect Magic as a ritual, no spell slot');
    expect(t.calls.update).toHaveLength(1);
    expect(t.calls.update[0].label).toBe('Cast Detect Magic (Ritual)');
    expect(t.calls.update[0].e.spellcasting!.slots['1'].used).toBe(e.spellcasting!.slots['1'].used);
  });

  it('Cast spends a slot and is labelled (spell slot)', async () => {
    await spellRepo.ensureLoaded(['detect_magic']);
    const e = wizardWith(['detect_magic']);
    const t = mount(e);
    t.press('Cast Detect Magic using a spell slot');
    expect(t.calls.update).toHaveLength(1);
    expect(t.calls.update[0].label).toBe('Cast Detect Magic (spell slot)');
    expect(t.calls.update[0].e.spellcasting!.slots['1'].used).toBe(e.spellcasting!.slots['1'].used + 1);
  });

  it('with every slot spent, slot Cast is disabled but Ritual still works', async () => {
    await spellRepo.ensureLoaded(['detect_magic']);
    const e = wizardWith(['detect_magic']);
    const spent = recomputeDerived({ ...e, spellcasting: { ...e.spellcasting!, slots: { ...e.spellcasting!.slots, '1': { total: 2, used: 2 } } } }, rules);
    const t = mount(spent);
    expect(t.byLabel('Cast Detect Magic using a spell slot').props.disabled).toBe(true);
    t.press('Cast Detect Magic as a ritual, no spell slot');
    expect(t.calls.update[0].label).toBe('Cast Detect Magic (Ritual)');
  });
});
