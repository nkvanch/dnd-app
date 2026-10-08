// Proves each outreach sample pack is a VALID, importable pack whose content
// actually does something in the live engine. If the pack format or trait
// compiler changes, this fails before a stale file is sent to anyone.
import { buildBreadthPack, buildStormboundPack, buildUnderstudyPack, BREADTH_IDS, STORM_IDS, UNDERSTUDY_IDS } from '../samplePacks';
import { validateGrimoirePack, validatePackContents, GrimoirePack } from '../../../src/engine/backup';
import { collectContentDependencies } from '../../../src/engine/contentDependencies';
import { makeEmptyEntity, DEFAULT_RULES } from '../../../src/store/characterStore';
import { applyGrant } from '../../../src/engine/leveling';
import { equipItem } from '../../../src/engine/inventory';
import { applyCondition } from '../../../src/engine/conditions';
import { recomputeDerived, collectAllEffects } from '../../../src/engine/pipeline';
import type { Entity } from '../../../src/engine/types';

const packs: [string, GrimoirePack][] = [
  ['Breadth', buildBreadthPack()],
  ['Stormbound', buildStormboundPack()],
  ['Understudy', buildUnderstudyPack()],
];

function allNames(p: GrimoirePack): string[] {
  const h = p.homebrew!;
  return [h.races, h.feats, h.items, h.monsters, h.spells, h.conditions, h.subclasses]
    .flatMap(list => (list ?? []) as { name: string }[]).map(c => c.name);
}

describe.each(packs)('%s pack — validity', (_label, pack) => {
  it('survives a JSON round-trip and passes envelope + per-content validation', () => {
    const rt = JSON.parse(JSON.stringify(pack));
    expect(validateGrimoirePack(rt)).toBeNull();
    expect(validatePackContents(rt)).toEqual([]);
  });

  it('is labelled Demo everywhere a user could see a name, and uses only _demo ids', () => {
    for (const n of allNames(pack)) expect(n).toContain('(Demo)');
    for (const c of pack.contents ?? []) expect(c.id.endsWith('_demo')).toBe(true);
    expect(pack.author).toMatch(/original demo content/);
  });

  it('manifest matches what the pack actually contains', () => {
    expect((pack.contents ?? []).length).toBe(allNames(pack).length);
  });
});

/** Every dependency the walker finds among the pack's own content must be listed in the manifest
 *  (official-content references such as the parent class are the only thing allowed to be absent). */
function undeclaredDeps(pack: GrimoirePack): string[] {
  const h = pack.homebrew!;
  const listed = new Set((pack.contents ?? []).map(c => `${c.type}:${c.id}`));
  const missing: string[] = [];
  const walk = (type: Parameters<typeof collectContentDependencies>[0], items: unknown[] | undefined) => {
    for (const it of items ?? []) {
      for (const r of collectContentDependencies(type, it as never)) {
        if (r.type === 'class') continue; // official parent class, resolved by the app itself
        if (!listed.has(`${r.type}:${r.id}`)) missing.push(`${r.type}:${r.id}`);
      }
    }
  };
  walk('race', h.races); walk('feat', h.feats); walk('item', h.items); walk('monster', h.monsters);
  walk('subclass', h.subclasses); walk('condition', h.conditions); walk('spell', h.spells);
  return missing;
}

describe.each(packs)('%s pack — dependencies', (_l, pack) => {
  it('lists every dependency it needs (nothing missing from the pack)', () => {
    expect(undeclaredDeps(pack)).toEqual([]);
  });
});

describe('Breadth pack — content types and dependencies', () => {
  const pack = buildBreadthPack();
  const h = pack.homebrew!;
  it('has exactly 1 species, 1 subclass, 1 feat, 2 spells, 1 item, 1 monster', () => {
    expect([h.races!.length, h.subclasses!.length, h.feats!.length, h.spells!.length, h.items!.length, h.monsters!.length])
      .toEqual([1, 1, 1, 2, 1, 1]);
  });
  it('the species and the subclass each pull in a different spell', () => {
    expect(collectContentDependencies('race', h.races![0])).toEqual(expect.arrayContaining([{ type: 'spell', id: BREADTH_IDS.spellA }]));
    expect(collectContentDependencies('subclass', h.subclasses![0])).toEqual(expect.arrayContaining([{ type: 'spell', id: BREADTH_IDS.spellB }]));
  });
  it('the subclass is a real multi-level progression on an official class', () => {
    expect(h.subclasses![0].classId).toBe('fighter');
    expect(h.subclasses![0].entries.map(e => e.level)).toEqual([3, 7]);
  });
});

describe('Stormbound pack — behaves in the live engine', () => {
  const h = buildStormboundPack().homebrew!;
  const base = (): Entity => recomputeDerived({ ...makeEmptyEntity('t'), identity: { ...makeEmptyEntity('t').identity, level: 1 } }, DEFAULT_RULES);

  it('the weapon and the creature both depend on the condition', () => {
    expect(collectContentDependencies('item', h.items![0])).toEqual(expect.arrayContaining([{ type: 'condition', id: STORM_IDS.condition }]));
    expect(collectContentDependencies('monster', h.monsters![0])).toEqual(expect.arrayContaining([{ type: 'condition', id: STORM_IDS.condition }]));
  });

  it('the feat grants lightning resistance', () => {
    let e = base();
    e = applyGrant(e, { kind: 'feature', value: h.feats![0].feature }, 0);
    const res = collectAllEffects(recomputeDerived(e, DEFAULT_RULES)).filter(a => a.effect.type === 'grant_resistance');
    expect(res.map(a => a.effect.target)).toContain('lightning');
  });

  it('the condition makes the target vulnerable to lightning', () => {
    const e0 = base();
    const e1 = recomputeDerived(applyCondition(e0, STORM_IDS.condition, 'manual', DEFAULT_RULES, h.conditions![0].features), DEFAULT_RULES);
    const vuln = collectAllEffects(e1).filter(a => a.effect.type === 'grant_resistance' && a.effect.operation === 'vulnerability');
    expect(vuln.map(a => a.effect.target)).toContain('lightning');
  });

  it('the weapon can be equipped and exposes an attack with an applied condition', () => {
    let e: Entity = { ...base(), inventory: { ...base().inventory, carried: [{ itemId: STORM_IDS.weapon, quantity: 1, attuned: false, features: [] }] } };
    e = equipItem(e, STORM_IDS.weapon, h.items![0], DEFAULT_RULES);
    expect(e.inventory.equipped.some(i => i.itemId === STORM_IDS.weapon)).toBe(true);
    const fx = h.items![0].features[0].abilityEffects!;
    expect(fx.map(f => f.type)).toEqual(['damage', 'damage', 'apply_condition']);
  });
});

describe('Understudy pack — the awkward concept works end to end', () => {
  const h = buildUnderstudyPack().homebrew!;
  const sub = h.subclasses![0];
  const apply = (e: Entity, uptoLevel: number): Entity => {
    for (const entry of sub.entries) {
      if (entry.level > uptoLevel) continue;
      for (const g of entry.grants) e = applyGrant(e, g, entry.level, 'bard', { kind: 'subclass', id: sub.id });
    }
    return recomputeDerived(e, DEFAULT_RULES);
  };
  const fresh = (): Entity => recomputeDerived({ ...makeEmptyEntity('u'), identity: { ...makeEmptyEntity('u').identity, level: 10 } }, DEFAULT_RULES);

  it('is a three-stage progression on an official class', () => {
    expect(sub.classId).toBe('bard');
    expect(sub.entries.map(e => e.level)).toEqual([3, 6, 10]);
  });

  it('level 3 gives the Borrowed Roles resource (3/long rest) and a +1 AC passive', () => {
    const e0 = fresh();
    const e = apply(e0, 3);
    expect(e.resources.custom.some(r => r.maximum === 3 && r.recharge === 'long_rest')).toBe(true);
    expect(e.derived.ac).toBe(e0.derived.ac + 1);
  });

  it('level 6 adds an active ability that applies the Spotlit condition', () => {
    const e = apply(fresh(), 6);
    const cue = e.features.find(f => f.name === 'Cue the Spotlight');
    expect(cue).toBeDefined();
    expect(cue!.abilityEffects).toEqual([expect.objectContaining({ type: 'apply_condition', conditionId: UNDERSTUDY_IDS.condition })]);
  });

  it('level 10 adds psychic resistance; earlier levels do not have it', () => {
    const has = (e: Entity) => collectAllEffects(e).some(a => a.effect.type === 'grant_resistance' && a.effect.target === 'psychic');
    expect(has(apply(fresh(), 6))).toBe(false);
    expect(has(apply(fresh(), 10))).toBe(true);
  });

  it('Spotlit imposes disadvantage on Stealth', () => {
    const e = recomputeDerived(applyCondition(fresh(), UNDERSTUDY_IDS.condition, 'manual', DEFAULT_RULES, h.conditions![0].features), DEFAULT_RULES);
    expect(e.derived.advantageStates.some(a => a.target === 'stealth' && a.state === 'disadvantage')).toBe(true);
  });
});

