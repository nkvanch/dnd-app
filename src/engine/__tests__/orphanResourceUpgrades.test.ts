import { Platform } from 'react-native';
import { getDb } from '../../db/db';
import { saveEntity, loadEntity } from '../../db/entityRepo';
import { makeEmptyEntity, DEFAULT_RULES, useCharacterStore } from '../../store/characterStore';
import { applyGrant, queueChoice, resolveChoice, removeFeature, resetCreationClass } from '../leveling';
import { revokeEntitlementsFromSource, revokeEntitlementsFromChoice, revokeResourceSource } from '../entitlements';
import { recomputeDerived } from '../pipeline';
import { migrateEntity } from '../multiclass';
import { Entity, Grant, EntitlementSourceKind } from '../types';

jest.mock('../../db/db', () => ({ getDb: jest.fn() }));
jest.mock('../../db/timelineRepo', () => ({ recordTimelineEntry: jest.fn(() => Promise.resolve()) }));

const resource: Grant = { kind: 'resource', value: { resourceId: 'focus', name: 'Focus', maximum: 3, recharge: 'long_rest' } };
const upgrade: Grant = { kind: 'resource_upgrade', value: { resourceId: 'focus', newMaximum: 5 } };
const fresh = () => makeEmptyEntity('orphan-resource');
const recompute = (e: Entity) => recomputeDerived(e, DEFAULT_RULES);
const own = (e = fresh(), id = 'owner', kind: EntitlementSourceKind = 'class', choiceId?: string) =>
  applyGrant(e, resource, 1, undefined, { kind, id, choiceId });
const upgradeResource = (e: Entity, choiceId?: string) =>
  applyGrant(e, upgrade, 2, undefined, { kind: 'feat', id: 'upgrader', choiceId });
const upgrades = (e: Entity) => e.entitlements?.filter(r => r.kind === 'resource_upgrade' && r.key === 'focus') ?? [];
function expectRemoved(e: Entity) {
  expect(e.resources.custom.find(r => r.id === 'focus')).toBeUndefined();
  expect(upgrades(e)).toEqual([]);
}
function manual() {
  const e = fresh();
  return { ...e, resources: { ...e.resources, custom: [
    { id: 'focus', name: 'Focus', maximum: 3, current: 1, recharge: 'long_rest' },
  ] } };
}

describe('orphan resource-upgrade lifecycle', () => {
  it.each(['class', 'subclass', 'background', 'feature'] as const)(
    'direct %s source revocation removes its final resource and an independent upgrade', kind => {
      const e = upgradeResource(own(fresh(), 'owner', kind));
      expectRemoved(revokeEntitlementsFromSource(e, kind, 'owner'));
    });
  it('the resource-specific compatibility entry point uses the same cleanup', () => {
    expectRemoved(revokeResourceSource(upgradeResource(own()), 'class', 'owner'));
  });
  it('two resource owners retain the upgrade until the final owner disappears', () => {
    let e = upgradeResource(own(own(), 'other'));
    e = { ...e, resources: { ...e.resources, custom: e.resources.custom.map(r => ({ ...r, current: 2 })) } };
    e = revokeEntitlementsFromSource(e, 'class', 'owner');
    expect(e.resources.custom[0]).toEqual(expect.objectContaining({ maximum: 5, current: 2 }));
    expect(upgrades(e)).toHaveLength(1);
    expectRemoved(revokeEntitlementsFromSource(e, 'class', 'other'));
  });
  it('manual/base ownership survives removing its upgrader, at base max with spent state preserved', () => {
    const e = revokeEntitlementsFromSource(upgradeResource(manual()), 'feat', 'upgrader');
    expect(e.resources.custom[0]).toEqual(expect.objectContaining({ baseMaximum: 3, maximum: 3, current: 1 }));
    expect(upgrades(e)).toEqual([]);
  });
  it('legacy untracked resource ownership survives migration and an additional grant being revoked', () => {
    const e = own(migrateEntity(manual()));
    expect(e.entitlements).toContainEqual({ kind: 'resource_grant', key: 'focus', sourceKind: 'manual' });
    const next = revokeEntitlementsFromSource(upgradeResource(e), 'class', 'owner');
    expect(next.resources.custom).toHaveLength(1);
    expect(upgrades(next)).toHaveLength(1);
    expect(revokeEntitlementsFromSource(next, 'feat', 'upgrader').resources.custom[0].maximum).toBe(3);
  });
  it('choice-owned resource grants remove dependent upgrades on choice revocation', () => {
    expectRemoved(revokeEntitlementsFromChoice(upgradeResource(own(fresh(), 'owner', 'class', 'owner-choice')), 'owner-choice'));
  });
  it('choice-owned upgrades disappear without deleting history or reviving on regrant', () => {
    let e = queueChoice(own(), {
      id: 'upgrade', prompt: 'Improve focus', kind: 'tool', count: 1,
      pool: [{ id: 'yes', label: 'Yes', value: 'yes' }], grants: [upgrade], required: true, resolved: false,
    }, 2, 'upgrader', { kind: 'feat', id: 'upgrader' });
    e = resolveChoice(e, e.choices[0].id, ['yes'], DEFAULT_RULES);
    expect(upgrades(e)[0].choiceId).toBe(e.choices[0].id);
    const removed = revokeEntitlementsFromSource(e, 'class', 'owner');
    expectRemoved(removed);
    expect(removed.choices).toEqual(e.choices);
    expect(removed.choices[0].resolved).toBe(true);
    const regranted = recompute(own(recompute(removed)));
    expect(upgrades(regranted)).toEqual([]);
    expect(regranted.resources.custom[0].maximum).toBe(3);
  });
  it('revoking only an upgrade choice restores manual base capacity', () => {
    const e = revokeEntitlementsFromChoice(upgradeResource(manual(), 'upgrade-choice'), 'upgrade-choice');
    expect(e.resources.custom[0]).toEqual(expect.objectContaining({ maximum: 3, current: 1 }));
    expect(upgrades(e)).toEqual([]);
  });
  it('feature removal reconciles a legacy physical-resource deletion through the central layer', () => {
    let e = manual();
    e.resources.custom[0] = { ...e.resources.custom[0], sourceId: 'feature-owner' } as typeof e.resources.custom[number];
    e = applyGrant(e, { kind: 'feature', value: { id: 'feature-owner', name: 'Owner', description: '',
      source: { kind: 'feature', refId: 'feature-owner' }, level: 1, effects: [], actions: [], choices: [], passive: true } }, 1);
    expectRemoved(removeFeature(upgradeResource(e), 'feature-owner'));
  });
  it('class reset revokes choice-owned resource grants through the central lifecycle', () => {
    let e = own(fresh(), 'independent', 'feat', 'level-choice');
    e = { ...e, choices: [{ id: 'level-choice', grantedAt: 1, resolved: true, selections: [],
      definition: { id: 'level-choice', prompt: '', kind: 'tool', count: 1, pool: [], grants: [], required: true, resolved: true } }] };
    expectRemoved(resetCreationClass(upgradeResource(e), 8));
  });
  it('immediate vs intervening recompute yields identical results and five recomputes are stable', () => {
    const e = upgradeResource(own());
    const once = recompute(revokeEntitlementsFromSource(e, 'class', 'owner'));
    const intervening = recompute(revokeEntitlementsFromSource(recompute(e), 'class', 'owner'));
    expectRemoved(once);
    expect(once).toEqual(intervening);
    let repeated = once;
    for (let i = 0; i < 5; i++) repeated = recompute(repeated);
    expect(repeated).toEqual(once);
  });
  it('recompute repairs already-orphaned active records without inventing dormant upgrades', () => {
    const orphan = upgradeResource(own());
    orphan.resources.custom = [];
    const repaired = recompute(orphan);
    expectRemoved(repaired);
    expect(recompute(repaired)).toEqual(repaired);
  });
  it('save/load and recompute cannot revive an upgrade after final-owner removal', async () => {
    const oldPlatform = Platform.OS;
    Platform.OS = 'android';
    let json = '';
    (getDb as jest.Mock).mockReturnValue({
      runAsync: jest.fn((_query, args) => { json = args[2]; return Promise.resolve(); }),
      getFirstAsync: jest.fn(() => Promise.resolve({ id: 'orphan-resource', data: json })),
    });
    try {
      const e = recompute(revokeEntitlementsFromSource(upgradeResource(own()), 'class', 'owner'));
      await saveEntity(e);
      const loaded = await loadEntity(e.id);
      expect(loaded).toEqual(e);
      expectRemoved(recompute(loaded!));
    } finally { Platform.OS = oldPlatform; }
  });
  it('undo restores only the recorded upgrade snapshot; redo removes it again', () => {
    jest.useFakeTimers();
    try {
      const ownerOnly = recompute(own());
      const withUpgrade = recompute(upgradeResource(ownerOnly));
      const removed = recompute(revokeEntitlementsFromSource(withUpgrade, 'class', 'owner'));
      useCharacterStore.setState({ characters: [ownerOnly], undoStack: [], redoStack: [] });
      useCharacterStore.getState().updateCharacter(ownerOnly.id, () => withUpgrade);
      useCharacterStore.getState().updateCharacter(ownerOnly.id, () => removed);
      useCharacterStore.getState().undo();
      expect(upgrades(useCharacterStore.getState().characters[0])).toHaveLength(1);
      useCharacterStore.getState().undo();
      expect(upgrades(useCharacterStore.getState().characters[0])).toEqual([]);
      expect(useCharacterStore.getState().characters[0].resources.custom[0].maximum).toBe(3);
      useCharacterStore.getState().redo();
      expect(upgrades(useCharacterStore.getState().characters[0])).toHaveLength(1);
      useCharacterStore.getState().redo();
      expectRemoved(recompute(useCharacterStore.getState().characters[0]));
    } finally { jest.clearAllTimers(); jest.useRealTimers(); }
  });
});
