// Phase 4: mode groups — atomic switching, mode-owned state, level gating,
// table-roll selectors (roll / physical / pick-best / re-roll / free choice),
// spirit-granted spells, and per-target modes.
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../pipeline';
import { setRandomSource } from '../dice';
import {
  setMode, startModePeriod, pickPendingRoll, rerollMode, modeSelectorInfo, clearMode, setTargetMode, removeTargetMode,
  setExtraTargets, modeRerollResourceId,
} from '../modes';
import { syncAllyGrants } from '../allyGrants';
import { endConcentration } from '../combat';
import type { Entity, Feature, ModeGroup, FeatureInstance } from '../types';

const R = DEFAULT_RULES;

const feature = (id: string, extra: Partial<Feature> = {}): Feature => ({
  id, name: id, description: id, source: { kind: 'class', refId: 'test' }, level: null,
  actions: [], choices: [], passive: true, effects: [], ...extra,
});

// ── "Test Form": the proposal's acceptance fixture ──────────────────────────
const testForm: ModeGroup = {
  id: 'form', name: 'Test Form', optionLabel: 'Form', scope: 'self', selector: { kind: 'choice' },
  options: [
    { id: 'a', name: 'Form A', entries: [{ level: 1,
      features: [
        feature('a_speed', { effects: [{ type: 'stat_modifier', target: 'speed', operation: 'add', value: 10, condition: null }] }),
        feature('a_action', { passive: false, activation: { actionType: 'action', resourceCost: { resourceId: 'a_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null } }),
      ],
      resources: [{ resourceId: 'a_pool', name: 'A pool', maximum: 2, recharge: 'long_rest' }] }] },
    { id: 'b', name: 'Form B', entries: [{ level: 1, features: [
      feature('b_str', { effects: [{ type: 'stat_modifier', target: 'str', operation: 'set', value: 18, condition: null }] }),
      feature('b_spells', { effects: [{ type: 'grant_spell', target: 'x', operation: 'add', value: null, condition: null, spellIds: ['shield_of_faith'], cantripIds: ['guidance'], spellcastingAbility: 'cha' }] }),
    ] }] },
    { id: 'c', name: 'Form C', entries: [{ level: 1, features: [feature('c_feat')] }, { level: 5, features: [feature('c_late')] }] },
  ],
};

function withGroup(group: ModeGroup, level = 1, extra: Partial<Entity> = {}): Entity {
  const e = makeEmptyEntity('m');
  const carrier: FeatureInstance = { ...feature('carrier', { modeGroup: group }), isActive: true };
  return recomputeDerived({ ...e, identity: { ...e.identity, name: 'M', level }, features: [carrier], ...extra }, R);
}
const mode = (e: Entity, g: string, o: string, how: Parameters<typeof setMode>[3] = 'choice') => recomputeDerived(setMode(e, g, o, how), R);
const ids = (e: Entity) => e.features.filter(f => f.source.kind === 'mode').map(f => f.id).sort();

describe('self-scope switching', () => {
  it('starts with nothing active; A → B → A → C → A → B swaps grants atomically with nothing leaking', () => {
    let e = withGroup(testForm);
    expect(ids(e)).toEqual([]);
    e = mode(e, 'form', 'a');
    expect(ids(e)).toEqual(['form__a__a_action', 'form__a__a_speed']);
    expect(e.derived.speed).toBe(makeEmptyEntity('x').derived.speed + 10);
    e = mode(e, 'form', 'b');
    expect(ids(e)).toEqual(['form__b__b_spells', 'form__b__b_str']);
    expect(e.derived.speed).toBe(makeEmptyEntity('x').derived.speed);
    expect(e.stats.str).not.toBe(18);                     // base score untouched; effect is derived only
    e = mode(e, 'form', 'a'); e = mode(e, 'form', 'c'); e = mode(e, 'form', 'a'); e = mode(e, 'form', 'b');
    expect(ids(e)).toEqual(['form__b__b_spells', 'form__b__b_str']);
    expect(e.modeStates!.form.history.map(h => h.optionId)).toEqual(['a', 'b', 'a', 'c', 'a', 'b']);
  });

  it('a pool spent in A stays spent when you leave and return, and is hidden while away', () => {
    let e = mode(withGroup(testForm), 'form', 'a');
    const poolId = 'form__a__a_pool';
    expect(e.resources.custom.find(r => r.id === poolId)).toMatchObject({ current: 2, maximum: 2, sourceKind: 'mode' });
    // the action card references the namespaced pool
    expect(e.features.find(f => f.id === 'form__a__a_action')!.activation!.resourceCost!.resourceId).toBe(poolId);
    e = { ...e, resources: { ...e.resources, custom: e.resources.custom.map(r => r.id === poolId ? { ...r, current: 0 } : r) } };
    e = mode(e, 'form', 'b');
    expect(e.resources.custom.find(r => r.id === poolId)).toMatchObject({ current: 0, inactive: true });
    e = mode(e, 'form', 'a');
    expect(e.resources.custom.find(r => r.id === poolId)).toMatchObject({ current: 0, inactive: false });
  });

  it('switching to the already-active option changes nothing structural; unknown option is ignored', () => {
    const e = mode(withGroup(testForm), 'form', 'a');
    expect(setMode(e, 'form', 'nope')).toBe(e);
    expect(setMode(e, 'nogroup', 'a')).toBe(e);
    expect(ids(mode(e, 'form', 'a'))).toEqual(ids(e));
  });

  it('level gating: later entries unlock automatically on level-up and are not granted early', () => {
    let e = mode(withGroup(testForm, 3), 'form', 'c');
    expect(ids(e)).toEqual(['form__c__c_feat']);
    e = recomputeDerived({ ...e, identity: { ...e.identity, level: 5 } }, R);
    expect(ids(e)).toEqual(['form__c__c_feat', 'form__c__c_late']);
    // binding at a high level grants everything up to that level immediately
    expect(ids(mode(withGroup(testForm, 12), 'form', 'c'))).toEqual(['form__c__c_feat', 'form__c__c_late']);
  });

  it('class-level source: only the owning class level counts', () => {
    const g: ModeGroup = { ...testForm, levelSource: { kind: 'class', classId: 'emp' } };
    let e = withGroup(g, 10, { identity: { ...makeEmptyEntity('x').identity, level: 10, classes: [
      { classId: 'fighter' as never, subclassId: null, level: 6 }, { classId: 'emp' as never, subclassId: null, level: 4 }] } as never });
    e = mode(e, 'form', 'c');
    expect(ids(e)).toEqual(['form__c__c_feat']);                         // 4 < 5
  });

  it('spirit-granted spells exist only while the option is active', () => {
    let e = mode(withGroup(testForm), 'form', 'b');
    expect(e.spellcasting!.known).toContain('shield_of_faith');
    expect(e.spellcasting!.cantrips).toContain('guidance');
    e = mode(e, 'form', 'a');
    expect(e.spellcasting?.known ?? []).not.toContain('shield_of_faith');
    expect(e.spellcasting?.cantrips ?? []).not.toContain('guidance');
    e = mode(e, 'form', 'b');
    expect(e.spellcasting!.known).toContain('shield_of_faith');
  });

  it('removing the carrier feature removes everything the group materialized', () => {
    const e = mode(withGroup(testForm), 'form', 'a');
    const gone = recomputeDerived({ ...e, features: e.features.filter(f => f.id !== 'carrier') }, R);
    expect(ids(gone)).toEqual([]);
    expect(gone.resources.custom.filter(r => r.sourceKind === 'mode')).toEqual([]);
  });

  it('clearMode only when the group does not require an active option', () => {
    const e = mode(withGroup(testForm), 'form', 'a');
    expect(ids(recomputeDerived(clearMode(e, 'form'), R))).toEqual([]);
    const req = mode(withGroup({ ...testForm, requireActiveOption: true }), 'form', 'a');
    expect(clearMode(req, 'form')).toBe(req);
  });
});

// ── table selector: Legacy Binding shape ────────────────────────────────────
const legacy: ModeGroup = {
  id: 'legacy', name: 'Legacy Binding', optionLabel: 'Bound Spirit', scope: 'self', requireActiveOption: true,
  options: Array.from({ length: 12 }, (_, i) => ({ id: `s${i + 1}`, name: `Spirit ${i + 1}`, entries: [{ level: 1, features: [feature(`f${i + 1}`)] }] })),
  selector: { kind: 'table', die: 12, periodLabel: 'in-game month',
    pickBest: [{ level: 11, rolls: 2 }], reroll: { level: 3, perPeriod: 1 }, freeChoiceFromLevel: 20 },
};
const fixedDie = (...values: number[]) => { let i = 0; setRandomSource(() => (values[i++ % values.length] - 0.5) / 12); };
afterAll(() => setRandomSource(Math.random));

describe('table selector (Legacy Binding)', () => {
  it('level 1: the app rolls the d12 and the matching spirit becomes active', () => {
    fixedDie(10);
    const e = recomputeDerived(startModePeriod(withGroup(legacy, 1), 'legacy'), R);
    expect(e.modeStates!.legacy.activeOptionId).toBe('s10');
    expect(ids(e)).toEqual(['legacy__s10__f10']);
    expect(modeSelectorInfo(e, legacy).rerollsLeft).toBe(0);                  // Council of Spirits starts at 3
  });

  it('a physical roll entered at the table is recorded as such', () => {
    const e = recomputeDerived(startModePeriod(withGroup(legacy, 1), 'legacy', [7]), R);
    expect(e.modeStates!.legacy.activeOptionId).toBe('s7');
    expect(e.modeStates!.legacy.history[0]).toMatchObject({ how: 'physical_roll', roll: 7 });
    expect(recomputeDerived(startModePeriod(withGroup(legacy, 1), 'legacy', [99]), R).modeStates!.legacy.activeOptionId).toBe('s12'); // clamped
  });

  it('Council of Spirits (level 3): one re-roll per period, result replaces the old one, refills on a new period', () => {
    fixedDie(4);
    let e = recomputeDerived(startModePeriod(withGroup(legacy, 3), 'legacy'), R);
    expect(e.modeStates!.legacy.activeOptionId).toBe('s4');
    expect(e.resources.custom.find(r => r.id === modeRerollResourceId('legacy'))).toMatchObject({ current: 1, maximum: 1 });
    fixedDie(9);
    e = recomputeDerived(rerollMode(e, 'legacy'), R);
    expect(e.modeStates!.legacy.activeOptionId).toBe('s9');
    expect(ids(e)).toEqual(['legacy__s9__f9']);
    expect(e.modeStates!.legacy.history.map(h => h.how)).toEqual(['roll', 'reroll']);
    const again = rerollMode(e, 'legacy');
    expect(again).toBe(e);                                                     // none left
    fixedDie(2);
    e = recomputeDerived(startModePeriod(e, 'legacy'), R);                     // month changes
    expect(e.modeStates!.legacy.activeOptionId).toBe('s2');
    expect(modeSelectorInfo(e, legacy).rerollsLeft).toBe(1);
  });

  it('Two Voices (level 11): two d12s, player picks one, Council can re-roll one of the dice first', () => {
    fixedDie(3, 8);
    let e = recomputeDerived(startModePeriod(withGroup(legacy, 11), 'legacy'), R);
    expect(e.modeStates!.legacy.pendingRolls).toEqual([3, 8]);
    expect(e.modeStates!.legacy.activeOptionId).toBeNull();
    expect(ids(e)).toEqual([]);                                                // nothing chosen yet
    fixedDie(12);
    e = rerollMode(e, 'legacy', { index: 0 });
    expect(e.modeStates!.legacy.pendingRolls).toEqual([12, 8]);
    e = recomputeDerived(pickPendingRoll(e, 'legacy', 1), R);
    expect(e.modeStates!.legacy.activeOptionId).toBe('s8');
    expect(e.modeStates!.legacy.pendingRolls).toBeUndefined();
    expect(e.modeStates!.legacy.history.at(-1)).toMatchObject({ how: 'pick', roll: 8, rolls: [12, 8] });
  });

  it('Crown of Legends (level 20): free choice is offered; below it is not', () => {
    expect(modeSelectorInfo(withGroup(legacy, 19), legacy).freeChoice).toBe(false);
    const e20 = withGroup(legacy, 20);
    expect(modeSelectorInfo(e20, legacy).freeChoice).toBe(true);
    expect(ids(mode(e20, 'legacy', 's3'))).toEqual(['legacy__s3__f3']);
  });

  it('a custom roll→option table overrides the default positional mapping', () => {
    const g: ModeGroup = { ...legacy, selector: { kind: 'table', die: 6, table: [{ value: 1, optionId: 's5' }] } };
    expect(startModePeriod(withGroup(g, 1), 'legacy', [1]).modeStates!.legacy.activeOptionId).toBe('s5');
  });
});

// ── per-target modes: Command the Field ─────────────────────────────────────
describe('target-scope mode group (Command the Field)', () => {
  const field: ModeGroup = {
    id: 'ctf', name: 'Command the Field', optionLabel: 'Benefit', scope: 'target', maxTargets: 3, selector: { kind: 'choice' },
    options: [
      { id: 'advance', name: 'Advance', entries: [], effects: [{ type: 'stat_modifier', target: 'speed', operation: 'add', value: 10, condition: null }] },
      { id: 'brace', name: 'Brace', entries: [], effects: [{ type: 'stat_modifier', target: 'ac', operation: 'add', value: 1, condition: null }] },
      { id: 'press', name: 'Press', entries: [], note: 'First weapon hit before your next turn: +1d6.' },
      { id: 'withdraw', name: 'Withdraw', entries: [], note: 'Movement does not provoke opportunity attacks.' },
    ],
  };
  const spellFeature = feature('ctf_conc', { modeGroup: field, source: { kind: 'spell', refId: 'command_the_field' } });
  const caster = () => {
    const e = makeEmptyEntity('caster');
    return recomputeDerived({ ...e, identity: { ...e.identity, name: 'Caster', level: 5 }, features: [{ ...spellFeature, isActive: true }],
      spellcasting: { ability: 'cha', slots: {} as never, cantrips: [], known: [], prepared: [], concentrating: 'command_the_field' } }, R);
  };
  const ally = (id: string) => recomputeDerived({ ...makeEmptyEntity(id), identity: { ...makeEmptyEntity(id).identity, name: id } }, R);

  it('each target independently holds its own option; re-picking replaces it; limit of 3 (+1 per upcast level)', () => {
    let c = caster();
    c = setTargetMode(c, 'ctf', 'a', 'advance'); c = setTargetMode(c, 'ctf', 'b', 'brace'); c = setTargetMode(c, 'ctf', 'c', 'press');
    expect(setTargetMode(c, 'ctf', 'd', 'advance')).toBe(c);                   // 4th target refused
    const synced = syncAllyGrants([c, ally('a'), ally('b'), ally('c'), ally('d')], R);
    const [, a, b, cc, d] = synced;
    expect(a.derived.speed).toBe(ally('a').derived.speed + 10);
    expect(b.derived.ac).toBe(ally('b').derived.ac + 1);
    expect(cc.receivedGrants![0].note).toMatch(/1d6/);
    expect(d.receivedGrants ?? []).toEqual([]);
    // re-pick next turn: a switches Advance → Brace; nothing from Advance lingers
    const c2 = setTargetMode(c, 'ctf', 'a', 'brace');
    const [, a2] = syncAllyGrants([c2, a, b, cc, d], R);
    expect(a2.derived.speed).toBe(ally('a').derived.speed);
    expect(a2.derived.ac).toBe(ally('a').derived.ac + 1);
    expect(a2.receivedGrants).toHaveLength(1);
    // upcast at 5th level: two more targets
    const c3 = setExtraTargets(c, 'ctf', 2);
    expect(Object.keys(setTargetMode(setTargetMode(c3, 'ctf', 'd', 'press'), 'ctf', 'e', 'press').targetModes!.ctf.members)).toHaveLength(5);
  });

  it('can include the caster; removing a target and dropping concentration both end it', () => {
    let c = setTargetMode(caster(), 'ctf', 'caster', 'brace');
    c = setTargetMode(c, 'ctf', 'a', 'advance');
    let [cs, a] = syncAllyGrants([c, ally('a')], R);
    expect(cs.derived.ac).toBe(caster().derived.ac + 1);
    c = removeTargetMode(cs, 'ctf', 'a');
    [cs, a] = syncAllyGrants([c, a], R);
    expect(a.receivedGrants).toEqual([]);
    // concentration ends → the spell's feature leaves → every target loses its option
    const dropped = endConcentration({ ...cs, features: cs.features.map(f => f), spellcasting: { ...cs.spellcasting!, concentrating: 'command_the_field' } }, R);
    const gone = recomputeDerived({ ...dropped, features: dropped.features.filter(f => f.id !== 'ctf_conc') }, R);
    const [csAfter] = syncAllyGrants([gone], R);
    expect(csAfter.derived.ac).toBe(caster().derived.ac);
  });
});

describe('subclass display label', () => {
  const { subclassLabelFor } = require('../../content/subclasses/subclassBrowse');
  it('homebrew displayLabel > class subclassLabel > "Subclass"', () => {
    const hb = [{ id: 's', name: 'x', classId: 'emp', displayLabel: 'Bound Spirit', entries: [] }];
    expect(subclassLabelFor('emp', hb, [])).toBe('Bound Spirit');
    expect(subclassLabelFor('emp', [], [{ id: 'emp', subclassLabel: 'Oath' }])).toBe('Oath');
    expect(subclassLabelFor('fighter', hb, [{ id: 'emp', subclassLabel: 'Oath' }])).toBe('Subclass');
    expect(subclassLabelFor(null, [], [])).toBe('Subclass');
  });
});
