import { GLOSSARY_2024, TOOLBOX_2024, EQUIPMENT_RULES_2024 } from '../rules/rulesReference2024Data';
import { installedRulesReferences, searchReference } from '../rules/rulesReference';
import { buildSrd521Pack, buildSrd51Pack } from '../packs/srdPacks';
import { PackStore, installedOfficialPacks, resetOfficialPackService } from '../officialPackService';
import { installBundledPacks } from '../bundledPacks';
import { clearOfficialPacks } from '../officialPacks';

function memoryStore(): PackStore {
  return { save: async () => {}, load: async () => [], remove: async () => {} };
}
beforeEach(() => { resetOfficialPackService(); clearOfficialPacks(); });
afterAll(() => { resetOfficialPackService(); clearOfficialPacks(); });

describe('SRD 5.2.1 rules reference', () => {
  const names = (a: { name: string }[]) => a.map(e => e.name);

  it('has the glossary entries the rules refer to, with real text', () => {
    for (const n of ['Ability Check', 'Advantage', 'Cover', 'Exhaustion', 'Grappled', 'Heroic Inspiration', 'Long Rest', 'Opportunity Attacks', 'Attack', 'Dodge'])
      expect(names(GLOSSARY_2024)).toContain(n);
    expect(GLOSSARY_2024.length).toBeGreaterThan(140);
    for (const e of GLOSSARY_2024) expect(e.text.length).toBeGreaterThan(20);
    expect(GLOSSARY_2024.find(e => e.name === 'Exhaustion')).toMatchObject({ tag: 'Condition' });
    expect(GLOSSARY_2024.find(e => e.name === 'Exhaustion')!.text).toMatch(/reduced by 2 times your Exhaustion level/);
  });

  it('has the toolbox and equipment rules sections', () => {
    for (const n of ['Travel Pace', 'Bestow Curse', 'Fear Effects', 'Traps', 'Combat Encounter Difficulty']) expect(names(TOOLBOX_2024)).toContain(n);
    for (const n of ['Coins', 'Lifestyle Expenses', 'Attunement', 'Crafting Nonmagical Items', 'Brewing Potions of Healing']) expect(names(EQUIPMENT_RULES_2024)).toContain(n);
  });

  it('entry ids are unique and no extraction junk is left in the text', () => {
    const all = [...GLOSSARY_2024, ...TOOLBOX_2024, ...EQUIPMENT_RULES_2024];
    expect(new Set(all.map(e => e.id)).size).toBe(all.length);
    for (const e of all) { expect(e.text).not.toMatch(/System Reference Document 5\.2\.1/); expect(e.text).not.toMatch(/[�­]/); }
  });

  it('search matches names and text, name matches first', () => {
    const r = searchReference(GLOSSARY_2024, 'exhaustion');
    expect(r[0].name).toBe('Exhaustion');
    expect(searchReference(GLOSSARY_2024, '').length).toBe(GLOSSARY_2024.length);
    expect(searchReference(GLOSSARY_2024, 'zzzzqqq')).toEqual([]);
  });

  it('only the SRD 5.2.1 pack carries it, and it is readable once that pack is installed', async () => {
    expect((buildSrd51Pack() as { rules?: Record<string, unknown> }).rules?.reference).toBeUndefined();
    expect((buildSrd521Pack().rules as { reference?: { glossary: unknown[] } }).reference!.glossary.length).toBe(GLOSSARY_2024.length);
    expect(installedRulesReferences()).toEqual([]);
    expect(await installBundledPacks(['grimoire.srd.5.2.1'], memoryStore())).toEqual({ ok: true });
    expect(installedOfficialPacks().length).toBe(2);
    const refs = installedRulesReferences();
    expect(refs).toHaveLength(1);
    expect(refs[0].packId).toBe('grimoire.srd.5.2.1');
    expect(refs[0].reference.toolbox.length).toBe(TOOLBOX_2024.length);
  });
});
