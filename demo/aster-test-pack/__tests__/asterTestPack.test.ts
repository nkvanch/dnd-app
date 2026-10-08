// Proves the Aster Test Pack is a VALID, importable pack that actually
// exercises the engine (dependencies, choice, resource, modifier, condition)
// rather than just parsing. If Grimoire's pack format or trait compiler
// changes, this fails before a stale demo file gets sent to anyone.
import { buildAsterTestPack, ASTER_IDS } from '../asterTestPack';
import { validateGrimoirePack, validatePackContents } from '../../../src/engine/backup';
import { collectContentDependencies, buildDependencyClosure } from '../../../src/engine/contentDependencies';
import { makeEmptyEntity, DEFAULT_RULES } from '../../../src/store/characterStore';
import { applyGrant, applyFeatToEntity } from '../../../src/engine/leveling';
import { equipItem, toggleAttunement } from '../../../src/engine/inventory';
import { applyCondition } from '../../../src/engine/conditions';
import { recomputeDerived, applyStatModifiers, collectAllEffects } from '../../../src/engine/pipeline';
import type { Entity } from '../../../src/engine/types';

const pack = buildAsterTestPack();
const hb = pack.homebrew!;

describe('Aster Test Pack — validity', () => {
  it('survives a JSON round-trip and passes envelope + per-content validation', () => {
    const roundTripped = JSON.parse(JSON.stringify(pack));
    expect(validateGrimoirePack(roundTripped)).toBeNull();
    expect(validatePackContents(roundTripped)).toEqual([]);
  });

  it('is clearly labelled Demo everywhere a user could see a name', () => {
    const names = [
      ...(hb.races ?? []), ...(hb.feats ?? []), ...(hb.items ?? []),
      ...(hb.monsters ?? []), ...(hb.spells ?? []), ...(hb.conditions ?? []),
    ].map(c => c.name);
    expect(names).toHaveLength(6);
    for (const n of names) expect(n).toContain('(Demo)');
  });

  it('contains only original ids (all suffixed _demo)', () => {
    for (const c of pack.contents ?? []) expect(c.id.endsWith('_demo')).toBe(true);
  });
});

describe('Aster Test Pack — dependencies', () => {
  it('race and item depend on the spell/condition, monster on the condition', () => {
    expect(collectContentDependencies('race', hb.races![0])).toEqual(expect.arrayContaining([{ type: 'spell', id: ASTER_IDS.spell }]));
    expect(collectContentDependencies('item', hb.items![0])).toEqual(expect.arrayContaining([{ type: 'condition', id: ASTER_IDS.condition }]));
    expect(collectContentDependencies('monster', hb.monsters![0])).toEqual(expect.arrayContaining([{ type: 'condition', id: ASTER_IDS.condition }]));
  });

  it('exporting just the race+item pulls in the spell and condition as dependencies', () => {
    const all: Record<string, unknown> = {};
    for (const [type, list] of [['race', hb.races], ['feat', hb.feats], ['item', hb.items], ['monster', hb.monsters], ['spell', hb.spells], ['condition', hb.conditions]] as const) {
      for (const c of list ?? []) all[`${type}:${(c as { id: string }).id}`] = c;
    }
    const { closure, unresolved } = buildDependencyClosure(
      [{ type: 'race', id: ASTER_IDS.race }, { type: 'item', id: ASTER_IDS.item }],
      ref => all[`${ref.type}:${ref.id}`] as never,
    );
    expect(unresolved).toEqual([]);
    const deps = closure.filter(c => c.included === 'dependency').map(c => `${c.type}:${c.id}`).sort();
    expect(deps).toEqual([`condition:${ASTER_IDS.condition}`, `spell:${ASTER_IDS.spell}`]);
  });

  it('the manifest lists every dependency the walker finds (nothing missing from the pack)', () => {
    const listed = new Set((pack.contents ?? []).map(c => `${c.type}:${c.id}`));
    const refs = [
      ...collectContentDependencies('race', hb.races![0]),
      ...collectContentDependencies('item', hb.items![0]),
      ...collectContentDependencies('monster', hb.monsters![0]),
    ];
    for (const r of refs) expect(listed.has(`${r.type}:${r.id}`)).toBe(true);
  });
});

describe('Aster Test Pack — behaves in the live engine', () => {
  function withRace(): Entity {
    let e: Entity = makeEmptyEntity('demo-char');
    e = { ...e, identity: { ...e.identity, level: 1 } };
    for (const f of hb.races![0].features) e = applyGrant(e, { kind: 'feature', value: f }, 0, undefined, { kind: 'race', id: ASTER_IDS.race });
    for (const r of hb.races![0].resources ?? []) e = applyGrant(e, { kind: 'resource', value: r }, 0, undefined, { kind: 'race', id: ASTER_IDS.race });
    return recomputeDerived(e, DEFAULT_RULES);
  }

  it('the species gives a Constitution modifier, darkvision and a limited resource', () => {
    const e = withRace();
    expect(e.derived.senses.length).toBeGreaterThan(0);
    expect(e.resources.custom.some(r => r.maximum === 2 && r.recharge === 'short_rest')).toBe(true);
    const base = recomputeDerived(makeEmptyEntity('base'), DEFAULT_RULES);
    expect(applyStatModifiers(e.stats, collectAllEffects(e)).con).toBe(base.stats.con + 1);
  });

  it('the feat grants Arcana proficiency', () => {
    let e: Entity = makeEmptyEntity('demo-char');
    e = { ...e, identity: { ...e.identity, level: 1 } };
    e = applyFeatToEntity(e, "demo_feat_choice", 0, hb.feats![0].feature, ASTER_IDS.feat, DEFAULT_RULES);
    expect(e.skills.skills.arcana.trained).toBe(true);
  });

  it('the item gives +1 AC only once attuned', () => {
    let e: Entity = { ...makeEmptyEntity('demo-char'), inventory: { ...makeEmptyEntity('x').inventory, carried: [{ itemId: ASTER_IDS.item, quantity: 1, attuned: false, features: [] }] } };
    e = recomputeDerived(e, DEFAULT_RULES);
    const baseAc = e.derived.ac;
    e = equipItem(e, ASTER_IDS.item, hb.items![0], DEFAULT_RULES);
    expect(e.derived.ac).toBe(baseAc); // equipped but not attuned
    e = recomputeDerived(toggleAttunement(e, ASTER_IDS.item), DEFAULT_RULES);
    expect(e.derived.ac).toBe(baseAc + 1);
  });

  it('the condition is applicable and lowers AC by 1 while active', () => {
    const e0 = recomputeDerived(makeEmptyEntity('demo-char'), DEFAULT_RULES);
    const e1 = recomputeDerived(applyCondition(e0, ASTER_IDS.condition, 'manual', DEFAULT_RULES, hb.conditions![0].features, { unit: 'rounds', remaining: 3 }), DEFAULT_RULES);
    expect(e1.derived.ac).toBe(e0.derived.ac - 1);
  });
});
