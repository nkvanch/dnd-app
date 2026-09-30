// "Dawn" is an explicit event, not a rest. The authoring UI used to offer "Other → Dawn" as free text
// that no rest ever refilled; now Dawn is a real chip backed by takeDawn() and a sheet button, and
// free-text triggers are honestly manual.
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../pipeline';
import { takeRest, takeDawn, hasSpentDawnResources } from '../rest';
import { buildTraitFeature, newDraftTrait, resolveRecharge, RECHARGE_TYPES } from '../../content/traitCompiler';
import type { Entity } from '../types';

const RECHARGES = ['short_rest', 'long_rest', 'dawn', 'never', 'per encounter'] as const;

function drained(): Entity {
  const b = recomputeDerived({ ...makeEmptyEntity('d'), identity: { ...makeEmptyEntity('d').identity, level: 5 } }, DEFAULT_RULES);
  return {
    ...b,
    resources: {
      ...b.resources,
      hp: { ...b.resources.hp, current: 1 },
      custom: RECHARGES.map(rc => ({ id: `r_${rc.replace(/ /g, '_')}`, name: rc, maximum: 3, current: 0, recharge: rc })) as Entity['resources']['custom'],
    },
  };
}
const byRecharge = (e: Entity) => Object.fromEntries(e.resources.custom.map(r => [r.recharge, r.current]));

describe('what each event refills', () => {
  it('a short rest refills only short_rest resources', () => {
    expect(byRecharge(takeRest(drained(), 'short', DEFAULT_RULES))).toEqual({ short_rest: 3, long_rest: 0, dawn: 0, never: 0, 'per encounter': 0 });
  });

  it('a long rest refills short_rest and long_rest but NOT dawn (a long rest is not a new day)', () => {
    expect(byRecharge(takeRest(drained(), 'long', DEFAULT_RULES))).toEqual({ short_rest: 3, long_rest: 3, dawn: 0, never: 0, 'per encounter': 0 });
  });

  it('takeDawn refills ONLY dawn resources', () => {
    expect(byRecharge(takeDawn(drained(), DEFAULT_RULES))).toEqual({ short_rest: 0, long_rest: 0, dawn: 3, never: 0, 'per encounter': 0 });
  });

  it('takeDawn is not a rest: HP is untouched', () => {
    expect(takeDawn(drained(), DEFAULT_RULES).resources.hp.current).toBe(1);
  });

  it('takeDawn does nothing (same object back) when no dawn resource is spent', () => {
    const e = drained();
    const full: Entity = { ...e, resources: { ...e.resources, custom: e.resources.custom.map(r => (r.recharge === 'dawn' ? { ...r, current: r.maximum } : r)) } };
    expect(hasSpentDawnResources(full)).toBe(false);
    expect(takeDawn(full, DEFAULT_RULES)).toBe(full);
  });

  it('hasSpentDawnResources drives the sheet button', () => {
    expect(hasSpentDawnResources(drained())).toBe(true);
    expect(hasSpentDawnResources(makeEmptyEntity('none'))).toBe(false);
  });
});

describe('authoring: the recharge the editor stores', () => {
  it('offers Dawn as its own option and labels Other as manual', () => {
    expect(RECHARGE_TYPES.map(r => r.key)).toEqual(['short_rest', 'long_rest', 'dawn', 'other']);
    expect(RECHARGE_TYPES.find(r => r.key === 'other')!.label).toBe('Other (manual)');
  });

  it('the Dawn chip stores exactly "dawn" (what takeDawn refills)', () => {
    expect(resolveRecharge('dawn', '')).toBe('dawn');
  });

  it('typing "Dawn" under Other means the same thing (existing authored content keeps working)', () => {
    expect(resolveRecharge('other', 'Dawn')).toBe('dawn');
    expect(resolveRecharge('other', '  dAwN ')).toBe('dawn');
  });

  it('other free text stays as authored; empty other falls back to "other"', () => {
    expect(resolveRecharge('other', 'once per encounter')).toBe('once per encounter');
    expect(resolveRecharge('other', '   ')).toBe('other');
  });

  it('rest triggers are unchanged', () => {
    expect(resolveRecharge('short_rest', 'ignored')).toBe('short_rest');
    expect(resolveRecharge('long_rest', '')).toBe('long_rest');
  });

  it('a limited-use trait set to Dawn compiles to a resource that recharges on dawn', () => {
    const t = { ...newDraftTrait('Legendary Resistance'), limitedUse: true, recharge: 'dawn' as const, uses: '3' };
    const { resource } = buildTraitFeature(t, { idPrefix: 'lr', sourceKind: 'feat', sourceRefId: 'lr', level: null });
    expect(resource).toMatchObject({ maximum: 3, recharge: 'dawn' });
  });
});
