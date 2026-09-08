// src/engine/__tests__/packDiagnostics.test.ts
import { diagnosePack, HomebrewContentSlice } from '../packDiagnostics';
import { InstalledPack } from '../../db/packRegistryRepo';
import { makeEmptyEntity } from '../../store/characterStore';
import { Entity } from '../types';

function emptyHomebrew(): HomebrewContentSlice {
  return {
    races: [], subraces: [], classes: [], subclasses: [], spells: [],
    backgrounds: [], features: [], items: [], feats: [], monsters: [], conditions: [],
  };
}

function makePack(overrides: Partial<InstalledPack>): InstalledPack {
  return { id: 'pack1', name: 'Test Pack', importedAt: 0, itemRefs: [], ...overrides };
}

describe('diagnosePack', () => {
  it('returns no issues for a pack whose content is all present, unshadowed, and unused', () => {
    const homebrew = emptyHomebrew();
    homebrew.items.push({ id: 'sword_of_test' });
    const pack = makePack({ itemRefs: [{ type: 'item', id: 'sword_of_test' }] });
    expect(diagnosePack(pack, [pack], homebrew, [])).toEqual([]);
  });

  it('flags a broken reference when the referenced content no longer exists', () => {
    const pack = makePack({ itemRefs: [{ type: 'item', id: 'deleted_sword' }] });
    const issues = diagnosePack(pack, [pack], emptyHomebrew(), []);
    expect(issues).toContainEqual(expect.objectContaining({ code: 'pack_broken_reference', affectedId: 'deleted_sword' }));
  });

  it('flags content shadowed by another installed pack claiming the same {type, id}', () => {
    const homebrew = emptyHomebrew();
    homebrew.items.push({ id: 'shared_id' });
    const packA = makePack({ id: 'a', name: 'Pack A', itemRefs: [{ type: 'item', id: 'shared_id' }] });
    const packB = makePack({ id: 'b', name: 'Pack B', itemRefs: [{ type: 'item', id: 'shared_id' }] });
    const issuesA = diagnosePack(packA, [packA, packB], homebrew, []);
    expect(issuesA).toContainEqual(expect.objectContaining({ code: 'pack_content_shadowed', affectedId: 'shared_id', message: expect.stringContaining('Pack B') }));
  });

  it('does not flag shadowing when only one pack claims an id', () => {
    const homebrew = emptyHomebrew();
    homebrew.items.push({ id: 'solo_id' });
    const pack = makePack({ itemRefs: [{ type: 'item', id: 'solo_id' }] });
    const issues = diagnosePack(pack, [pack], homebrew, []);
    expect(issues.filter(i => i.code === 'pack_content_shadowed')).toHaveLength(0);
  });

  it('flags mixed rulesets within one pack as info', () => {
    const homebrew = emptyHomebrew();
    homebrew.items.push({ id: 'item_5e', rulesetId: '5e' });
    homebrew.items.push({ id: 'item_55e', rulesetId: '5.5e' });
    const pack = makePack({ itemRefs: [{ type: 'item', id: 'item_5e' }, { type: 'item', id: 'item_55e' }] });
    const issues = diagnosePack(pack, [pack], homebrew, []);
    expect(issues).toContainEqual(expect.objectContaining({ code: 'pack_ruleset_mixed', severity: 'info' }));
  });

  it('does not flag a single-ruleset pack', () => {
    const homebrew = emptyHomebrew();
    homebrew.items.push({ id: 'item_a', rulesetId: '5e' });
    homebrew.items.push({ id: 'item_b', rulesetId: '5e' });
    const pack = makePack({ itemRefs: [{ type: 'item', id: 'item_a' }, { type: 'item', id: 'item_b' }] });
    const issues = diagnosePack(pack, [pack], homebrew, []);
    expect(issues.filter(i => i.code === 'pack_ruleset_mixed')).toHaveLength(0);
  });

  it('flags a saved character that still uses this pack\'s content', () => {
    const homebrew = emptyHomebrew();
    homebrew.races.push({ id: 'homebrew_race' });
    const pack = makePack({ itemRefs: [{ type: 'race', id: 'homebrew_race' }] });
    const character: Entity = { ...makeEmptyEntity('char1'), identity: { ...makeEmptyEntity('char1').identity, name: 'Thren', raceId: 'homebrew_race' } };
    const issues = diagnosePack(pack, [pack], homebrew, [character]);
    expect(issues).toContainEqual(expect.objectContaining({ code: 'pack_content_in_use', affectedId: 'char1', message: expect.stringContaining('Thren') }));
  });

  it('does not flag a character that uses unrelated content', () => {
    const homebrew = emptyHomebrew();
    homebrew.races.push({ id: 'homebrew_race' });
    const pack = makePack({ itemRefs: [{ type: 'race', id: 'homebrew_race' }] });
    const character: Entity = { ...makeEmptyEntity('char1'), identity: { ...makeEmptyEntity('char1').identity, raceId: 'human' } };
    const issues = diagnosePack(pack, [pack], homebrew, [character]);
    expect(issues.filter(i => i.code === 'pack_content_in_use')).toHaveLength(0);
  });

  it('ignores non-character entities when checking for in-use content', () => {
    const homebrew = emptyHomebrew();
    homebrew.races.push({ id: 'homebrew_race' });
    const pack = makePack({ itemRefs: [{ type: 'race', id: 'homebrew_race' }] });
    const monster: Entity = { ...makeEmptyEntity('m1', 'monster'), identity: { ...makeEmptyEntity('m1').identity, raceId: 'homebrew_race' } };
    const issues = diagnosePack(pack, [pack], homebrew, [monster]);
    expect(issues.filter(i => i.code === 'pack_content_in_use')).toHaveLength(0);
  });
});
