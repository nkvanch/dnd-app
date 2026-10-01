import { checkCampaignCompatibility, CampaignPolicy } from '../campaignCompatibility';
import { makeEmptyEntity } from '../../store/characterStore';
import { Entity, asRulesetId } from '../types';
import { InstalledPack } from '../../db/packRegistryRepo';

function charAt(overrides: Partial<Entity['identity']> = {}, entityOverrides: Partial<Entity> = {}): Entity {
  const empty = makeEmptyEntity('char_test');
  return {
    ...empty,
    identity: { ...empty.identity, level: 5, classId: 'fighter', subclassId: 'champion', raceId: 'human', ...overrides },
    ...entityOverrides,
  };
}

const NO_POLICY: CampaignPolicy = {
  campaignId: 'camp1', name: 'Test Campaign',
  bannedPackIds: [], bannedSubclassIds: [], requiredPacks: [],
};

describe('checkCampaignCompatibility', () => {
  it('no issues when the campaign has no restrictions at all', () => {
    const entity = charAt({ level: 20 });
    expect(checkCampaignCompatibility(entity, NO_POLICY, [])).toEqual([]);
  });

  it('flags a ruleset mismatch only when both sides actually declare one', () => {
    const entity = charAt({}, { rulesetId: asRulesetId('dnd5e-2014') });
    const policy: CampaignPolicy = { ...NO_POLICY, rulesetId: 'dnd5e-2024' };
    const issues = checkCampaignCompatibility(entity, policy, []);
    expect(issues).toEqual([{ kind: 'ruleset_mismatch', message: 'This character is built for dnd5e-2014, but the campaign runs dnd5e-2024.' }]);

    // Same ruleset -> no issue.
    expect(checkCampaignCompatibility(entity, { ...policy, rulesetId: 'dnd5e-2014' }, [])).toEqual([]);
    // Character has no rulesetId set at all -> nothing to compare, no issue.
    expect(checkCampaignCompatibility(charAt(), policy, [])).toEqual([]);
  });

  it('flags a level above the campaign cap, not at or under it', () => {
    const policy: CampaignPolicy = { ...NO_POLICY, maxLevel: 10 };
    expect(checkCampaignCompatibility(charAt({ level: 11 }), policy, [])).toEqual([
      { kind: 'level_cap', message: "Level 11 is above the campaign's cap of level 10." },
    ]);
    expect(checkCampaignCompatibility(charAt({ level: 10 }), policy, [])).toEqual([]);
    // maxLevel: null means uncapped, same as it not being set.
    expect(checkCampaignCompatibility(charAt({ level: 20 }), { ...NO_POLICY, maxLevel: null }, [])).toEqual([]);
  });

  it('flags a banned subclass exactly once even if referenced more than one way', () => {
    const policy: CampaignPolicy = { ...NO_POLICY, bannedSubclassIds: ['champion'] };
    const issues = checkCampaignCompatibility(charAt({ subclassId: 'champion' }), policy, []);
    expect(issues).toEqual([{ kind: 'banned_subclass', message: 'The subclass "champion" isn\'t allowed in this campaign.' }]);
    expect(checkCampaignCompatibility(charAt({ subclassId: 'battle_master' }), policy, [])).toEqual([]);
  });

  it('flags content from a banned pack, naming the pack, deduped per pack', () => {
    const packs: InstalledPack[] = [
      { id: 'pack_forbidden', name: 'Forbidden Expansion', importedAt: 0, itemRefs: [
        { type: 'item', id: 'cursed_blade' }, { type: 'item', id: 'cursed_shield' },
      ] },
    ];
    const entity = charAt({}, {
      inventory: { carried: [{ itemId: 'cursed_blade' } as never, { itemId: 'cursed_shield' } as never], equipped: [] } as never,
    });
    const policy: CampaignPolicy = { ...NO_POLICY, bannedPackIds: ['pack_forbidden'] };
    const issues = checkCampaignCompatibility(entity, policy, packs);
    expect(issues).toEqual([{ kind: 'banned_pack', message: 'Uses content from "Forbidden Expansion", which this campaign doesn\'t allow.' }]);
  });

  it('does not flag content from a pack that is installed but not banned', () => {
    const packs: InstalledPack[] = [
      { id: 'pack_ok', name: 'Fine Expansion', importedAt: 0, itemRefs: [{ type: 'item', id: 'nice_sword' }] },
    ];
    const entity = charAt({}, { inventory: { carried: [{ itemId: 'nice_sword' } as never], equipped: [] } as never });
    const policy: CampaignPolicy = { ...NO_POLICY, bannedPackIds: ['pack_other'] };
    expect(checkCampaignCompatibility(entity, policy, packs)).toEqual([]);
  });

  it('flags a required pack this device does not have installed, naming it from the policy (not the local registry)', () => {
    const policy: CampaignPolicy = { ...NO_POLICY, requiredPacks: [{ id: 'pack_req', name: 'Expanded Bestiary' }] };
    expect(checkCampaignCompatibility(charAt(), policy, [])).toEqual([
      { kind: 'missing_pack', message: 'This campaign expects the "Expanded Bestiary" pack, which isn\'t installed on this device.' },
    ]);
  });

  it('does not flag a required pack that IS installed', () => {
    const packs: InstalledPack[] = [{ id: 'pack_req', name: 'Expanded Bestiary', importedAt: 0, itemRefs: [] }];
    const policy: CampaignPolicy = { ...NO_POLICY, requiredPacks: [{ id: 'pack_req', name: 'Expanded Bestiary' }] };
    expect(checkCampaignCompatibility(charAt(), policy, packs)).toEqual([]);
  });

  it('can report several independent issues from one character at once', () => {
    const entity = charAt({ level: 15, subclassId: 'champion' }, { rulesetId: asRulesetId('dnd5e-2014') });
    const policy: CampaignPolicy = {
      ...NO_POLICY, rulesetId: 'dnd5e-2024', maxLevel: 10, bannedSubclassIds: ['champion'],
      requiredPacks: [{ id: 'pack_req', name: 'Expanded Bestiary' }],
    };
    const kinds = checkCampaignCompatibility(entity, policy, []).map(i => i.kind).sort();
    expect(kinds).toEqual(['banned_subclass', 'level_cap', 'missing_pack', 'ruleset_mismatch']);
  });
});
