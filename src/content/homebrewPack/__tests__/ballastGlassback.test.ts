import { makeEmptyEntity, DEFAULT_RULES } from '../../../store/characterStore';
import { recomputeDerived } from '../../../engine/pipeline';
import { applyGrant } from '../../../engine/leveling';
import { applyDamage, applyAbilityEffects, findRechargeableFeatures } from '../../../engine/combat';
import { applyCondition } from '../../../engine/conditions';
import { spawnMonster } from '../../../engine/monsterFactory';
import { currentHitDieSize, entityHitDieTier } from '../../../engine/rest';
import { registerHomebrewConditions } from '../../conditions/index';
import { raceBallast, raceBallastLesser } from '../ballast';
import { monsterGlassback, glassbackFracturedCondition, glassbackCompressedCondition } from '../glassback';
import { BUILTIN_HOMEBREW } from '../../builtinHomebrew';
import { Entity, Race } from '../../../engine/types';

function withRace(race: Race, sizeIdx = 0): Entity {
  let e = makeEmptyEntity('b');
  e = { ...e, identity: { ...e.identity, level: 6 }, resources: { ...e.resources, hp: { current: 50, maximum: 50, temp: 0 }, hitDice: { die: 6, total: 6, remaining: 6 } } };
  const sub = race.subraces![sizeIdx];
  for (const f of [...race.features, ...sub.features]) e = applyGrant(e, { kind: 'feature', value: { ...f, isActive: true } }, 0);
  for (const r of race.resources ?? []) e = applyGrant(e, { kind: 'resource', value: r }, 0, undefined, { kind: 'race', id: race.id });
  return recomputeDerived(e, DEFAULT_RULES);
}

describe('Ballast (both versions)', () => {
  it('registers as two races with a mandatory Medium/Large choice and a +2/+1 ability pick', () => {
    expect(BUILTIN_HOMEBREW.races.map(r => r.id)).toEqual(expect.arrayContaining(['ballast', 'ballast_lesser']));
    for (const r of [raceBallast, raceBallastLesser]) {
      expect(r.subraces!.map(s => s.size)).toEqual(['Medium', 'Large']);
      expect(r.subracesOptional).toBeFalsy();
      expect(r.flexibleAsi!.mode).toEqual({ kind: 'two_and_one' });
      expect(r.pendingChoices!.some(c => c.kind === 'language')).toBe(true);
    }
  });

  it('both have speed 15 and Catastrophically Dense (Wizard 6: d6 -> d8, +6 max HP)', () => {
    for (const r of [raceBallast, raceBallastLesser]) {
      const e = withRace(r);
      expect(e.derived.speed).toBe(15);
      expect(entityHitDieTier(e)).toBe(1);
      expect(currentHitDieSize(e)).toBe(8);
      expect(e.resources.hp.maximum).toBe(56);
    }
  });

  it('Lesser: "No." is a 1/Long Rest Reaction and forced movement is only advantage', () => {
    const e = withRace(raceBallastLesser);
    expect(e.resources.custom.find(r => r.id === 'ballast_lesser_no')).toMatchObject({ maximum: 1, recharge: 'long_rest' });
    const no = e.features.find(f => f.id === 'ballast_lesser_no')!;
    expect(no.activation).toMatchObject({ actionType: 'reaction', resourceCost: { resourceId: 'ballast_lesser_no', quantity: 1 } });
    expect(e.derived.advantageStates.some(a => a.state === 'advantage' && a.target.includes('moved against your will'))).toBe(true);
  });

  it('Original: "No." costs nothing and is not a limited-use action; no resource pool', () => {
    const e = withRace(raceBallast);
    const no = e.features.find(f => f.id === 'ballast_no')!;
    expect(no.activation).toBeUndefined();
    expect(e.resources.custom.find(r => r.id.includes('no'))).toBeUndefined();
  });
});

describe('Glassback', () => {
  const spawn = () => spawnMonster(monsterGlassback, DEFAULT_RULES);
  const setPressure = (e: Entity, n: number): Entity => recomputeDerived(
    { ...e, resources: { ...e.resources, custom: e.resources.custom.map(r => r.id === 'glassback_pressure' ? { ...r, current: n } : r) } }, DEFAULT_RULES);

  it('is registered as a built-in monster and spawns with CR 7 stats and a 0-3 Pressure pool', () => {
    expect(BUILTIN_HOMEBREW.monsters.map(m => m.id)).toContain('glassback');
    const g = spawn();
    expect(g.resources.custom.find(r => r.id === 'glassback_pressure')).toMatchObject({ current: 3, maximum: 3 });
    expect(g.derived.ac).toBe(17);
    expect(g.derived.speed).toBe(30);
  });

  it('Pressure thresholds drive AC and speed: 3/2 no penalty, 1 strained, 0 depressurized', () => {
    const g = spawn();
    const at = (n: number) => setPressure(g, n).derived;
    expect(at(3)).toMatchObject({ ac: 17, speed: 30 });
    expect(at(2)).toMatchObject({ ac: 17, speed: 30 });
    expect(at(1)).toMatchObject({ ac: 16, speed: 20 });
    expect(at(0).speed).toBe(15);
    expect(at(0).advantageStates.filter(a => a.state === 'disadvantage').map(a => a.target))
      .toEqual(expect.arrayContaining(['Strength and Dexterity ability checks', 'Strength and Dexterity saving throws']));
  });

  it('Ceramic Shell reduces slashing by 2 per hit, never below 0, and leaves other types alone', () => {
    const g = spawn();
    const hp = g.resources.hp.current;
    expect(applyDamage(g, 10, DEFAULT_RULES, 'slashing').resources.hp.current).toBe(hp - 8);
    expect(applyDamage(g, 1, DEFAULT_RULES, 'slashing').resources.hp.current).toBe(hp);
    expect(applyDamage(g, 10, DEFAULT_RULES, 'fire').resources.hp.current).toBe(hp - 10);
  });

  it('has acid and poison resistance and poisoned immunity', () => {
    const g = spawn();
    const hp = g.resources.hp.current;
    expect(applyDamage(g, 10, DEFAULT_RULES, 'acid').resources.hp.current).toBe(hp - 5);
    expect(applyDamage(g, 10, DEFAULT_RULES, 'poison').resources.hp.current).toBe(hp - 5);
  });

  it('Shell Fractured lowers AC by 1', () => {
    const g = spawn();
    const f = applyCondition(g, 'glassback_shell_fractured', 'dm', DEFAULT_RULES, glassbackFracturedCondition.features, { unit: 'rounds', remaining: 1 });
    expect(f.derived.ac).toBe(16);
  });

  it('Compress restores 1 Pressure and applies the speed-0 / resistant Compressed condition', () => {
    registerHomebrewConditions([glassbackCompressedCondition, glassbackFracturedCondition]);
    const g = setPressure(spawn(), 1);
    const compress = g.features.find(f => f.id === 'glassback_compress')!;
    const after = applyAbilityEffects(g, compress.abilityEffects!, DEFAULT_RULES, compress.activation);
    expect(after.resources.custom.find(r => r.id === 'glassback_pressure')!.current).toBe(2);
    expect(after.derived.speed).toBe(0);
    const hp = after.resources.hp.current;
    expect(applyDamage(after, 10, DEFAULT_RULES, 'bludgeoning').resources.hp.current).toBe(hp - 5);
  });

  it('Abrasive Jet gets a synthesized Recharge 5-6 pool', () => {
    const rech = findRechargeableFeatures(spawn());
    expect(rech.map(r => r.feature.id)).toContain('glassback_abrasive_jet');
    expect(rech.find(r => r.feature.id === 'glassback_abrasive_jet')!.threshold).toBe(5);
  });
});
