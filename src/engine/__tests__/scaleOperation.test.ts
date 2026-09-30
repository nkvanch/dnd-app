// 'scale' = multiply the FULLY RESOLVED stat ("double your speed"). 'multiply' keeps its long-standing,
// separately documented meaning (it multiplies the accumulated bonus pool of a target; expertise markers reuse it).
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived, effectiveAbilityScores } from '../pipeline';
import { applyGrant, applyAsiToEntity } from '../leveling';
import { explainValue } from '../audit';
import type { Entity, Feature, Effect } from '../types';

const fx = (o: Partial<Effect> & Pick<Effect, 'target' | 'operation'>): Effect =>
  ({ type: 'stat_modifier', value: null, condition: null, ...o } as Effect);
const feat = (id: string, effects: Effect[]): Feature => ({
  id, name: id, description: '', source: { kind: 'feat', refId: id }, level: null, effects, actions: [], choices: [], passive: true,
} as Feature);
const base = (): Entity => recomputeDerived({ ...makeEmptyEntity('s'), identity: { ...makeEmptyEntity('s').identity, level: 5 } }, DEFAULT_RULES);
const give = (e: Entity, ...fs: Feature[]): Entity =>
  recomputeDerived(fs.reduce((acc, f) => applyGrant(acc, { kind: 'feature', value: f }, 1), e), DEFAULT_RULES);

const speed = (op: Effect['operation'], value: number) => feat(`speed_${op}_${value}`, [fx({ target: 'speed', operation: op, value })]);

describe("'scale' on speed", () => {
  it('base stat x2: 30 ft becomes 60 ft', () => {
    const b = base();
    expect(b.derived.speed).toBe(30);
    expect(give(b, speed('scale', 2)).derived.speed).toBe(60);
  });

  it("the reported defect, pinned: 'multiply' alone still multiplies the (empty) bonus pool, so speed stays 30", () => {
    expect(give(base(), speed('multiply', 2)).derived.speed).toBe(30);
  });

  it('base + flat bonus THEN the multiplier: (30 + 10) x 2 = 80', () => {
    expect(give(base(), speed('add', 10), speed('scale', 2)).derived.speed).toBe(80);
  });

  it('a set effect is resolved first, then scaled: set 25, x2 = 50', () => {
    expect(give(base(), speed('set', 25), speed('scale', 2)).derived.speed).toBe(50);
  });

  it('multiple multipliers multiply together: x2 and x3 = x6; x2 and x0.5 cancel', () => {
    expect(give(base(), speed('scale', 2), speed('scale', 3)).derived.speed).toBe(180);
    expect(give(base(), speed('scale', 2), speed('scale', 0.5)).derived.speed).toBe(30);
  });

  it('halving rounds down (25 ft x0.5 = 12)', () => {
    expect(give(base(), speed('set', 25), speed('scale', 0.5)).derived.speed).toBe(12);
  });

  it('is order-independent however the effects were granted', () => {
    const a = speed('add', 10), s = speed('scale', 2), k = speed('set', 20);
    const results = new Set([[a, s, k], [s, a, k], [k, s, a], [s, k, a]].map(order => give(base(), ...order).derived.speed));
    expect(results.size).toBe(1);
    expect([...results][0]).toBe(60); // (20 set + 10) x 2
  });

  it('a speed-zero restriction still dominates any scaling', () => {
    const grappled = feat('grappled', [fx({ target: 'speed', operation: 'set', value: 0 })]);
    expect(give(base(), speed('scale', 2), grappled).derived.speed).toBe(0);
  });
});

describe("'scale' on AC, initiative and ability scores", () => {
  it('AC: the whole resolved AC is scaled, after formula and bonuses', () => {
    const b = base();
    const shield = feat('shield', [fx({ target: 'ac', operation: 'add', value: 2 })]);
    const ward = feat('ward', [fx({ target: 'ac', operation: 'scale', value: 2 })]);
    expect(give(b, shield, ward).derived.ac).toBe((b.derived.ac + 2) * 2);
  });

  it("existing AC behavior is untouched: 'multiply' still acts on the bonus pool (locked-in audit semantics)", () => {
    const b = base();
    const shield = feat('shield', [fx({ target: 'ac', operation: 'add', value: 4 })]);
    const dbl = feat('dbl', [fx({ target: 'ac', operation: 'multiply', value: 2 })]);
    expect(give(b, shield, dbl).derived.ac).toBe(b.derived.ac + 8);
  });

  it('AC: a base-AC formula with a per-ability cap is respected BEFORE scaling', () => {
    const e0 = { ...base(), stats: { ...base().stats, dex: 20 } } as Entity;
    const medium = feat('medium', [fx({ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 14, formulaAbilities: ['dex'], formulaAbilityCap: { dex: 2 } })]);
    const ward = feat('ward', [fx({ target: 'ac', operation: 'scale', value: 2 })]);
    expect(give(e0, medium).derived.ac).toBe(16);        // 14 + capped +2
    expect(give(e0, medium, ward).derived.ac).toBe(32);  // scaled after the cap, not before
  });

  it('initiative is scaled after the DEX modifier and bonuses', () => {
    const e0 = { ...base(), stats: { ...base().stats, dex: 16 } } as Entity; // +3
    const bonus = feat('bonus', [fx({ target: 'initiative', operation: 'add', value: 1 })]);
    const dbl = feat('dbl', [fx({ target: 'initiative', operation: 'scale', value: 2 })]);
    expect(give(e0, bonus, dbl).derived.initiative).toBe(8); // (3 + 1) x 2
  });

  it('ability score: STR 14 x2 = 28 effective; the ability modifier follows', () => {
    const e0 = { ...base(), stats: { ...base().stats, str: 14 } } as Entity;
    const dbl = feat('dbl', [fx({ target: 'str', operation: 'scale', value: 2 })]);
    expect(effectiveAbilityScores(give(e0, dbl)).str).toBe(28);
  });

  it('interaction with the ASI cap: a scaled score has no headroom left, so an ASI is refused', () => {
    const e0 = { ...base(), stats: { ...base().stats, str: 14 } } as Entity;
    const dbl = feat('dbl', [fx({ target: 'str', operation: 'scale', value: 2 })]);
    const scaled = give(e0, dbl); // effective 28, already over the default cap of 20
    const after = recomputeDerived(applyAsiToEntity(scaled, 'asi', { str: 2 }, DEFAULT_RULES), DEFAULT_RULES);
    expect(after.stats.str).toBe(14);
  });
});

describe("the audit trail agrees with the sheet when 'scale' is used", () => {
  it('speed', () => {
    const e = give(base(), speed('add', 10), speed('scale', 2));
    expect(explainValue(e, 'speed').total).toBe(e.derived.speed);
    expect(e.derived.speed).toBe(80);
  });
  it('AC', () => {
    const e = give(base(), feat('ward', [fx({ target: 'ac', operation: 'scale', value: 2 })]));
    expect(explainValue(e, 'ac').total).toBe(e.derived.ac);
  });
});

describe("'scale' on a stat that doesn't support it is inert (no effect, no crash)", () => {
  it('passive perception', () => {
    const b = base();
    const e = give(b, feat('x', [fx({ target: 'passivePerception', operation: 'scale', value: 3 })]));
    expect(e.derived.passivePerception).toBe(b.derived.passivePerception);
  });
});
