// src/engine/__tests__/packDiagnostics.test.ts
import { diagnosePack, HomebrewContentSlice, bannedContentIds, contentUsedBy, removedPackItemRefs, stillReferencedRefs } from '../packDiagnostics';
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

  it('does not flag a character as using this pack\'s content when only a DIFFERENT content type shares the same id string (audit bug #9)', () => {
    // The pack installed an ITEM called "iron_will"; the character equips a
    // completely unrelated ITEM with a different id but has a RACE that
    // happens to be named "iron_will" too (e.g. two homebrew authors
    // independently slugified different names to the same id). The old,
    // type-blind check compared raw ids across every content type and
    // would have falsely flagged this character as using the pack.
    const homebrew = emptyHomebrew();
    homebrew.items.push({ id: 'iron_will' });
    homebrew.races.push({ id: 'iron_will' });
    const pack = makePack({ itemRefs: [{ type: 'item', id: 'iron_will' }] });
    const character: Entity = {
      ...makeEmptyEntity('char1'),
      identity: { ...makeEmptyEntity('char1').identity, raceId: 'iron_will' }, // race, not item
    };
    const issues = diagnosePack(pack, [pack], homebrew, [character]);
    expect(issues.filter(i => i.code === 'pack_content_in_use')).toHaveLength(0);
  });

  it('still flags in-use content correctly when a matching-id race in the SAME pack is actually worn as a race (type-correct positive control)', () => {
    const homebrew = emptyHomebrew();
    homebrew.items.push({ id: 'iron_will' });
    homebrew.races.push({ id: 'iron_will' });
    const pack = makePack({ itemRefs: [{ type: 'item', id: 'iron_will' }, { type: 'race', id: 'iron_will' }] });
    const character: Entity = {
      ...makeEmptyEntity('char1'),
      identity: { ...makeEmptyEntity('char1').identity, name: 'Vex', raceId: 'iron_will' },
    };
    const issues = diagnosePack(pack, [pack], homebrew, [character]);
    expect(issues).toContainEqual(expect.objectContaining({ code: 'pack_content_in_use', affectedId: 'char1' }));
  });

  // HOMEBREW-PACKAGE-1 item 17: uninstall diagnostics must also catch OTHER
  // homebrew definitions (not just saved characters) that structurally
  // depend on this pack's content — the exact "Homebrew Subclass 'Tidewater
  // Domain' → uses Feature: 'Ocean's Wrath'" scenario from the spec.
  it('flags another (locally-authored) homebrew Subrace that still depends on this pack\'s Race', () => {
    const homebrew = emptyHomebrew();
    homebrew.races.push({ id: 'tideborn', name: 'Tideborn' } as never);
    homebrew.subraces.push({ id: 'reefborn', name: 'Reefborn', parentId: 'tideborn' } as never);
    const pack = makePack({ itemRefs: [{ type: 'race', id: 'tideborn' }] }); // pack owns only the Race — the Subrace is local, not part of this pack
    const issues = diagnosePack(pack, [pack], homebrew, []);
    expect(issues).toContainEqual(expect.objectContaining({
      code: 'pack_content_in_use', affectedId: 'reefborn',
      message: expect.stringContaining('Reefborn'),
    }));
  });

  it('does not flag a Subrace that belongs to the SAME pack as its parent Race', () => {
    const homebrew = emptyHomebrew();
    homebrew.races.push({ id: 'tideborn', name: 'Tideborn' } as never);
    homebrew.subraces.push({ id: 'reefborn', name: 'Reefborn', parentId: 'tideborn' } as never);
    const pack = makePack({ itemRefs: [{ type: 'race', id: 'tideborn' }, { type: 'subrace', id: 'reefborn' }] });
    const issues = diagnosePack(pack, [pack], homebrew, []);
    expect(issues.filter(i => i.affectedId === 'reefborn')).toHaveLength(0);
  });
});

// Item 18 (homebrew improvements — reference usage, single item not a whole pack)
describe('contentUsedBy', () => {
  it('finds a character via a typed field (race)', () => {
    const character: Entity = {
      ...makeEmptyEntity('char1'),
      identity: { ...makeEmptyEntity('char1').identity, name: 'Vex', raceId: 'goblinkin' },
    };
    const used = contentUsedBy([character], 'race', 'goblinkin');
    expect(used.map(c => c.id)).toEqual(['char1']);
  });

  it('finds a character via a typed field (item, carried or equipped)', () => {
    const carried: Entity = {
      ...makeEmptyEntity('char1'),
      inventory: { ...makeEmptyEntity('char1').inventory, carried: [{ itemId: 'iron_sword', quantity: 1, attuned: false, features: [] }] },
    };
    expect(contentUsedBy([carried], 'item', 'iron_sword').map(c => c.id)).toEqual(['char1']);
  });

  it('finds a character via a resolved choice selection, untyped fallback', () => {
    const character: Entity = {
      ...makeEmptyEntity('char1'),
      choices: [{
        id: 'c1', grantedAt: 1, resolved: true, selections: ['homebrew_feat_x'],
        definition: { id: 'c1', prompt: 'Pick a feat', kind: 'feat', count: 1, pool: [], grants: [], required: true, resolved: true },
      }],
    };
    expect(contentUsedBy([character], 'feat', 'homebrew_feat_x').map(c => c.id)).toEqual(['char1']);
  });

  it('does not match an UNresolved choice selection', () => {
    const character: Entity = {
      ...makeEmptyEntity('char1'),
      choices: [{
        id: 'c1', grantedAt: 1, resolved: false, selections: ['homebrew_feat_x'],
        definition: { id: 'c1', prompt: 'Pick a feat', kind: 'feat', count: 1, pool: [], grants: [], required: true, resolved: true },
      }],
    };
    expect(contentUsedBy([character], 'feat', 'homebrew_feat_x')).toEqual([]);
  });

  it('returns an empty array when no character references the content', () => {
    const character = makeEmptyEntity('char1');
    expect(contentUsedBy([character], 'race', 'nonexistent')).toEqual([]);
  });

  it('never matches a monster/companion entity via the choice fallback (kind !== character)', () => {
    const monster: Entity = {
      ...makeEmptyEntity('mon1', 'monster'),
      choices: [{
        id: 'c1', grantedAt: 1, resolved: true, selections: ['homebrew_feat_x'],
        definition: { id: 'c1', prompt: 'x', kind: 'feat', count: 1, pool: [], grants: [], required: true, resolved: true },
      }],
    };
    expect(contentUsedBy([monster], 'feat', 'homebrew_feat_x')).toEqual([]);
  });
});

// Item 15 (campaign content manifest)
describe('bannedContentIds', () => {
  it('collects every itemRef id from banned packs only', () => {
    const packA = makePack({ id: 'a', itemRefs: [{ type: 'item', id: 'sword' }, { type: 'race', id: 'goblinkin' }] });
    const packB = makePack({ id: 'b', itemRefs: [{ type: 'feat', id: 'power_attack' }] });
    const ids = bannedContentIds([packA, packB], ['a']);
    expect(ids).toEqual(new Set(['sword', 'goblinkin']));
  });

  it('returns an empty set when no pack ids are banned', () => {
    const packA = makePack({ id: 'a', itemRefs: [{ type: 'item', id: 'sword' }] });
    expect(bannedContentIds([packA], [])).toEqual(new Set());
  });

  it('silently skips a banned pack id that is no longer installed', () => {
    const packA = makePack({ id: 'a', itemRefs: [{ type: 'item', id: 'sword' }] });
    expect(() => bannedContentIds([packA], ['ghost_pack'])).not.toThrow();
    expect(bannedContentIds([packA], ['ghost_pack'])).toEqual(new Set());
  });

  it('combines refs from multiple banned packs into one flat set', () => {
    const packA = makePack({ id: 'a', itemRefs: [{ type: 'item', id: 'sword' }] });
    const packB = makePack({ id: 'b', itemRefs: [{ type: 'race', id: 'goblinkin' }] });
    expect(bannedContentIds([packA, packB], ['a', 'b'])).toEqual(new Set(['sword', 'goblinkin']));
  });
});

// HOMEBREW-PACKAGE-1 items 33/34: pack version updates
describe('removedPackItemRefs', () => {
  it('returns refs present in the old set but absent from the new set', () => {
    const oldRefs = [{ type: 'item' as const, id: 'sword' }, { type: 'race' as const, id: 'goblinkin' }];
    const newRefs = [{ type: 'item' as const, id: 'sword' }];
    expect(removedPackItemRefs(oldRefs, newRefs)).toEqual([{ type: 'race', id: 'goblinkin' }]);
  });

  it('returns an empty array when nothing was removed', () => {
    const oldRefs = [{ type: 'item' as const, id: 'sword' }];
    const newRefs = [{ type: 'item' as const, id: 'sword' }, { type: 'item' as const, id: 'shield' }];
    expect(removedPackItemRefs(oldRefs, newRefs)).toEqual([]);
  });

  it('does not confuse two different types sharing the same id string', () => {
    const oldRefs = [{ type: 'item' as const, id: 'iron_will' }];
    const newRefs = [{ type: 'race' as const, id: 'iron_will' }]; // same id, different type — not a match
    expect(removedPackItemRefs(oldRefs, newRefs)).toEqual([{ type: 'item', id: 'iron_will' }]);
  });
});

describe('stillReferencedRefs', () => {
  it('keeps a removed ref that a saved character still references', () => {
    const homebrew = emptyHomebrew();
    homebrew.races.push({ id: 'old_race' });
    const character: Entity = { ...makeEmptyEntity('char1'), identity: { ...makeEmptyEntity('char1').identity, name: 'Thren', raceId: 'old_race' } };
    const removed = [{ type: 'race' as const, id: 'old_race' }];
    expect(stillReferencedRefs(removed, [], homebrew, [character])).toEqual(removed);
  });

  it('drops a removed ref nothing references', () => {
    const homebrew = emptyHomebrew();
    homebrew.races.push({ id: 'old_race' });
    const removed = [{ type: 'race' as const, id: 'old_race' }];
    expect(stillReferencedRefs(removed, [], homebrew, [])).toEqual([]);
  });

  it('keeps a removed ref still depended on by another homebrew definition', () => {
    const homebrew = emptyHomebrew();
    homebrew.races.push({ id: 'old_race' });
    homebrew.subraces.push({ id: 'sub1', parentId: 'old_race' } as HomebrewContentSlice['subraces'][number]);
    const removed = [{ type: 'race' as const, id: 'old_race' }];
    expect(stillReferencedRefs(removed, [], homebrew, [])).toEqual(removed);
  });

  it('partitions a mixed batch correctly — some kept, some not', () => {
    const homebrew = emptyHomebrew();
    homebrew.races.push({ id: 'used_race' }, { id: 'unused_race' });
    const character: Entity = { ...makeEmptyEntity('char1'), identity: { ...makeEmptyEntity('char1').identity, raceId: 'used_race' } };
    const removed = [{ type: 'race' as const, id: 'used_race' }, { type: 'race' as const, id: 'unused_race' }];
    expect(stillReferencedRefs(removed, [], homebrew, [character])).toEqual([{ type: 'race', id: 'used_race' }]);
  });
});
