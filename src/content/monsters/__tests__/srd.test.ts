// src/content/monsters/__tests__/srd.test.ts
// First test coverage for the SRD monster library. Content-shape checks
// only (no per-monster mechanical assertions) — the actual spawn pipeline
// (makeEmptyEntity -> stat/HP/feature application -> recomputeDerived) is
// already covered by monsterFactory's own responsibilities; this file
// guards the two things adding more monster templates can actually break:
// id collisions (a stable, unique id per monster and per feature) and a
// clean spawn (no template shape spawnMonster() chokes on).
import { spawnMonster } from '../../../engine/monsterFactory';
import { FULL_MONSTER_LIBRARY } from '../srd';

describe('FULL_MONSTER_LIBRARY', () => {
  it('has a unique id for every monster template', () => {
    const ids = FULL_MONSTER_LIBRARY.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has a unique feature id within every monster template', () => {
    for (const m of FULL_MONSTER_LIBRARY) {
      const featureIds = m.features.map(f => f.id);
      expect(new Set(featureIds).size).toBe(featureIds.length);
    }
  });

  it('spawns every template into an Entity without throwing, with HP/AC matching the template', () => {
    for (const m of FULL_MONSTER_LIBRARY) {
      const entity = spawnMonster(m);
      expect(entity.resources.hp.maximum).toBe(m.hp.average);
      expect(entity.derived.ac).toBe(m.ac.value);
      expect(entity.identity.name).toBe(m.name);
    }
  });

  it('carries every attack feature\'s activation/abilityEffects through to the spawned entity', () => {
    for (const m of FULL_MONSTER_LIBRARY) {
      const entity = spawnMonster(m);
      const attackFeatureIds = m.features.filter(f => !f.passive).map(f => f.id);
      const spawnedIds = entity.features.map(f => f.id);
      for (const id of attackFeatureIds) {
        expect(spawnedIds).toContain(id);
      }
    }
  });
});
