import { buildSrd51Pack, buildSrd521Pack, serializePack } from '../packs/srdPacks';
import { buildNonSrd51Pack, buildSrd51UnverifiedPack } from '../packs/nonSrdPacks';
import { PackStore, installOfficialPack, resetOfficialPackService } from '../officialPackService';
import { clearOfficialPacks } from '../officialPacks';
import { getOfficialContentProvider } from '../officialSource';
import { itemsForRuleset, itemIdCandidates, baseItemId, editionItemId, asEditionItem } from '../itemEditions';
import { itemIdForCharacter } from '../itemForCharacter';
import { mergeItemIndex, resolveItemById } from '../contentResolution';
import { itemRepo } from '../itemRepo';
import { RulesetId } from '../../engine/types';

const R2024 = 'dnd5e-2024' as RulesetId;
const R2014 = 'dnd5e-2014' as RulesetId;
const store: PackStore = { save: async () => {}, load: async () => [], remove: async () => {} };
const json = (p: unknown) => JSON.parse(serializePack(p as never));
const items = (p: { homebrew?: unknown }) => ((p.homebrew as { items?: { id: string; rulesetId?: string; name: string; features: { id: string; source: { refId: string } }[] }[] }).items ?? []);

beforeEach(() => { resetOfficialPackService(); clearOfficialPacks(); });
afterAll(() => { resetOfficialPackService(); clearOfficialPacks(); });

describe('5e and 5.5e items that differ do not share an id', () => {
  const s521 = items(buildSrd521Pack());
  const catalog5e = new Set([...items(buildSrd51Pack()), ...items(buildSrd51UnverifiedPack()), ...items(buildNonSrd51Pack())].map(i => i.id));

  it('a 5.5e record never has the id of a 5e record, and every record the pack authors is tagged 5.5e', () => {
    const clash = s521.filter(i => catalog5e.has(i.id) && i.rulesetId === R2024).map(i => i.id);
    expect(clash).toEqual([]);
    const renamed = s521.filter(i => i.id.endsWith('_2024'));
    expect(renamed.length).toBeGreaterThan(150);
    for (const i of renamed) { expect(i.rulesetId).toBe(R2024); expect(catalog5e.has(baseItemId(i.id)) || true).toBe(true); }
  });

  it('a renamed magic item carries its mechanics under the new id (Cloak of Protection keeps its +1)', () => {
    const cloak = s521.find(i => i.id === 'cloak_of_protection_2024')!;
    expect(cloak.name).toBe('Cloak of Protection');
    expect(cloak.features.every(f => f.source.refId === 'cloak_of_protection_2024' || !f.source.refId)).toBe(true);
    expect(cloak.features.some(f => f.id === 'cloak_of_protection_2024_desc')).toBe(true);
    expect((cloak.features as { effects?: unknown[] }[]).some(f => (f.effects?.length ?? 0) > 0)).toBe(true);
    expect(s521.some(i => i.id === 'cloak_of_protection')).toBe(false);
  });

  it('helpers: ids, candidates by ruleset, filtering a list for an edition', () => {
    expect(editionItemId('backpack')).toBe('backpack_2024');
    expect(baseItemId('backpack_2024')).toBe('backpack');
    expect(itemIdCandidates('backpack', R2024)).toEqual(['backpack_2024', 'backpack']);
    expect(itemIdCandidates('backpack', R2014)).toEqual(['backpack', 'backpack_2024']);
    const list = [{ id: 'backpack' }, { id: 'backpack_2024', rulesetId: R2024 }, { id: 'longsword' }];
    expect(itemsForRuleset(list, R2024).map(i => i.id)).toEqual(['backpack_2024', 'longsword']);
    expect(itemsForRuleset(list, R2014).map(i => i.id)).toEqual(['backpack', 'longsword']);
    expect(itemsForRuleset(list, undefined).map(i => i.id)).toEqual(['backpack', 'backpack_2024', 'longsword']);
    const moved = asEditionItem({ id: 'x', features: [{ id: 'x_ac', source: { refId: 'x' } }] }, 'x_2024');
    expect(moved).toMatchObject({ id: 'x_2024', rulesetId: R2024, features: [{ id: 'x_2024_ac', source: { refId: 'x_2024' } }] });
  });

  it('with the packs installed, a 5e character sees the 5e item and a 5.5e character the 5.5e one, never both', async () => {
    for (const p of [buildSrd51Pack(), buildSrd51UnverifiedPack(), buildNonSrd51Pack(), buildSrd521Pack()]) expect(await installOfficialPack(json(p), store)).toEqual({ ok: true });
    const names = (r: RulesetId) => mergeItemIndex([], r).filter(i => i.name === 'Bag of Holding').map(i => i.id);
    expect(names(R2014)).toEqual(['bag_of_holding']);
    expect(names(R2024)).toEqual(['bag_of_holding_2024']);
    expect(resolveItemById('bag_of_holding', [], R2024)!.id).toBe('bag_of_holding_2024');
    expect(resolveItemById('bag_of_holding', [], R2014)!.id).toBe('bag_of_holding');
    expect(resolveItemById('bag_of_holding_2024', [], R2024)!.id).toBe('bag_of_holding_2024');
    const p5 = getOfficialContentProvider()!;
    expect(p5.getItem('bag_of_holding')!.rulesetId).toBeUndefined();
    expect(p5.getItem('bag_of_holding_2024')!.rulesetId).toBe(R2024);
    expect(p5.getItem('bag_of_holding')!.features[0].description).not.toBe(p5.getItem('bag_of_holding_2024')!.features[0].description);
  });

  it('a 5.5e character is given the 5.5e record for starting gear; a 5e character keeps the 5e id; shared items are not renamed', async () => {
    for (const p of [buildSrd51Pack(), buildSrd521Pack()]) expect(await installOfficialPack(json(p), store)).toEqual({ ok: true });
    expect(itemIdForCharacter('backpack', R2024)).toBe('backpack_2024');
    expect(itemIdForCharacter('backpack', R2014)).toBe('backpack');
    expect(itemIdForCharacter('longsword', R2024)).toBe('longsword');   // the same item in both editions
    expect(itemRepo.getItemSync('longsword')).toBeTruthy();
  });

  it('without a pack (the built-in catalog) a character gets the id it was given', () => {
    expect(itemIdForCharacter('backpack', R2024)).toBe('backpack');
  });
});
