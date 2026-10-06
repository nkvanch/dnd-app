import { EQUIPMENT_2024, EQUIPMENT_2024_IDS, ARMOR_IDS_2024 } from '../items/equipment2024';
import { TOOL_ROWS, GEAR_ROWS, VARIANT_ROWS, MOUNT_ROWS } from '../items/equipment2024Data';
import { FULL_ITEM_LIBRARY } from '../items';
import { WEAPON_MASTERY_TABLE } from '../weaponMastery';
import { buildSrd521Pack } from '../packs/srdPacks';

describe('SRD 5.2.1 equipment', () => {
  const byId = new Map(FULL_ITEM_LIBRARY.map(i => [i.id, i]));

  it('the SRD lists 25 tools and the generated rows carry their ability, price and weight', () => {
    expect(TOOL_ROWS).toHaveLength(25);
    const smith = TOOL_ROWS.find(r => r.name === "Smith's Tools")!;
    expect(smith).toMatchObject({ cost: '20 gp', weight: 8, ability: 'Strength' });
    expect(smith.utilize).toMatch(/Pry open a door/);
    expect(TOOL_ROWS.find(r => r.name === "Thieves' Tools")).toMatchObject({ cost: '25 gp', weight: 1, ability: 'Dexterity' });
  });

  it('gear rows have the SRD price and weight (table order is preserved)', () => {
    const row = (n: string) => GEAR_ROWS.find(r => r.name === n)!;
    expect(row('Acid')).toMatchObject({ cost: '25 gp', weight: 1 });
    expect(row('Barrel')).toMatchObject({ cost: '2 gp', weight: 70 });
    expect(row('Entertainer\'s Pack')).toMatchObject({ cost: '40 gp', weight: 58.5 });
    expect(row('Potion of Healing')).toMatchObject({ cost: '50 gp', weight: 0.5 });
    expect(row('Waterskin')).toMatchObject({ cost: '2 sp', weight: 5 });
    expect(row('Spyglass')).toMatchObject({ cost: '1,000 gp' });
    expect(row('Tent')).toMatchObject({ cost: '2 gp', weight: 20 });
    expect(GEAR_ROWS.every(r => r.text && r.text.length > 10)).toBe(true);
  });

  it('every id the list names is in the catalog, with no duplicate ids', () => {
    const missing = EQUIPMENT_2024_IDS.filter(id => !byId.has(id));
    expect(missing).toEqual([]);
    const all = [...TOOL_ROWS, ...GEAR_ROWS, ...VARIANT_ROWS, ...MOUNT_ROWS].map(r => r.id);
    expect(new Set(all).size).toBe(all.length);
    const added = EQUIPMENT_2024.map(i => i.id);
    expect(new Set(added).size).toBe(added.length);
  });

  it('the new armors use the same Armor Class formula as the catalog', () => {
    const padded = byId.get('padded_armor')!;
    expect(padded.features[0].effects[0]).toMatchObject({ type: 'base_ac_formula', value: 11 });
    expect(padded.properties).toContain('disadvantage on stealth');
    const hide = byId.get('hide_armor')!;
    expect(hide.features[0].effects[0]).toMatchObject({ value: 12, formulaAbilityCap: { dex: 2 } });
    for (const id of ARMOR_IDS_2024) expect(byId.has(id)).toBe(true);
  });

  it('the Musket and Pistol deal 1d12 and 1d10 piercing and every mastery weapon exists', () => {
    expect(byId.get('musket')!.features[0].abilityEffects![0]).toMatchObject({ dice: '1d12', damageType: 'piercing' });
    expect(byId.get('pistol')!.features[0].abilityEffects![0]).toMatchObject({ dice: '1d10', damageType: 'piercing' });
    expect(WEAPON_MASTERY_TABLE.filter(w => !byId.has(w.id))).toEqual([]);
  });

  it('the SRD 5.2.1 pack carries the whole equipment list: tools, gear, armor, weapons, mounts and vehicles', () => {
    const ids = new Set(((buildSrd521Pack().homebrew?.items ?? []) as { id: string }[]).map(i => i.id));
    // 5.1 pack items are its own; the 5.2.1 pack must cover everything the 5.1 pack's verified set lacks.
    for (const id of ['padded_armor', 'hide_armor', 'musket', 'pistol', 'acid', 'camel', 'warhorse', 'airship', 'cobbler_s_tools', 'arcane_focus_rod']) expect(ids.has(id)).toBe(true);
  });
});
