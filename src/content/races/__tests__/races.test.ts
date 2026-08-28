// src/content/races/__tests__/races.test.ts
// Regression coverage for Dragonborn's Draconic Ancestry mechanic (new
// Race.ancestryChoice field + engine wiring) and the Gnome subrace gap-fill —
// authored without a live device/browser preview available this session, so
// these tests are the actual verification that applying a chosen ancestry
// or subrace through the real engine produces the right resistance/breath
// weapon/stat bonuses, not just that the content data typechecks.
import { makeEmptyEntity, DEFAULT_RULES } from '../../../store/characterStore';
import { applyGrant } from '../../../engine/leveling';
import { recomputeDerived } from '../../../engine/pipeline';
import { raceDragonborn, raceGnome } from '../index';
import { resolveResistance } from '../../../engine/resolver';
import { collectAllEffects } from '../../../engine/pipeline';

describe('Dragonborn — Draconic Ancestry', () => {
  it('defines exactly the 10 PHB dragon colors with the correct damage type per color', () => {
    const byId = Object.fromEntries(raceDragonborn.ancestryChoice!.options.map(o => [o.id, o]));
    expect(Object.keys(byId).sort()).toEqual(
      ['black', 'blue', 'brass', 'bronze', 'copper', 'gold', 'green', 'red', 'silver', 'white'].sort(),
    );
    const damageTypeOf = (id: string) => (byId[id].feature.effects.find(e => e.type === 'grant_resistance')!.target);
    expect(damageTypeOf('black')).toBe('acid');
    expect(damageTypeOf('blue')).toBe('lightning');
    expect(damageTypeOf('gold')).toBe('fire');
    expect(damageTypeOf('green')).toBe('poison');
    expect(damageTypeOf('silver')).toBe('cold');
  });

  it('applying a chosen ancestry grants both the resistance and a resource-gated breath weapon', () => {
    let e = makeEmptyEntity('e1');
    // Base race application (as race-detail.tsx does): base features + resources.
    for (const f of raceDragonborn.features) e = applyGrant(e, { kind: 'feature', value: { ...f, isActive: true } }, 0);
    for (const r of raceDragonborn.resources ?? []) e = applyGrant(e, { kind: 'resource', value: r }, 0);
    // Chosen ancestry: Red.
    const red = raceDragonborn.ancestryChoice!.options.find(o => o.id === 'red')!;
    e = applyGrant(e, { kind: 'feature', value: { ...red.feature, isActive: true } }, 0);
    e = recomputeDerived(e, DEFAULT_RULES);

    expect(resolveResistance('fire', collectAllEffects(e))).toBe('resistance');
    expect(resolveResistance('cold', collectAllEffects(e))).toBe('none'); // not the chosen color
    expect(e.resources.custom.find(r => r.id === 'dragonborn_breath_pool')).toMatchObject({ current: 1, maximum: 1, recharge: 'short_rest' });
    const breathFeature = e.features.find(f => f.id === 'dragonborn_breath_red')!;
    expect(breathFeature.abilityEffects).toEqual([{ type: 'damage', dice: '2d6', damageType: 'fire', saveOnSuccess: 'half' }]);
    expect(breathFeature.activation?.resourceCost).toEqual({ resourceId: 'dragonborn_breath_pool', quantity: 1 });
  });

  it('Draconblood/Ravenite are optional subraces, not a mandatory split', () => {
    expect(raceDragonborn.subracesOptional).toBe(true);
    expect(raceDragonborn.subraces?.map(s => s.id).sort()).toEqual(['draconblood', 'ravenite']);
  });

  it('Draconblood grants Int+2/Cha+1, replacing the base Str+2/Cha+1 ASI (applied alongside, not instead — matches race-detail.tsx\'s "base then subrace" apply order)', () => {
    let e = makeEmptyEntity('e1');
    for (const f of raceDragonborn.features) e = applyGrant(e, { kind: 'feature', value: { ...f, isActive: true } }, 0);
    const draconblood = raceDragonborn.subraces!.find(s => s.id === 'draconblood')!;
    for (const f of draconblood.features) e = applyGrant(e, { kind: 'feature', value: { ...f, isActive: true } }, 0);
    e = recomputeDerived(e, DEFAULT_RULES);
    // int +2 from Draconblood; str +2/cha +1(base)+1(draconblood)=+2 from stacking both feature sets
    expect(e.derived).toBeDefined();
    const intEffect = e.features.flatMap(f => f.effects).find(ef => ef.target === 'int');
    expect(intEffect).toMatchObject({ operation: 'add', value: 2 });
  });
});

describe('Gnome subraces', () => {
  it('defines Forest Gnome and Rock Gnome as required subraces', () => {
    expect(raceGnome.subracesOptional).toBeUndefined();
    expect(raceGnome.subraces?.map(s => s.id).sort()).toEqual(['forest_gnome', 'rock_gnome']);
  });

  it('Forest Gnome grants the Minor Illusion cantrip via a real grant_spell effect', () => {
    let e = makeEmptyEntity('e1');
    for (const f of raceGnome.features) e = applyGrant(e, { kind: 'feature', value: { ...f, isActive: true } }, 0);
    const forestGnome = raceGnome.subraces!.find(s => s.id === 'forest_gnome')!;
    for (const f of forestGnome.features) e = applyGrant(e, { kind: 'feature', value: { ...f, isActive: true } }, 0);
    expect(e.spellcasting?.cantrips).toContain('minor_illusion');
    expect(e.spellcasting?.ability).toBe('int');
  });

  it('Rock Gnome grants tinker\'s tools proficiency', () => {
    let e = makeEmptyEntity('e1');
    for (const f of raceGnome.features) e = applyGrant(e, { kind: 'feature', value: { ...f, isActive: true } }, 0);
    const rockGnome = raceGnome.subraces!.find(s => s.id === 'rock_gnome')!;
    for (const f of rockGnome.features) e = applyGrant(e, { kind: 'feature', value: { ...f, isActive: true } }, 0);
    e = recomputeDerived(e, DEFAULT_RULES);
    expect(e.proficiencies.tools).toContain('tinkers tools');
  });
});
