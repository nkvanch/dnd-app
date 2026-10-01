// Phase 5: dice-amount recharge, resource-threshold effects, zero-HP triggers.
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../pipeline';
import { setRandomSource } from '../dice';
import { takeDawn, takeDawnDetailed, takeRest } from '../rest';
import { applyDamage, dismissPendingTrigger, parseRechargeThreshold, rollRecharge } from '../combat';
import { spawnMonster } from '../monsterFactory';
import { monsterDustMephit } from '../../content/monsters/srd';
import { isFeatureAvailable } from '../actionCards';
import { equipItem } from '../inventory';
import { buildItemCharges, chargeActivation, newItemChargesDraft } from '../../content/itemCharges';
import type { Entity, Item } from '../types';
import type { MonsterTemplate } from '../../content/monsters/types';

const R = DEFAULT_RULES;
afterAll(() => setRandomSource(Math.random));
const roll = (face: number, sides: number) => setRandomSource(() => (face - 0.5) / sides);

describe('dice-amount recharge', () => {
  const standard = (): Item => {
    const pool = buildItemCharges('std', 'Standard', { ...newItemChargesDraft(), enabled: true, max: '3', recharge: 'dawn', rechargeDice: '1d3', actionType: 'reaction' })!;
    return { id: 'std', name: 'Standard', weight: 0, cost: '-', properties: [], resources: [pool.resource],
      features: [{ id: 'std_f', name: 'Last Line', description: '', source: { kind: 'item', refId: 'std' }, level: null, effects: [], actions: [], choices: [], passive: false,
        activation: chargeActivation({ actionType: 'reaction', range: 'self', target: 'single', requiresSave: null }, pool.resourceId, 1) }] };
  };
  const spent = (): Entity => {
    const e = makeEmptyEntity('c');
    let ent = equipItem({ ...e, inventory: { ...e.inventory, carried: [{ itemId: 'std', quantity: 1, attuned: false, features: [] }] } }, 'std', standard(), R);
    ent = { ...ent, resources: { ...ent.resources, custom: ent.resources.custom.map(r => ({ ...r, current: 0 })) } };
    return ent;
  };

  it('the compiled pool carries the dice; invalid dice are dropped, not guessed', () => {
    expect(standard().resources![0].rechargeAmount).toBe('1d3');
    const bad = buildItemCharges('x', 'X', { ...newItemChargesDraft(), enabled: true, rechargeDice: 'lots' })!;
    expect(bad.resource.rechargeAmount).toBeUndefined();
  });

  it('dawn rolls 1d3 and adds that many (cap at max); reports the roll', () => {
    roll(2, 3);
    const r = takeDawnDetailed(spent(), R);
    expect(r.entity.resources.custom[0].current).toBe(2);
    expect(r.rolls).toEqual([expect.objectContaining({ dice: '1d3', total: 2, before: 0, after: 2 })]);
    roll(3, 3);
    const nearFull = { ...spent() };
    nearFull.resources = { ...nearFull.resources, custom: nearFull.resources.custom.map(c => ({ ...c, current: 2 })) };
    expect(takeDawn(nearFull, R).resources.custom[0].current).toBe(3);   // 2 + 3 capped at 3
  });

  it('a pool without dice still refills fully; rests do not touch a dawn pool', () => {
    const e = spent();
    const plain = { ...e, resources: { ...e.resources, custom: e.resources.custom.map(c => ({ ...c, rechargeAmount: undefined })) } };
    expect(takeDawn(plain, R).resources.custom[0].current).toBe(3);
    expect(takeRest(spent(), 'long', R).resources.custom[0].current).toBe(0);
  });

  it('a short/long-rest pool with dice rolls too', () => {
    roll(1, 4);
    const e = spent();
    const rest = { ...e, resources: { ...e.resources, custom: e.resources.custom.map(c => ({ ...c, recharge: 'long_rest', rechargeAmount: '1d4' })) } };
    expect(takeRest(rest, 'long', R).resources.custom[0].current).toBe(1);
  });

  it('existing "Recharge 5-6" monster abilities still evaluate (already shipped)', () => {
    expect(parseRechargeThreshold('Recharge 5-6')).toBe(5);
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(rollRecharge(5)).toEqual({ roll: 6, success: true });
    spy.mockRestore();
  });
});

// ── Glassback: Pressure thresholds + gated Abrasive Jet + Pressure Collapse ──
const eff = (target: string, operation: 'add' | 'multiply', value: number, min?: number, max?: number) =>
  ({ type: 'stat_modifier' as const, target, operation, value, condition: null, requiresResource: { resourceId: 'pressure', min, max } });
const glassback: MonsterTemplate = {
  id: 'glassback', name: 'Glassback', cr: 7, srd: false, size: 'large', type: 'aberration', alignment: 'unaligned',
  stats: { str: 19, dex: 10, con: 17, int: 7, wis: 14, cha: 3 }, hp: { dice: '14d10+42', average: 119 }, ac: { value: 17, source: 'natural armor' },
  speed: 30, savingThrows: [], skills: {}, senses: [], languages: [],
  resources: [{ resourceId: 'pressure', name: 'Pressure', maximum: 3, recharge: 'never' }],
  features: [
    { id: 'gb_pressure_strained', name: 'Pressure 1 — Strained', description: 'AC -1, speed -10 ft.', source: { kind: 'race', refId: 'glassback' }, level: null, actions: [], choices: [], passive: true,
      effects: [eff('ac', 'add', -1, 1, 1), eff('speed', 'add', -10, 1, 1)] },
    { id: 'gb_pressure_zero', name: 'Pressure 0 — Depressurized', description: 'Speed halved.', source: { kind: 'race', refId: 'glassback' }, level: null, actions: [], choices: [], passive: true,
      effects: [{ ...eff('speed', 'add', 0, 0, 0), operation: 'scale' as never, value: 0.5 }] },
    { id: 'gb_abrasive_jet', name: 'Abrasive Jet (Recharge 5-6)', description: 'Line.', source: { kind: 'race', refId: 'glassback' }, level: null, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '30 feet', target: 'area', requiresSave: { ability: 'dex', dc: 15 },
        requiresResource: { resourceId: 'pressure', min: 1, reason: 'Cannot use Abrasive Jet while at 0 Pressure.' } } },
    { id: 'gb_collapse', name: 'Pressure Collapse', description: 'Death trait.', source: { kind: 'race', refId: 'glassback' }, level: null, effects: [], actions: [], choices: [], passive: true,
      onZeroHp: { text: 'Internal pressure equalizes: creatures within 10 ft make a DC 15 DEX save, 2d8 slashing on a failure and pushed 5 ft (half and not pushed on a success).',
        area: '10 ft', dice: '2d8', damageType: 'slashing', save: { ability: 'dex', dc: 15, onSuccess: 'half' } } },
  ],
};
const withPressure = (e: Entity, n: number): Entity => recomputeDerived({ ...e, resources: { ...e.resources, custom: e.resources.custom.map(r => r.id === 'pressure' ? { ...r, current: n } : r) } }, R);

describe('Glassback — resource thresholds', () => {
  const g = () => spawnMonster(glassback, R);
  it('each Pressure state applies exactly its own penalties (and removes the previous state\'s)', () => {
    const base = withPressure(g(), 3);
    const [ac3, sp3] = [base.derived.ac, base.derived.speed];
    expect(withPressure(base, 2).derived.ac).toBe(ac3);
    const p1 = withPressure(base, 1);
    expect([p1.derived.ac, p1.derived.speed]).toEqual([ac3 - 1, sp3 - 10]);
    const p0 = withPressure(p1, 0);
    expect(p0.derived.ac).toBe(ac3);                            // Strained AC penalty is gone at 0
    expect(p0.derived.speed).toBe(Math.floor(sp3 * 0.5));       // halved
    expect(withPressure(p0, 2).derived.speed).toBe(sp3);        // back up: everything restored
  });

  it('Abrasive Jet is unavailable at 0 Pressure with the printed reason, available above', () => {
    const jet = (e: Entity) => e.features.find(f => f.id === 'gb_abrasive_jet')!;
    expect(isFeatureAvailable(jet(withPressure(g(), 0)), withPressure(g(), 0))).toEqual({ available: false, reason: 'Cannot use Abrasive Jet while at 0 Pressure.' });
    expect(isFeatureAvailable(jet(withPressure(g(), 1)), withPressure(g(), 1)).available).toBe(true);
  });

  it('Recharge 5-6 gets its resource synthesized and is rollable', () => {
    const e = g();
    const res = e.resources.custom.find(r => r.id === 'gb_abrasive_jet_recharge');
    expect(res?.recharge).toMatch(/Recharge 5/);
  });
});

describe('zero-HP triggers', () => {
  it('Pressure Collapse queues the rules text with one ready damage roll when HP first hits 0', () => {
    roll(5, 8);
    const g = spawnMonster(glassback, R);
    const hit = applyDamage(g, 50, R);
    expect(hit.pendingTriggers ?? []).toEqual([]);                   // still alive: nothing
    const dead = applyDamage(hit, 500, R);
    expect(dead.pendingTriggers).toHaveLength(1);
    expect(dead.pendingTriggers![0]).toMatchObject({ name: 'Pressure Collapse', area: '10 ft', save: { dc: 15 }, rolled: { dice: '2d8', damageType: 'slashing' } });
    expect(dead.pendingTriggers![0].rolled!.total).toBeGreaterThanOrEqual(2);
    // more damage while already at 0 does not fire it again
    expect(applyDamage(dead, 5, R).pendingTriggers).toHaveLength(1);
    expect(dismissPendingTrigger(dead, dead.pendingTriggers![0].id).pendingTriggers).toEqual([]);
  });

  it('the shipped Dust Mephit Death Burst is now mechanical', () => {
    const m = spawnMonster(monsterDustMephit, R);
    const dead = applyDamage(m, 999, R);
    expect(dead.pendingTriggers?.[0]).toMatchObject({ name: 'Death Burst', area: '5 ft', save: { ability: 'con', dc: 10 } });
  });

  it('selfEffects apply to the creature itself', () => {
    const e = makeEmptyEntity('s');
    const t = recomputeDerived({ ...e, resources: { ...e.resources, hp: { current: 5, maximum: 5, temp: 0 } }, features: [{
      id: 'f', name: 'Last Gasp', description: '', source: { kind: 'class', refId: 'x' }, level: null, effects: [], actions: [], choices: [], passive: true, isActive: true,
      onZeroHp: { text: 'flag', selfEffects: [{ type: 'set_flag', flag: 'last_gasp', value: true }] } }] }, R);
    expect(applyDamage(t, 9, R).conditionMonitor.flags.last_gasp).toBe(true);
  });

  it('long rest keeps a max-HP bonus from being re-added (regression: hp object rebuild)', () => {
    const { grantFeatureBundle } = require('../featureGrants');
    const e = recomputeDerived({ ...makeEmptyEntity('h'), resources: { ...makeEmptyEntity('h').resources, hp: { current: 10, maximum: 40, temp: 0 } } }, R);
    const granted = grantFeatureBundle(e, { lineageId: 'x', label: 'x', features: [{ id: 'x1', name: 'x', description: '', source: { kind: 'manual', refId: 'x' }, level: null, actions: [], choices: [], passive: true,
      effects: [{ type: 'stat_modifier', target: 'max_hp', operation: 'add', value: 5, condition: null }] }] }, R);
    expect(granted.resources.hp.maximum).toBe(45);
    const rested = takeRest(granted, 'long', R);
    expect(rested.resources.hp.maximum).toBe(45);
    expect(recomputeDerived(rested, R).resources.hp.maximum).toBe(45);
  });
});
