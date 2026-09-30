/** @jest-environment node */
import extraction from '../../../../third_party/wotc/srd/5.1/extracted/items.json';
import canonicalMap from '../srdCanonicalMap.json';

type CanonicalRecord = (typeof extraction.records)[number];
const records = extraction.records as CanonicalRecord[];
const find = (name: string) => records.find(record => record.name === name);

describe('SRD 5.1 canonical item extraction', () => {
  it('maps Magic Items A-Z as an official, structured source section', () => {
    expect(extraction.document).toBe('SRD-5.1-CC');
    expect(extraction.sections.some(section => section.heading === 'Magic Items A-Z')).toBe(true);
    expect(records.filter(record => record.category === 'magic-item').length).toBeGreaterThan(200);
  });

  it.each(['Adamantine Armor', 'Amulet of Health', 'Apparatus of the Crab', 'Vorpal Sword'])('%s is a single canonical record', name => {
    const record = find(name)!;
    expect(record).toBeDefined();
    expect(record.source.recordStructure).toBe('headed-prose-entry');
    expect(record.source.sourceHash).toBe(extraction.sourceHash);
  });

  it.each(['Armor, +1, +2, or +3', 'Weapon, +1, +2, or +3'])('%s remains a parameterized canonical entry', name => {
    expect(find(name)?.structured.itemTypeLine).toContain('+1');
  });

  it('applies only the documented PDF-extraction correction to Wand of the War Mage', () => {
    const record = find('Wand of the War Mage, +1, +2, or +3')!;
    expect(record.extractionCorrection).toMatchObject({
      extracted: 'Wan d of the War Mage, +1, +2, or +3',
      sourcePage: 249,
    });
  });

  it('keeps a multi-page item and its embedded table inside one entry', () => {
    const record = find('Deck of Many Things')!;
    expect(record.source.printedEndPage).toBeGreaterThan(record.source.printedPage);
    expect(record.description).toContain('Avatar of Death');
    expect(find('Avatar of Death')).toBeUndefined();
  });

  it('records only official-PDF evidence with complete page and hash provenance', () => {
    for (const record of records) {
      expect(record.source.document).toBe('SRD-5.1-CC');
      expect(record.source.sourceHash).toBe(extraction.sourceHash);
      expect(record.source.pdfPage).toBe(record.source.printedPage - 1);
      expect(record.source.section).toBeTruthy();
    }
  });

  it('confirms only unique exact identities and finite documented template variants', () => {
    const mappings = canonicalMap.mappings as unknown as Record<string, {
      status: string; canonicalId?: string; sourceHash?: string; kind?: string;
    }>;
    expect(mappings.longsword).toMatchObject({
      status: 'CONFIRMED_CANONICAL', canonicalId: 'srd51:longsword', sourceHash: extraction.sourceHash,
    });
    expect(mappings.weapon_1).toMatchObject({
      status: 'CONFIRMED_TEMPLATE_VARIANT', canonicalId: 'srd51:weapon-1-2-or-3', sourceHash: extraction.sourceHash,
    });
    expect(mappings.light_crossbow).toMatchObject({ status: 'NO_CANONICAL_SOURCE', kind: 'unmapped' });
  });

  it('keeps every captured mundane row as source-derived structured data', () => {
    const mundane = records.filter(record => record.category === 'mundane-equipment');
    expect(mundane).toHaveLength(176);
    const dagger = find('Dagger')!;
    expect(dagger.structured).toMatchObject({ cost: '2 gp', weightPounds: 1, damageDice: '1d4', damageType: 'piercing' });
    expect(mundane.every(record => typeof record.structured.cost === 'string' && 'weightPounds' in record.structured)).toBe(true);
    expect(find('Chain mail')?.structured).toMatchObject({ armorCategory: 'heavy armor', baseAC: 16, strengthRequirement: 13 });
  });
});
