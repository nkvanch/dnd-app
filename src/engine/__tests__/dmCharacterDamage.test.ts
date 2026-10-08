// src/engine/__tests__/dmCharacterDamage.test.ts
// Rules-engine blocker RE-AUDIT closure (single-issue, DM nonmagical-attack
// forwarding): app/dm/character/[id].tsx's onDamage prop used to accept only
// (amount, damageType) and silently drop the third argument TabCharacter's
// HpModal now supplies (isNonmagicalAttack) — so checking "Nonmagical
// attack" on a DM-managed elemental Wild Shape had no effect. This proves
// the ACTUAL exported function that file's onDamage callback calls forwards
// the flag correctly, not just that applyWildShapeDamage itself supports it
// (that's already covered by combat.test.ts's own native-defense suite).
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { startWildShape } from '../combat';
import { dmDamageMutation } from '../dmCharacterDamage';
import { Entity } from '../types';

function testEntity(hp = 50): Entity {
  const e = makeEmptyEntity('dm-test-entity', 'character');
  return { ...e, resources: { ...e.resources, hp: { current: hp, maximum: hp, temp: 0 } } };
}

describe('dmDamageMutation (DM character sheet damage forwarding)', () => {
  it('forwards isNonmagicalAttack=true through to applyWildShapeDamage — native elemental B/P/S resistance applies', () => {
    const shaped = startWildShape(testEntity(50), 'air_elemental', DEFAULT_RULES); // beastHpMax 90
    const result = dmDamageMutation(shaped, DEFAULT_RULES, 40, 'bludgeoning', true);
    expect(result.wildShapeState?.beastHp).toBe(70); // 90 - floor(40/2)=20 -> resisted
  });

  it('the SAME input with isNonmagicalAttack=false (or omitted) applies full, unresisted damage', () => {
    const shaped = startWildShape(testEntity(50), 'air_elemental', DEFAULT_RULES); // beastHpMax 90
    const resultFalse = dmDamageMutation(shaped, DEFAULT_RULES, 40, 'bludgeoning', false);
    expect(resultFalse.wildShapeState?.beastHp).toBe(50); // 90 - 40, unresisted

    const resultOmitted = dmDamageMutation(shaped, DEFAULT_RULES, 40, 'bludgeoning');
    expect(resultOmitted.wildShapeState?.beastHp).toBe(50);
  });

  it('a non-transformed entity is unaffected by isNonmagicalAttack — routes to applyDamage as normal', () => {
    const e = testEntity(50);
    const result = dmDamageMutation(e, DEFAULT_RULES, 10, 'bludgeoning', true);
    expect(result.resources.hp.current).toBe(40);
  });
});

// Additional regression lock (source-text): the deliverable's own warning —
// "must prove the third argument is forwarded, not merely that the engine
// itself supports it" — is proven behaviorally above via the real exported
// function. This lock additionally pins the wiring in the route file itself
// so a future edit can't silently reintroduce the dropped-argument bug by
// inlining the call again.
describe('app/dm/character/[id].tsx wiring regression lock', () => {
  it('the onDamage prop forwards a third argument to dmDamageMutation', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const source = fs.readFileSync(path.join(__dirname, '../../../app/dm/character/[id].tsx'), 'utf8');
    const match = source.match(/onDamage=\{([^]*?)\}\s*\n\s*onHeal=/);
    expect(match).not.toBeNull();
    const onDamageProp = match![1];
    expect(onDamageProp).toMatch(/\(amt,\s*dt,\s*isNonmagicalAttack\)/);
    expect(onDamageProp).toContain('dmDamageMutation(e, rules, amt, dt, isNonmagicalAttack)');
  });
});
