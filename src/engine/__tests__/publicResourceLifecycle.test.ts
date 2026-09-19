import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import {
  applyGrant, applySubclassToEntity, removeFeature, resetCreationClass, swapBackground,
} from '../leveling';
import { asClassId, Background, ChoiceState, ClassProgression, Entity, Feature, Grant } from '../types';

const resource = (id: string, maximum: number): Grant => ({
  kind: 'resource',
  value: { resourceId: id, name: id, maximum, recharge: 'long_rest' },
});
const upgrade = (id: string, newMaximum: number): Grant => ({
  kind: 'resource_upgrade', value: { resourceId: id, newMaximum },
});
const emptyBackground = (id: string): Background => ({ id, name: id, features: [] });
const emptyFeature = (
  id: string, sourceKind: Feature['source']['kind'] = 'feat', sourceId = id,
): Feature => ({
  id, name: id, description: '', level: 1,
  source: { kind: sourceKind, refId: sourceId },
  effects: [], actions: [], choices: [], passive: true,
});
const historicalChoice = (id: string): ChoiceState => ({
  id, grantedAt: 0, resolved: true, selections: ['kept'],
  definition: {
    id: 'history', prompt: 'History', kind: 'tool', count: 1,
    pool: [{ id: 'kept', label: 'Kept', value: 'kept' }],
    grants: [], required: true, resolved: true,
  },
});

function grantResource(
  entity: Entity, id: string, maximum: number,
  source: { kind: 'class' | 'subclass' | 'background' | 'feature' | 'feat'; id: string },
): Entity {
  return applyGrant(entity, resource(id, maximum), 1, undefined, source);
}

function grantUpgrade(
  entity: Entity, id: string, newMaximum: number,
  source: { kind: 'feature' | 'feat'; id: string },
): Entity {
  return applyGrant(entity, upgrade(id, newMaximum), 1, undefined, source);
}

function expectResource(entity: Entity, id: string, maximum: number, current?: number) {
  expect(entity.resources.custom.find(r => r.id === id)).toEqual(expect.objectContaining({
    id, maximum, ...(current === undefined ? {} : { current }),
  }));
}

function expectNoResourceOrUpgrade(entity: Entity, id: string) {
  expect(entity.resources.custom.some(r => r.id === id)).toBe(false);
  expect(entity.entitlements?.some(e => e.kind === 'resource_upgrade' && e.key === id)).toBe(false);
}

function oldSubclassProgression(): ClassProgression {
  return {
    classId: 'fighter',
    entries: [{
      level: 3, hpDie: 10, choices: [],
      grants: [
        { kind: 'feature', value: emptyFeature('old_subclass_feature', 'subclass', 'old_subclass') },
        resource('subclass_pool', 3),
      ],
    }],
  };
}

const replacementSubclass: ClassProgression = {
  classId: 'fighter',
  entries: [{
    level: 3, hpDie: 10, choices: [],
    grants: [{ kind: 'feature', value: emptyFeature('replacement_feature', 'subclass', 'replacement_subclass') }],
  }],
};

function fighterWithSubclassChoice(): Entity {
  const entity = makeEmptyEntity('public-resource-lifecycle');
  return {
    ...entity,
    identity: {
      ...entity.identity, classId: 'fighter', level: 3,
      classes: [{ classId: asClassId('fighter'), subclassId: null, level: 3 }],
    },
    choices: [{
      id: 'subclass_choice', grantedAt: 3, resolved: false, selections: [],
      definition: {
        id: 'subclass_choice', prompt: 'Subclass', kind: 'subclass', count: 1,
        pool: [], grants: [], required: true, resolved: false,
      },
    }, historicalChoice('unrelated-history')],
  };
}

describe('public resource lifecycle orphan cleanup', () => {
  it('applySubclassToEntity removes a final old-subclass owner and its independent upgrade only', () => {
    let entity = applySubclassToEntity(
      fighterWithSubclassChoice(), 'subclass_choice', 'old_subclass',
      oldSubclassProgression(), DEFAULT_RULES, 'fighter',
    );
    entity = grantUpgrade(entity, 'subclass_pool', 5, { kind: 'feat', id: 'pool_upgrade' });
    entity = grantResource(entity, 'unrelated_pool', 2, { kind: 'feat', id: 'unrelated_owner' });
    entity = grantUpgrade(entity, 'unrelated_pool', 4, { kind: 'feat', id: 'unrelated_upgrade' });
    entity = {
      ...entity,
      resources: { ...entity.resources, custom: entity.resources.custom.map(r =>
        r.id === 'unrelated_pool' ? { ...r, current: 1 } : r) },
    };
    expectResource(entity, 'subclass_pool', 5);

    const replaced = applySubclassToEntity(
      entity, 'subclass_choice', 'replacement_subclass',
      replacementSubclass, DEFAULT_RULES, 'fighter',
    );

    expectNoResourceOrUpgrade(replaced, 'subclass_pool');
    expect(replaced.features.some(f => f.id === 'old_subclass_feature')).toBe(false);
    expect(replaced.features.some(f => f.id === 'replacement_feature')).toBe(true);
    expectResource(replaced, 'unrelated_pool', 4, 1);
    expect(replaced.entitlements).toContainEqual(expect.objectContaining({
      kind: 'resource_upgrade', key: 'unrelated_pool', sourceId: 'unrelated_upgrade',
    }));
    expect(replaced.choices.find(c => c.id === 'unrelated-history')).toEqual(historicalChoice('unrelated-history'));
  });

  it('applySubclassToEntity preserves an overlapping owner until removeFeature removes the final owner', () => {
    let entity = applySubclassToEntity(
      fighterWithSubclassChoice(), 'subclass_choice', 'old_subclass',
      oldSubclassProgression(), DEFAULT_RULES, 'fighter',
    );
    entity = applyGrant(entity, { kind: 'feature', value: emptyFeature('backup_owner') }, 1);
    entity = grantResource(entity, 'subclass_pool', 3, { kind: 'feature', id: 'backup_owner' });
    entity = grantUpgrade(entity, 'subclass_pool', 5, { kind: 'feat', id: 'pool_upgrade' });

    const replaced = applySubclassToEntity(
      entity, 'subclass_choice', 'replacement_subclass',
      replacementSubclass, DEFAULT_RULES, 'fighter',
    );
    expectResource(replaced, 'subclass_pool', 5);
    expect(replaced.entitlements).toContainEqual(expect.objectContaining({
      kind: 'resource_upgrade', key: 'subclass_pool', sourceId: 'pool_upgrade',
    }));

    expectNoResourceOrUpgrade(removeFeature(replaced, 'backup_owner'), 'subclass_pool');
  });

  it('swapBackground removes the old background final owner without recharging unrelated resources', () => {
    const history = historicalChoice('background-history');
    let entity = makeEmptyEntity('background-resource-lifecycle');
    entity = { ...entity, identity: { ...entity.identity, backgroundId: 'old_background' }, choices: [history] };
    entity = grantResource(entity, 'background_pool', 2, { kind: 'background', id: 'old_background' });
    entity = grantUpgrade(entity, 'background_pool', 4, { kind: 'feat', id: 'background_upgrade' });
    entity = grantResource(entity, 'unrelated_pool', 3, { kind: 'feat', id: 'unrelated_owner' });
    entity = grantUpgrade(entity, 'unrelated_pool', 5, { kind: 'feat', id: 'unrelated_upgrade' });
    entity = {
      ...entity,
      resources: { ...entity.resources, custom: entity.resources.custom.map(r =>
        r.id === 'unrelated_pool' ? { ...r, current: 1 } : r) },
    };

    const replaced = swapBackground(entity, emptyBackground('new_background'), DEFAULT_RULES);

    expectNoResourceOrUpgrade(replaced, 'background_pool');
    expectResource(replaced, 'unrelated_pool', 5, 1);
    expect(replaced.entitlements).toContainEqual(expect.objectContaining({
      kind: 'resource_upgrade', key: 'unrelated_pool', sourceId: 'unrelated_upgrade',
    }));
    expect(replaced.choices.find(c => c.id === history.id)).toEqual(history);
  });

  it('resetCreationClass removes an actual class-owned final resource and preserves unrelated ownership', () => {
    let entity = makeEmptyEntity('class-resource-lifecycle');
    entity = {
      ...entity,
      identity: {
        ...entity.identity, classId: 'fighter', level: 1,
        classes: [{ classId: asClassId('fighter'), subclassId: null, level: 1 }],
      },
    };
    entity = grantResource(entity, 'class_pool', 2, { kind: 'class', id: 'fighter' });
    entity = grantUpgrade(entity, 'class_pool', 4, { kind: 'feat', id: 'class_pool_upgrade' });
    entity = grantResource(entity, 'unrelated_pool', 3, { kind: 'feat', id: 'unrelated_owner' });
    entity = grantUpgrade(entity, 'unrelated_pool', 5, { kind: 'feat', id: 'unrelated_upgrade' });

    const reset = resetCreationClass(entity, 8);

    expectNoResourceOrUpgrade(reset, 'class_pool');
    expect(reset.entitlements?.some(e => e.kind === 'resource_grant'
      && e.key === 'class_pool' && e.sourceKind === 'class')).toBe(false);
    expectResource(reset, 'unrelated_pool', 5);
    expect(reset.entitlements).toContainEqual(expect.objectContaining({
      kind: 'resource_grant', key: 'unrelated_pool', sourceId: 'unrelated_owner',
    }));
  });

  it('removeFeature removes a normally source-stamped resource and preserves unrelated history and resources', () => {
    const history = historicalChoice('feature_owner:history_1');
    let entity = makeEmptyEntity('feature-resource-lifecycle');
    entity = applyGrant(entity, { kind: 'feature', value: emptyFeature('feature_owner') }, 1);
    entity = { ...entity, choices: [history] };
    entity = grantResource(entity, 'feature_pool', 2, { kind: 'feature', id: 'feature_owner' });
    entity = grantUpgrade(entity, 'feature_pool', 4, { kind: 'feat', id: 'feature_pool_upgrade' });
    entity = grantResource(entity, 'unrelated_pool', 3, { kind: 'feat', id: 'unrelated_owner' });

    const removed = removeFeature(entity, 'feature_owner');

    expectNoResourceOrUpgrade(removed, 'feature_pool');
    expect(removed.features.some(f => f.id === 'feature_owner')).toBe(false);
    expectResource(removed, 'unrelated_pool', 3);
    expect(removed.choices.find(c => c.id === history.id)).toEqual(history);
  });
});
