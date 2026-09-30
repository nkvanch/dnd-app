/** @jest-environment node */
import generated from '../generatedSrdItems.json';
import { GENERATED_SRD_ITEMS, GENERATED_SRD_ITEM_PROVENANCE } from '../generatedSrdItems';
import { hasVerifiedPublicItemProvenance } from '../srdProvenance';

describe('canonical-generated SRD public items', () => {
  it('exposes only records with generated canonical provenance', () => {
    expect(GENERATED_SRD_ITEMS).toHaveLength(95);
    for (const item of GENERATED_SRD_ITEMS) {
      const provenance = GENERATED_SRD_ITEM_PROVENANCE[item.id];
      expect(provenance).toBeDefined();
      expect(provenance.publicRecordHash).toMatch(/^[a-f0-9]{64}$/);
      expect(hasVerifiedPublicItemProvenance(item.id)).toBe(true);
    }
  });

  it('derives representative structured fields from canonical table data', () => {
    const byId = new Map(GENERATED_SRD_ITEMS.map(item => [item.id, item]));
    expect(byId.get('longsword')).toMatchObject({ cost: '15 gp', weight: 3, properties: ['versatile (1d10)'] });
    expect(byId.get('longsword')?.features[0]?.abilityEffects).toEqual([{ type: 'damage', dice: '1d8', damageType: 'slashing' }]);
    expect(byId.get('chain_mail')).toMatchObject({ cost: '75 gp', weight: 55, properties: expect.arrayContaining(['heavy armor', 'STR 13 required']) });
    expect(byId.get('shield')?.features[0]?.effects).toEqual([{ type: 'stat_modifier', target: 'ac', operation: 'add', value: 2, condition: null }]);
  });

  it('contains no imported-record description dependency', () => {
    // The generated artifact has no import path to the private catalog. Every
    // public description is an empty structured-only description or a fixed
    // conversion of extracted table fields, recorded in `fields`.
    for (const item of GENERATED_SRD_ITEMS) {
      expect(item.features.every(feature => !feature.description.includes('Items with descriptions.md'))).toBe(true);
      expect(GENERATED_SRD_ITEM_PROVENANCE[item.id].fields).toBeDefined();
    }
  });

  it('is deterministic at the artifact level', () => {
    expect(generated.generatorVersion).toBe(1);
    expect(generated.sourceHash).toBe('2504d2a0abb0a4d491a939be4f17910a2dde0312570ab8d208080225ccf0a1f0');
  });
});
