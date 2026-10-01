// Phase 3: mid-campaign feature grants with provenance, replacement and a max-HP bonus.
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../pipeline';
import { grantFeatureBundle, revokeFeatureGrant, activeGrantFor, lineageHistory, FeatureGrantDef } from '../featureGrants';
import { applyDamage } from '../combat';
import type { Entity, Feature } from '../types';

const R = DEFAULT_RULES;

function char(): Entity {
  const e = makeEmptyEntity('c');
  return recomputeDerived({
    ...e, identity: { ...e.identity, name: 'Anchor', level: 5 },
    resources: { ...e.resources, hp: { current: 40, maximum: 40, temp: 0 } },
  }, R);
}

function tier(n: 1 | 2 | 3): FeatureGrantDef {
  const hp = [0, 5, 10, 15][n], init = n, uses = n, range = [0, 10, 20, 30][n];
  const features: Feature[] = [{
    id: `woa_t${n}`, name: `Weight of Authority — Tier ${['', 'I', 'II', 'III'][n]}`,
    description: `+${hp} max HP, +${init} initiative, reroll ${uses}/long rest within ${range} ft.`,
    source: { kind: 'manual', refId: 'woa' }, level: null, actions: [], choices: [], passive: true,
    effects: [
      { type: 'stat_modifier', target: 'max_hp', operation: 'add', value: hp, condition: null },
      { type: 'stat_modifier', target: 'initiative', operation: 'add', value: init, condition: null },
    ],
  }];
  return {
    lineageId: 'weight_of_authority', label: 'Weight of Authority', tier: n, features,
    resources: [{ resourceId: 'woa_reroll', name: 'Weight of Authority — Reroll', maximum: uses, recharge: 'long_rest' }],
    grantedBy: 'DM', note: `Tier ${n} reward`,
  };
}

describe('grantFeatureBundle', () => {
  it('Tier I adds +5 max HP (current rises with it), +1 initiative and a 1/long-rest pool', () => {
    const base = char();
    const e = grantFeatureBundle(base, tier(1), R, '2026-01-01T00:00:00Z');
    expect(e.resources.hp.maximum).toBe(45);
    expect(e.resources.hp.current).toBe(45);
    expect(e.derived.initiative).toBe(base.derived.initiative + 1);
    expect(e.resources.custom.find(r => r.id === 'woa_reroll')).toMatchObject({ current: 1, maximum: 1, recharge: 'long_rest' });
    expect(activeGrantFor(e, 'weight_of_authority')).toMatchObject({ tier: 1, grantedBy: 'DM', status: 'active', grantedAt: '2026-01-01T00:00:00Z' });
  });

  it('Tier II REPLACES Tier I (+10 total, not +15), keeps history, never refills spent uses', () => {
    let e = grantFeatureBundle(char(), tier(1), R, '2026-01-01T00:00:00Z');
    e = { ...e, resources: { ...e.resources, custom: e.resources.custom.map(r => ({ ...r, current: 0 })) } };  // reroll spent
    e = grantFeatureBundle(e, tier(2), R, '2026-02-01T00:00:00Z');
    expect(e.resources.hp.maximum).toBe(50);
    expect(e.derived.initiative).toBe(char().derived.initiative + 2);
    expect(e.features.filter(f => f.id.startsWith('woa_t')).map(f => f.id)).toEqual(['woa_t2']);
    const pool = e.resources.custom.filter(r => r.id === 'woa_reroll');
    expect(pool).toHaveLength(1);
    expect(pool[0]).toMatchObject({ maximum: 2, current: 1 });           // spent 1 of 1 → still 1 spent of 2
    const hist = lineageHistory(e, 'weight_of_authority');
    expect(hist.map(h => [h.tier, h.status])).toEqual([[1, 'replaced'], [2, 'active']]);
    expect(hist[0].replacedBy).toBe(hist[1].id);
  });

  it('Tier III after II: +15 total; full Tier I → II → III history is kept in order', () => {
    let e = char();
    for (const n of [1, 2, 3] as const) e = grantFeatureBundle(e, tier(n), R, `2026-0${n}-01T00:00:00Z`);
    expect(e.resources.hp.maximum).toBe(55);
    expect(e.resources.custom.find(r => r.id === 'woa_reroll')!.maximum).toBe(3);
    expect(lineageHistory(e, 'weight_of_authority').map(h => `${h.tier}:${h.status}`)).toEqual(['1:replaced', '2:replaced', '3:active']);
  });

  it('a max-HP gain does not heal a downed character, and damage taken is preserved', () => {
    let e = char();
    e = applyDamage(e, 15, R);                                // 25/40
    e = grantFeatureBundle(e, tier(1), R);
    expect([e.resources.hp.current, e.resources.hp.maximum]).toEqual([30, 45]);
    let down = applyDamage(char(), 999, R);
    down = grantFeatureBundle(down, tier(1), R);
    expect(down.resources.hp.current).toBe(0);
  });

  it('revoking removes the bonus and pool but keeps a revoked row in the ledger', () => {
    let e = grantFeatureBundle(char(), tier(2), R);
    e = revokeFeatureGrant(e, activeGrantFor(e, 'weight_of_authority')!.id, R);
    expect(e.resources.hp.maximum).toBe(40);
    expect(e.resources.custom.find(r => r.id === 'woa_reroll')).toBeUndefined();
    expect(e.features.some(f => f.id === 'woa_t2')).toBe(false);
    expect(lineageHistory(e, 'weight_of_authority')[0].status).toBe('revoked');
    expect(activeGrantFor(e, 'weight_of_authority')).toBeUndefined();
  });

  it('is independent per lineage: two rewards stack, replacing one leaves the other alone', () => {
    let e = grantFeatureBundle(char(), tier(1), R);
    e = grantFeatureBundle(e, { lineageId: 'boon', label: 'Boon', features: [{ ...tier(1).features[0], id: 'boon_f', effects: [{ type: 'stat_modifier', target: 'max_hp', operation: 'add', value: 3, condition: null }] }] }, R);
    expect(e.resources.hp.maximum).toBe(48);
    e = grantFeatureBundle(e, tier(2), R);
    expect(e.resources.hp.maximum).toBe(53);
  });
});
