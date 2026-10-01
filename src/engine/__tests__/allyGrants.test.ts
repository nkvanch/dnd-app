// Phase 2: ally-targeting effects — auras (checklist-based, table-resolved
// membership) and single-target chosen grants.
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../pipeline';
import { paladinProgression } from '../../content/classes';
import { syncAllyGrants, setAuraMember, applyChosenGrant, listAllyGrantSources, spendGrantDie, spendGrantToken, dismissReceivedGrant, tickReceivedGrants } from '../allyGrants';
import { isImmuneToCondition } from '../conditions';
import type { Entity, Feature, FeatureInstance } from '../types';

const R = DEFAULT_RULES;
const feat = (f: Feature): FeatureInstance => ({ ...f, isActive: true });

function paladinFeature(id: string): FeatureInstance {
  for (const e of paladinProgression.entries) {
    for (const g of e.grants) {
      if (g.kind === 'feature' && (g.value as Feature).id === id) return feat(g.value as Feature);
    }
  }
  throw new Error('missing ' + id);
}

function hero(id: string, name: string, level: number, cha: number, features: FeatureInstance[] = []): Entity {
  const e = makeEmptyEntity(id);
  return recomputeDerived({
    ...e, identity: { ...e.identity, name, level }, stats: { ...e.stats, cha }, features,
  }, R);
}
const save = (e: Entity, a: 'str' | 'dex' = 'dex') => e.derived.savingThrows[a];

describe('Paladin Aura of Protection / Courage (official content)', () => {
  const pal = () => hero('pal', 'Paladin', 10, 16, [paladinFeature('aura_of_protection'), paladinFeature('aura_of_courage')]);

  it('applies to the holder with no sync at all (CHA +3 to saves, frightened immunity)', () => {
    const p = pal();
    expect(save(p)).toBe(3);
    expect(isImmuneToCondition(p, 'frightened')).toBe(true);
  });

  it('applies to exactly the ticked allies, and removes when unticked', () => {
    const p = pal();
    const a = hero('a', 'Ally', 5, 8);
    const b = hero('b', 'Bystander', 5, 8);
    const ticked = setAuraMember(p, 'aura_of_protection', 'save_aura', 'a', true);
    const synced = syncAllyGrants([ticked, a, b], R);
    expect(save(synced[1])).toBe(3);
    expect(save(synced[2])).toBe(0);
    expect(synced[2]).toBe(b);                        // identity preserved when unchanged
    expect(isImmuneToCondition(synced[1], 'frightened')).toBe(false); // courage not ticked
    const both = setAuraMember(ticked, 'aura_of_courage', 'courage_aura', 'a', true);
    expect(isImmuneToCondition(syncAllyGrants([both, a, b], R)[1], 'frightened')).toBe(true);
    const cleared = syncAllyGrants([setAuraMember(ticked, 'aura_of_protection', 'save_aura', 'a', false), synced[1], b], R);
    expect(save(cleared[1])).toBe(0);
    expect(cleared[1].receivedGrants).toEqual([]);
  });

  it('uses the +1 minimum with a low CHA, and does not stack twice from re-syncing', () => {
    const p = hero('pal', 'P', 6, 8, [paladinFeature('aura_of_protection')]);
    const a = hero('a', 'A', 1, 10);
    const t = setAuraMember(p, 'aura_of_protection', 'save_aura', 'a', true);
    const once = syncAllyGrants([t, a], R);
    const twice = syncAllyGrants(once, R);
    expect(save(twice[1])).toBe(1);
    expect(twice[1].receivedGrants).toHaveLength(1);
  });

  it('stops projecting when the holder is incapacitated (0 HP): allies lose it', () => {
    const p0 = pal();
    const a = hero('a', 'A', 1, 10);
    const synced = syncAllyGrants([setAuraMember(p0, 'aura_of_protection', 'save_aura', 'a', true), a], R);
    expect(save(synced[1])).toBe(3);
    const down: Entity = recomputeDerived({ ...synced[0], resources: { ...synced[0].resources, hp: { ...synced[0].resources.hp, maximum: 20, current: 0 } } }, R);
    const after = syncAllyGrants([down, synced[1]], R);
    expect(save(after[1])).toBe(0);
    expect(save(after[0])).toBe(0); // and the holder's own aura is off too
  });

  it('listAllyGrantSources exposes the printed range growing at level 18', () => {
    expect(listAllyGrantSources(pal())[0].spec.rangeByLevel).toEqual([{ level: 18, feet: 30 }]);
  });
});

describe('planted-flag aura (Standard of the Unyielding Line shape)', () => {
  const standardFeature: FeatureInstance = feat({
    id: 'std', name: 'Planted Standard', description: '', source: { kind: 'item', refId: 'std' }, level: null, passive: true,
    actions: [], choices: [], effects: [],
    allyGrants: [{
      id: 'planted', mode: 'aura', label: 'Planted standard (+1 AC)', rangeFeet: 15, activeWhileFlag: 'standard_planted',
      effects: [{ type: 'stat_modifier', target: 'ac', operation: 'add', value: 1, condition: null }],
    }],
  });
  it('gives +1 AC to ticked allies only while the planted flag is on', () => {
    const bearer = hero('bearer', 'Bearer', 5, 10, [standardFeature]);
    const ally = hero('al', 'Ally', 5, 10);
    const ticked = setAuraMember(bearer, 'std', 'planted', 'al', true);
    const off = syncAllyGrants([ticked, ally], R);
    expect(off[1].derived.ac).toBe(ally.derived.ac);
    const planted = recomputeDerived({ ...ticked, conditionMonitor: { ...ticked.conditionMonitor, flags: { standard_planted: true } } }, R);
    const on = syncAllyGrants([planted, off[1]], R);
    expect(on[1].derived.ac).toBe(ally.derived.ac + 1);
    const picked = recomputeDerived({ ...on[0], conditionMonitor: { ...on[0].conditionMonitor, flags: {} } }, R);
    expect(syncAllyGrants([picked, on[1]], R)[1].derived.ac).toBe(ally.derived.ac);
  });
});

describe('chosen single-target grants', () => {
  const command: FeatureInstance = feat({
    id: 'cmd', name: 'Imperial Command', description: '', source: { kind: 'class', refId: 'x' }, level: 1, passive: false,
    actions: [], choices: [], effects: [],
    allyGrants: [{ id: 'die', mode: 'chosen', label: 'Command Die', rangeFeet: 30, die: { size: 'd6', sizeByLevel: [{ level: 5, size: 'd8' }], usableOn: 'attack, check, save or damage roll' }, duration: { unit: 'minutes', remaining: 1 } }],
  });
  const holdFast: FeatureInstance = feat({
    id: 'hold', name: 'Hold Fast', description: '', source: { kind: 'feat', refId: 'anchor' }, level: null, passive: false,
    actions: [], choices: [], effects: [],
    allyGrants: [{ id: 'fast', mode: 'chosen', label: 'Hold Fast', rangeFeet: 10, tempHp: { addProficiency: true, addAbilityMod: 'cha' }, effects: [{ type: 'stat_modifier', target: 'ac', operation: 'add', value: 1, condition: null }], duration: { unit: 'rounds', remaining: 1 } }],
  });

  it('gives a chosen ally a scaled die that is consumed on use and then vanishes', () => {
    const holder = hero('h', 'Emperor', 5, 18, [command]);
    const ally = hero('a', 'Ally', 5, 10);
    const src = listAllyGrantSources(holder)[0];
    const res = applyChosenGrant(holder, ally, src, R);
    expect(res.target.receivedGrants![0].die).toEqual({ size: 'd8', remaining: 1, usableOn: 'attack, check, save or damage roll' });
    expect(res.holder.receivedGrants ?? []).toHaveLength(0);
    const spent = spendGrantDie(res.target, res.grant.id, R)!;
    expect(spent.roll).toBeGreaterThanOrEqual(1);
    expect(spent.roll).toBeLessThanOrEqual(8);
    expect(spent.entity.receivedGrants).toEqual([]);
    expect(spendGrantDie(spent.entity, res.grant.id, R)).toBeNull();
  });

  it('can target the holder itself; re-granting refreshes instead of stacking', () => {
    const holder = hero('h', 'Emperor', 1, 18, [command]);
    const src = listAllyGrantSources(holder)[0];
    const once = applyChosenGrant(holder, holder, src, R).holder;
    const twice = applyChosenGrant(once, once, src, R).holder;
    expect(twice.receivedGrants).toHaveLength(1);
    expect(twice.receivedGrants![0].die!.size).toBe('d6');
  });

  it('Hold Fast: temp HP = proficiency + CHA mod and a timed +1 AC for the ally', () => {
    const holder = hero('h', 'Anchor', 5, 16, [holdFast]);       // prof +3, CHA +3
    const ally = hero('a', 'Ally', 5, 10);
    const res = applyChosenGrant(holder, ally, listAllyGrantSources(holder)[0], R);
    expect(res.grant.tempHpGranted).toBe(holder.derived.proficiencyBonus + 3);
    expect(res.target.resources.hp.temp).toBe(res.grant.tempHpGranted);
    expect(res.target.derived.ac).toBe(ally.derived.ac + 1);
    const ticked = tickReceivedGrants(res.target, R);            // end of the ally's turn: 1 round expires
    expect(ticked.derived.ac).toBe(ally.derived.ac);
    expect(ticked.resources.hp.temp).toBe(res.grant.tempHpGranted); // temp HP is theirs to keep (RAW)
  });

  it('temp HP does not stack: a smaller grant never lowers a larger existing pool', () => {
    const holder = hero('h', 'Anchor', 1, 10, [holdFast]);
    const ally = hero('a', 'Ally', 1, 10);
    const rich = { ...ally, resources: { ...ally.resources, hp: { ...ally.resources.hp, temp: 50 } } };
    expect(applyChosenGrant(holder, rich, listAllyGrantSources(holder)[0], R).target.resources.hp.temp).toBe(50);
  });

  it('note-only token (Weight of Authority reroll) is spent by hand and removed at zero', () => {
    const woa: FeatureInstance = feat({
      id: 'woa', name: 'Recognized Presence', description: '', source: { kind: 'manual', refId: 'woa' }, level: null, passive: false,
      actions: [], choices: [], effects: [],
      allyGrants: [{ id: 'reroll', mode: 'chosen', label: 'Reroll', rangeFeet: 10, token: { text: 'Reroll one failed save against being frightened or moved', uses: 1 } }],
    });
    const holder = hero('h', 'H', 1, 10, [woa]);
    const ally = hero('a', 'A', 1, 10);
    const res = applyChosenGrant(holder, ally, listAllyGrantSources(holder)[0], R);
    expect(res.target.receivedGrants![0].token!.remaining).toBe(1);
    expect(spendGrantToken(res.target, res.grant.id, R).receivedGrants).toEqual([]);
    expect(dismissReceivedGrant(res.target, res.grant.id, R).receivedGrants).toEqual([]);
  });
});
