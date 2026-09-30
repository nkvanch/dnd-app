// Real-engine tests: accepted DM changes and live-session effects act on a genuine Entity.
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../../engine/pipeline';
import { Entity } from '../../engine/types';
import { applyChangesToEntity, materialFingerprint } from '../entityAdapter';
import { overridesFor, signature, withSessionOverrides, clearStaleSessionEffects, SESSION_OVERRIDE_PREFIX } from '../effectBridge';

function base(): Entity {
  const e = makeEmptyEntity('c1');
  return recomputeDerived({
    ...e, identity: { ...e.identity, name: 'Tester', level: 3 },
    resources: { ...e.resources, hp: { current: 20, maximum: 20, temp: 0 } },
  }, DEFAULT_RULES);
}

describe('applying accepted change requests to a real character', () => {
  it('exhaustion is clamped to 0..6', () => {
    const e = base();
    expect(applyChangesToEntity(e, [{ kind: 'exhaustion', delta: 2 }], DEFAULT_RULES).conditionMonitor.exhaustion).toBe(2);
    expect(applyChangesToEntity(e, [{ kind: 'exhaustion', delta: 99 }], DEFAULT_RULES).conditionMonitor.exhaustion).toBe(6);
    expect(applyChangesToEntity(e, [{ kind: 'exhaustion', delta: -5 }], DEFAULT_RULES).conditionMonitor.exhaustion).toBe(0);
  });

  it('max HP change lowers current HP when needed and never drops below 1', () => {
    const e = base();
    const lowered = applyChangesToEntity(e, [{ kind: 'max_hp', delta: -5 }], DEFAULT_RULES);
    expect(lowered.resources.hp).toMatchObject({ maximum: 15, current: 15 });
    expect(applyChangesToEntity(e, [{ kind: 'max_hp', delta: -500 }], DEFAULT_RULES).resources.hp.maximum).toBe(1);
    expect(applyChangesToEntity(e, [{ kind: 'max_hp', delta: 4 }], DEFAULT_RULES).resources.hp).toMatchObject({ maximum: 24, current: 20 });
  });

  it('ability changes flow through the derived numbers', () => {
    const e = base();
    const up = applyChangesToEntity(e, [{ kind: 'ability', ability: 'dex', delta: 4 }], DEFAULT_RULES);
    expect(up.stats.dex).toBe(14);
    expect(up.derived.initiative).toBe(e.derived.initiative + 2);
  });

  it('the material fingerprint moves only for what a DM request targets', () => {
    const e = base();
    expect(materialFingerprint(e)).toBe(materialFingerprint({ ...e, resources: { ...e.resources, hp: { ...e.resources.hp, current: 3 } } }));  // damage: not material
    expect(materialFingerprint(e)).not.toBe(materialFingerprint(applyChangesToEntity(e, [{ kind: 'max_hp', delta: -1 }], DEFAULT_RULES)));
    expect(materialFingerprint(e)).not.toBe(materialFingerprint(applyChangesToEntity(e, [{ kind: 'exhaustion', delta: 1 }], DEFAULT_RULES)));
  });
});

describe('live-session effects change real derived numbers without revealing their cause', () => {
  it('a secret AC penalty lowers AC, the override carries a neutral label, and ending it restores AC', () => {
    const e = base();
    const desired = overridesFor('c1', [{ applicationId: 'fx1:me', components: [{ stat: 'ac', operation: 'add', value: -1 }] }]);
    const cursed = withSessionOverrides(e, desired, DEFAULT_RULES);
    expect(cursed.derived.ac).toBe(e.derived.ac - 1);
    expect(cursed.dmOverrides.every(o => o.label === 'Session effect')).toBe(true);
    expect(JSON.stringify(cursed.dmOverrides)).not.toMatch(/curse|amulet|secret/i);
    const cleared = withSessionOverrides(cursed, [], DEFAULT_RULES);
    expect(cleared.derived.ac).toBe(e.derived.ac);
    expect(cleared.dmOverrides).toEqual([]);
  });

  it('speed, initiative, saves, spell attack and spell DC are all wired', () => {
    const e = base();
    const desired = overridesFor('c1', [{ applicationId: 'a:me', components: [
      { stat: 'speed', operation: 'add', value: 10 }, { stat: 'initiative', operation: 'add', value: 2 },
      { stat: 'save', operation: 'add', value: 1 }, { stat: 'spell_attack', operation: 'add', value: 1 }, { stat: 'spell_dc', operation: 'add', value: 1 },
    ] }]);
    const buffed = withSessionOverrides(e, desired, DEFAULT_RULES);
    expect(buffed.derived.speed).toBe(e.derived.speed + 10);
    expect(buffed.derived.initiative).toBe(e.derived.initiative + 2);
    for (const ab of ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const) expect(buffed.derived.savingThrows[ab]).toBe(e.derived.savingThrows[ab] + 1);
    expect(buffed.derived.spellAttackBonus).toBe((e.derived.spellAttackBonus ?? 0) + 1);
    expect(buffed.derived.spellSaveDC).toBe((e.derived.spellSaveDC ?? 0) + 1);
  });

  it('only session overrides are replaced; the DM\'s and the player\'s own overrides are untouched', () => {
    const e = base();
    const other = { id: 'manual-1', campaignId: 'c', entityId: 'c1', dmDeviceId: 'd', stat: 'ac', operation: 'add' as const, value: 2, label: 'Shield of faith', active: true, appliedAt: 1, cancelledAt: null, expiry: 'manual' as const };
    const withOther = recomputeDerived({ ...e, dmOverrides: [other] }, DEFAULT_RULES);
    const desired = overridesFor('c1', [{ applicationId: 'x:me', components: [{ stat: 'ac', operation: 'add', value: -1 }] }]);
    const both = withSessionOverrides(withOther, desired, DEFAULT_RULES);
    expect(both.derived.ac).toBe(e.derived.ac + 2 - 1);
    expect(both.dmOverrides.find(o => o.id === 'manual-1')).toBeTruthy();
    const back = withSessionOverrides(both, [], DEFAULT_RULES);
    expect(back.derived.ac).toBe(e.derived.ac + 2);
    expect(back.dmOverrides.map(o => o.id)).toEqual(['manual-1']);
  });

  it('is idempotent: unchanged effects do not rewrite the character', () => {
    const e = base();
    const desired = overridesFor('c1', [{ applicationId: 'x:me', components: [{ stat: 'ac', operation: 'add', value: 1 }] }]);
    const once = withSessionOverrides(e, desired, DEFAULT_RULES);
    expect(withSessionOverrides(once, desired, DEFAULT_RULES)).toBe(once);
    expect(signature(desired)).toBe(signature(overridesFor('c1', [{ applicationId: 'x:me', components: [{ stat: 'ac', operation: 'add', value: 1 }] }])));
    expect(desired.every(o => o.id.startsWith(SESSION_OVERRIDE_PREFIX))).toBe(true);
  });

  it('effects left behind by a killed session are cleared at app start (own overrides survive)', () => {
    const e = base();
    const mine = { id: 'manual-9', campaignId: 'c', entityId: 'c1', dmDeviceId: 'd', stat: 'ac', operation: 'add' as const, value: 1, label: 'Ring', active: true, appliedAt: 1, cancelledAt: null, expiry: 'manual' as const };
    const stuck = withSessionOverrides(recomputeDerived({ ...e, dmOverrides: [mine] }, DEFAULT_RULES),
      overridesFor('c1', [{ applicationId: 'fx:me', components: [{ stat: 'ac', operation: 'add', value: -3 }] }]), DEFAULT_RULES);
    expect(stuck.derived.ac).toBe(e.derived.ac + 1 - 3);
    const healed = clearStaleSessionEffects(stuck, DEFAULT_RULES);
    expect(healed.derived.ac).toBe(e.derived.ac + 1);
    expect(healed.dmOverrides.map(o => o.id)).toEqual(['manual-9']);
    expect(clearStaleSessionEffects(healed, DEFAULT_RULES)).toBe(healed);
  });
});
