import { Platform } from 'react-native';
import { getDb } from '../db';
import { saveEntity, loadEntity } from '../entityRepo';
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { acquireClass, applyGrant } from '../../engine/leveling';
import { ALL_CHAR_CLASSES } from '../../content/classes';
import { recomputeDerived } from '../../engine/pipeline';
import { grantEntitlement } from '../../engine/entitlements';
import { commitSpellPayment } from '../../engine/spellPayment';
jest.mock('../db', () => ({ getDb: jest.fn() }));

it('SQLite JSON round-trip preserves authoritative records, canonical classes, and both spent pools', async () => {
  const oldPlatform = Platform.OS;
  Platform.OS = 'android';
  let json = '';
  (getDb as jest.Mock).mockReturnValue({
    runAsync: jest.fn((_query, args) => { json = args[2]; return Promise.resolve(); }),
    getFirstAsync: jest.fn(() => Promise.resolve({ id: 'persist', data: json })),
  });
  try {
    let entity = acquireClass(makeEmptyEntity('persist'), ALL_CHAR_CLASSES.find(c => c.id === 'warlock')!, DEFAULT_RULES);
    entity = acquireClass(entity, ALL_CHAR_CLASSES.find(c => c.id === 'wizard')!, DEFAULT_RULES);
    entity = grantEntitlement(entity, { kind: 'spell_access', key: 'magic_missile', sourceKind: 'class',
      sourceId: 'wizard', choiceId: 'persistent_spell_choice' });
    entity = applyGrant(entity, { kind: 'resource', value: { resourceId: 'custom_pool', name: 'Pool', maximum: 3, recharge: 'long_rest' } }, 1, 'wizard');
    entity = applyGrant(entity, { kind: 'resource_upgrade', value: { resourceId: 'custom_pool', newMaximum: 5 } }, 2,
      undefined, { kind: 'feat', id: 'persistent_upgrade', choiceId: 'persistent_choice' });
    entity = commitSpellPayment(commitSpellPayment(entity, { kind: 'normal', tier: '1' }), { kind: 'pact', tier: '1' });
    entity = recomputeDerived(entity, DEFAULT_RULES);
    await saveEntity(entity);
    const loaded = await loadEntity('persist');
    expect(loaded).toEqual(entity);
    expect(recomputeDerived(loaded!, DEFAULT_RULES)).toEqual(entity);
    expect(loaded!.spellcasting!.slots['1'].used).toBe(1);
    expect(loaded!.spellcasting!.pactSlots!['1'].used).toBe(1);
    expect(loaded!.entitlements).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'resource_grant', key: 'custom_pool', sourceId: 'wizard' }),
      expect.objectContaining({ kind: 'resource_upgrade', key: 'custom_pool', sourceId: 'persistent_upgrade',
        choiceId: 'persistent_choice', amount: 2 }),
      expect.objectContaining({ kind: 'spell_access', key: 'magic_missile', sourceId: 'wizard', choiceId: 'persistent_spell_choice' }),
    ]));
    expect(loaded!.resources.custom.find(r => r.id === 'custom_pool')).toEqual(expect.objectContaining({ baseMaximum: 3, maximum: 5 }));
  } finally { Platform.OS = oldPlatform; }
});
