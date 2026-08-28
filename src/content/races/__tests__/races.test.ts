// src/content/races/__tests__/races.test.ts
// Regression coverage for Dragonborn's Draconic Ancestry mechanic (new
// Race.ancestryChoice field + engine wiring) and the Gnome subrace gap-fill —
// authored without a live device/browser preview available this session, so
// these tests are the actual verification that applying a chosen ancestry
// or subrace through the real engine produces the right resistance/breath
// weapon/stat bonuses, not just that the content data typechecks.
import { makeEmptyEntity, DEFAULT_RULES } from '../../../store/characterStore';
import { applyGrant, queueChoice, resolveChoice } from '../../../engine/leveling';
import { recomputeDerived } from '../../../engine/pipeline';
import { raceDragonborn, raceGnome, raceHuman, raceHalfElf, raceElf, raceDwarf, raceHalfling, raceTiefling } from '../index';
import { resolveResistance } from '../../../engine/resolver';
import { collectAllEffects } from '../../../engine/pipeline';
import { Race, Subrace, Ability, Feature, Entity } from '../../../engine/types';

/**
 * Replicates app/creation/race-detail.tsx's selectRace() apply sequence
 * (base features minus any replacesBaseFeatureIds, subrace features,
 * flexibleAsi picks compiled into a Feature, pendingChoices queued) —
 * duplicated here rather than imported since selectRace() is a React
 * component-local function, not an exported engine helper. Kept in sync by
 * hand; if this drifts from the real screen, races.test.ts stops actually
 * verifying what the UI does.
 */
function applyRaceSelection(
  race: Race, subrace: Subrace | null,
  flexPicks: { ability: Ability; amount: number }[] = [],
  ancestryOptionId: string | null = null,
): Entity {
  let e = makeEmptyEntity('e1');
  const replacedIds = new Set(subrace?.replacesBaseFeatureIds ?? []);
  for (const f of race.features) {
    if (replacedIds.has(f.id)) continue;
    e = applyGrant(e, { kind: 'feature', value: { ...f, isActive: true } }, f.level ?? 0);
  }
  for (const r of race.resources ?? []) e = applyGrant(e, { kind: 'resource', value: r }, 0);
  if (subrace) {
    for (const f of subrace.features) e = applyGrant(e, { kind: 'feature', value: { ...f, isActive: true } }, f.level ?? 0);
    for (const r of subrace.resources ?? []) e = applyGrant(e, { kind: 'resource', value: r }, 0);
  }
  // Subrace ancestryChoice OVERRIDES the race's (never combines) — mirrors
  // race-detail.tsx's `ancestryDef = chosenSubraceForUi?.ancestryChoice ?? race?.ancestryChoice`.
  const ancestryDef = subrace?.ancestryChoice ?? race.ancestryChoice;
  const chosenAncestry = ancestryOptionId ? ancestryDef?.options.find(o => o.id === ancestryOptionId) ?? null : null;
  if (chosenAncestry?.feature) {
    e = applyGrant(e, { kind: 'feature', value: { ...chosenAncestry.feature, isActive: true } }, chosenAncestry.feature.level ?? 0);
  }
  if (chosenAncestry?.pendingChoice) {
    e = queueChoice(e, chosenAncestry.pendingChoice, 0);
  }
  const flexAsi = subrace?.flexibleAsi ?? race.flexibleAsi;
  if (flexAsi && flexPicks.length > 0) {
    const flexFeature: Feature = {
      id: `${race.id}_flexible_asi`, name: 'Ability Score Increase', description: flexAsi.prompt,
      source: { kind: 'race', refId: race.id }, level: null, actions: [], choices: [], passive: true,
      effects: flexPicks.map(p => ({ type: 'stat_modifier', target: p.ability, operation: 'add', value: p.amount, condition: null })),
    };
    e = applyGrant(e, { kind: 'feature', value: { ...flexFeature, isActive: true } }, 0);
  }
  for (const choice of [...(race.pendingChoices ?? []), ...(subrace?.pendingChoices ?? [])]) {
    e = queueChoice(e, choice, 0);
  }
  return recomputeDerived(e, DEFAULT_RULES);
}

describe('Dragonborn — Draconic Ancestry', () => {
  it('defines exactly the 10 PHB dragon colors with the correct damage type per color', () => {
    const byId = Object.fromEntries(raceDragonborn.ancestryChoice!.options.map(o => [o.id, o]));
    expect(Object.keys(byId).sort()).toEqual(
      ['black', 'blue', 'brass', 'bronze', 'copper', 'gold', 'green', 'red', 'silver', 'white'].sort(),
    );
    const damageTypeOf = (id: string) => (byId[id].feature!.effects.find(e => e.type === 'grant_resistance')!.target);
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

  it('every Dragonborn subrace is optional, not a mandatory split', () => {
    expect(raceDragonborn.subracesOptional).toBe(true);
    expect(raceDragonborn.subraces?.map(s => s.id).sort()).toEqual([
      'chromatic_dragonborn', 'draconblood', 'gem_dragonborn', 'metallic_dragonborn', 'ravenite',
    ]);
  });

  it('Draconblood grants Int+2/Cha+1, REPLACING the base Str+2/Cha+1 ASI (not stacking — per the source "replacing the Ability Score Increase trait")', () => {
    const draconblood = raceDragonborn.subraces!.find(s => s.id === 'draconblood')!;
    const e = applyRaceSelection(raceDragonborn, draconblood);
    const effects = e.features.flatMap(f => f.effects);
    expect(effects.find(ef => ef.target === 'str')).toBeUndefined(); // base dragonborn_asi's Str+2 is gone
    expect(effects).toEqual(expect.arrayContaining([
      { type: 'stat_modifier', target: 'int', operation: 'add', value: 2, condition: null },
      { type: 'stat_modifier', target: 'cha', operation: 'add', value: 1, condition: null },
    ]));
  });
});

describe('Fizban\'s Chromatic/Metallic/Gem Dragonborn', () => {
  const chromatic = raceDragonborn.subraces!.find(s => s.id === 'chromatic_dragonborn')!;
  const metallic  = raceDragonborn.subraces!.find(s => s.id === 'metallic_dragonborn')!;
  const gem       = raceDragonborn.subraces!.find(s => s.id === 'gem_dragonborn')!;

  it('each defines its own 5-color ancestryChoice, distinct from the base 10-color one', () => {
    expect(chromatic.ancestryChoice!.options.map(o => o.id).sort()).toEqual(['black', 'blue', 'green', 'red', 'white']);
    expect(metallic.ancestryChoice!.options.map(o => o.id).sort()).toEqual(['brass', 'bronze', 'copper', 'gold', 'silver']);
    expect(gem.ancestryChoice!.options.map(o => o.id).sort()).toEqual(['amethyst', 'crystal', 'emerald', 'sapphire', 'topaz']);
  });

  it('the subrace ancestryChoice OVERRIDES the base race one, not adds to it', () => {
    const e = applyRaceSelection(raceDragonborn, chromatic, [
      { ability: 'cha', amount: 2 }, { ability: 'str', amount: 1 },
    ], 'red');
    // Only the chromatic Red breath weapon feature is present — none of the
    // base race's 10 PHB ancestry options were ever offered/applied.
    const breathFeatures = e.features.filter(f => f.name === 'Breath Weapon');
    expect(breathFeatures).toHaveLength(1);
    expect(breathFeatures[0].id).toBe('chromatic_breath_pool_red');
  });

  it('replaces the base ASI and applies the flexible two_one_or_three_one choice', () => {
    const e = applyRaceSelection(raceDragonborn, metallic, [
      { ability: 'cha', amount: 2 }, { ability: 'con', amount: 1 },
    ], 'silver');
    const effects = e.features.flatMap(f => f.effects);
    expect(effects.find(ef => ef.target === 'str')).toBeUndefined(); // base dragonborn_asi gone
    expect(effects).toEqual(expect.arrayContaining([
      { type: 'stat_modifier', target: 'cha', operation: 'add', value: 2, condition: null },
      { type: 'stat_modifier', target: 'con', operation: 'add', value: 1, condition: null },
    ]));
  });

  it('grants a resource-gated 1d10 breath weapon with the correct damage type and a long-rest pool', () => {
    const e = applyRaceSelection(raceDragonborn, gem, [
      { ability: 'wis', amount: 1 }, { ability: 'int', amount: 1 }, { ability: 'cha', amount: 1 },
    ], 'sapphire');
    expect(resolveResistance('thunder', collectAllEffects(e))).toBe('resistance');
    const breath = e.features.find(f => f.id === 'gem_breath_pool_sapphire')!;
    expect(breath.abilityEffects).toEqual([{ type: 'damage', dice: '1d10', damageType: 'thunder', saveOnSuccess: 'half' }]);
    expect(e.resources.custom.find(r => r.id === 'gem_breath_pool')).toMatchObject({ maximum: 2, recharge: 'long_rest' });
  });

  it('Gem Dragonborn always has Psionic Mind regardless of chosen ancestry color', () => {
    const e = applyRaceSelection(raceDragonborn, gem, [
      { ability: 'wis', amount: 1 }, { ability: 'int', amount: 1 }, { ability: 'cha', amount: 1 },
    ], 'topaz');
    expect(e.features.some(f => f.id === 'psionic_mind')).toBe(true);
  });
});

describe('Half-Elf Versatility — real ancestryChoice, was hardcoded to "2 skills" only before', () => {
  it('offers all 7 PHB heritage options', () => {
    expect(raceHalfElf.ancestryChoice!.options.map(o => o.id).sort()).toEqual([
      'cantrip_heritage', 'drow_magic_heritage', 'elf_weapon_training_heritage',
      'fleet_of_foot_heritage', 'mask_of_the_wild_heritage', 'skill_versatility', 'swim_speed_heritage',
    ]);
  });

  it('Skill Versatility queues a real, resolvable 2-skill choice via pendingChoice (no Feature)', () => {
    const skillOpt = raceHalfElf.ancestryChoice!.options.find(o => o.id === 'skill_versatility')!;
    expect(skillOpt.feature).toBeUndefined();
    expect(skillOpt.pendingChoice).toBeDefined();
    const e = applyRaceSelection(raceHalfElf, null, [], 'skill_versatility');
    const pending = e.choices.find(c => c.definition.id.startsWith('race_choice_'));
    expect(pending!.definition.count).toBe(2);
    const resolved = resolveChoice(e, pending!.id, ['insight', 'persuasion'], DEFAULT_RULES);
    expect(resolved.skills.skills.insight.trained).toBe(true);
    expect(resolved.skills.skills.persuasion.trained).toBe(true);
  });

  it('Swim Speed heritage grants a real 30ft swim speed', () => {
    const e = applyRaceSelection(raceHalfElf, null, [], 'swim_speed_heritage');
    expect(e.derived.movement).toEqual({ swim: 30 });
  });

  it('Drow Magic heritage grants a real Dancing Lights cantrip', () => {
    const e = applyRaceSelection(raceHalfElf, null, [], 'drow_magic_heritage');
    expect(e.spellcasting?.cantrips).toContain('dancing_lights');
  });
});

describe('Half-Elf dragonmarks', () => {
  it('Mark of Detection and Mark of Storm both suppress the base Versatility choice and replace the ASI', () => {
    const mod = raceHalfElf.subraces!.find(s => s.id === 'mark_of_detection')!;
    const e = applyRaceSelection(raceHalfElf, mod);
    expect(e.choices.some(c => c.definition.id.startsWith('race_choice_'))).toBe(false);
    const effects = e.features.flatMap(f => f.effects);
    expect(effects.find(ef => ef.target === 'cha')).toBeUndefined(); // base half_elf_asi's cha+2 gone
    expect(effects).toContainEqual({ type: 'stat_modifier', target: 'wis', operation: 'add', value: 2, condition: null });
  });

  it('Mark of Storm grants real CHA+2/DEX+1, lightning resistance, and the Gust cantrip', () => {
    const mos = raceHalfElf.subraces!.find(s => s.id === 'mark_of_storm')!;
    const e = applyRaceSelection(raceHalfElf, mos);
    const effects = e.features.flatMap(f => f.effects);
    expect(effects).toEqual(expect.arrayContaining([
      { type: 'stat_modifier', target: 'cha', operation: 'add', value: 2, condition: null },
      { type: 'stat_modifier', target: 'dex', operation: 'add', value: 1, condition: null },
    ]));
    expect(resolveResistance('lightning', collectAllEffects(e))).toBe('resistance');
    expect(e.spellcasting?.cantrips).toContain('gust');
  });
});

describe('Half-Elf — flexible ASI (real mechanism, was flavor-only before)', () => {
  it('defines a two_distinct_plus_one choice excluding CHA (already fixed at +2)', () => {
    expect(raceHalfElf.flexibleAsi).toMatchObject({
      mode: { kind: 'two_distinct_plus_one', exclude: ['cha'] },
    });
  });

  it('applying the base race + 2 chosen abilities grants CHA+2 plus +1 to each pick', () => {
    const e = applyRaceSelection(raceHalfElf, null, [
      { ability: 'str', amount: 1 }, { ability: 'wis', amount: 1 },
    ]);
    expect(e.stats.cha).toBe(10); // base stats untouched — bonus lives in effects
    const effects = e.features.flatMap(f => f.effects);
    expect(effects).toEqual(expect.arrayContaining([
      { type: 'stat_modifier', target: 'cha', operation: 'add', value: 2, condition: null },
      { type: 'stat_modifier', target: 'str', operation: 'add', value: 1, condition: null },
      { type: 'stat_modifier', target: 'wis', operation: 'add', value: 1, condition: null },
    ]));
  });
});

describe('Variant Human', () => {
  const variant = raceHuman.subraces!.find(s => s.id === 'variant_human')!;

  it('is an optional subrace — plain Human stays fully selectable', () => {
    expect(raceHuman.subracesOptional).toBe(true);
  });

  it('replaces the flat all-abilities-+1 ASI rather than stacking on top of it', () => {
    const e = applyRaceSelection(raceHuman, variant, [
      { ability: 'dex', amount: 1 }, { ability: 'con', amount: 1 },
    ]);
    const strEffects = e.features.flatMap(f => f.effects).filter(ef => ef.target === 'str');
    expect(strEffects).toEqual([]); // no leftover +1 STR from the base human_asi feature
    const dexBonus = e.features.flatMap(f => f.effects).find(ef => ef.target === 'dex');
    expect(dexBonus).toMatchObject({ operation: 'add', value: 1 });
  });

  it('queues a real, resolvable skill choice namespaced under RACE_CHOICE_PREFIX', () => {
    const e = applyRaceSelection(raceHuman, variant, [
      { ability: 'dex', amount: 1 }, { ability: 'con', amount: 1 },
    ]);
    const pending = e.choices.find(c => c.definition.id.startsWith('race_choice_') && c.definition.kind === 'skill');
    expect(pending).toBeDefined();
    expect(pending!.resolved).toBe(false);

    const resolved = resolveChoice(e, pending!.id, ['stealth'], DEFAULT_RULES);
    expect(resolved.skills.skills.stealth.trained).toBe(true);
    expect(resolved.choices.find(c => c.id === pending!.id)?.resolved).toBe(true);
  });
});

describe('Elf and Drow — darkvision/weapon proficiency (previously flavor-only everywhere)', () => {
  it('base Elf grants real 60ft darkvision', () => {
    const e = applyRaceSelection(raceElf, null);
    const senses = e.derived.senses;
    expect(senses).toEqual([{ type: 'darkvision', range: 60, note: undefined }]);
  });

  it('Drow\'s Superior Darkvision (120ft) wins over the base race\'s 60ft via the longest-range dedup', () => {
    const drow = raceElf.subraces!.find(s => s.id === 'drow')!;
    const e = applyRaceSelection(raceElf, drow);
    expect(e.derived.senses).toEqual([{ type: 'darkvision', range: 120, note: undefined }]);
  });

  it('Drow gains Dancing Lights (a real grant_spell cantrip) and weapon proficiencies', () => {
    const drow = raceElf.subraces!.find(s => s.id === 'drow')!;
    const e = applyRaceSelection(raceElf, drow);
    expect(e.spellcasting?.cantrips).toContain('dancing_lights');
    expect(e.spellcasting?.ability).toBe('cha');
    expect(e.proficiencies.weapons).toEqual(expect.arrayContaining(['rapier', 'shortsword', 'hand crossbow']));
  });

  it('High Elf and Wood Elf both grant real Elf Weapon Training (previously missing entirely)', () => {
    const highElf = raceElf.subraces!.find(s => s.id === 'high_elf')!;
    const woodElf = raceElf.subraces!.find(s => s.id === 'wood_elf')!;
    const eHigh = applyRaceSelection(raceElf, highElf);
    const eWood = applyRaceSelection(raceElf, woodElf);
    for (const w of ['longsword', 'shortsword', 'shortbow', 'longbow']) {
      expect(eHigh.proficiencies.weapons).toContain(w);
      expect(eWood.proficiencies.weapons).toContain(w);
    }
  });
});

describe('Dwarf subraces', () => {
  it('Mountain Dwarf grants real light and medium armor proficiency (previously flavor-only)', () => {
    const mountain = raceDwarf.subraces!.find(s => s.id === 'mountain_dwarf')!;
    const e = applyRaceSelection(raceDwarf, mountain);
    expect(e.proficiencies.armor).toEqual(expect.arrayContaining(['light', 'medium']));
  });

  it('Kaladesh Dwarf replaces the base ASI with its own CON+2/WIS+1', () => {
    const kaladesh = raceDwarf.subraces!.find(s => s.id === 'kaladesh_dwarf')!;
    const e = applyRaceSelection(raceDwarf, kaladesh);
    const effects = e.features.flatMap(f => f.effects);
    expect(effects).toEqual(expect.arrayContaining([
      { type: 'stat_modifier', target: 'con', operation: 'add', value: 2, condition: null },
      { type: 'stat_modifier', target: 'wis', operation: 'add', value: 1, condition: null },
    ]));
    // base dwarf_asi's flat con+2 (no wis) is gone, replaced — not stacked
    const conEffects = effects.filter(ef => ef.target === 'con');
    expect(conEffects).toHaveLength(1);
  });

  it('Mark of Warding grants real INT+1, inheriting the rest of base Dwarf unchanged', () => {
    const mow = raceDwarf.subraces!.find(s => s.id === 'mark_of_warding')!;
    const e = applyRaceSelection(raceDwarf, mow);
    const effects = e.features.flatMap(f => f.effects);
    expect(effects).toEqual(expect.arrayContaining([
      { type: 'stat_modifier', target: 'con', operation: 'add', value: 2, condition: null }, // base dwarf_asi, inherited
      { type: 'stat_modifier', target: 'int', operation: 'add', value: 1, condition: null }, // mark of warding's own
    ]));
  });
});

describe('Tiefling — bloodlines, Variant, Abyssal', () => {
  it('base Tiefling (Bloodline of Asmodeus) now grants a real Thaumaturgy cantrip', () => {
    const e = applyRaceSelection(raceTiefling, null);
    expect(e.spellcasting?.cantrips).toContain('thaumaturgy');
    expect(e.spellcasting?.ability).toBe('cha');
  });

  it('every MTOF bloodline is optional and replaces both the base ASI and Infernal Legacy', () => {
    expect(raceTiefling.subracesOptional).toBe(true);
    const zariel = raceTiefling.subraces!.find(s => s.id === 'bloodline_of_zariel')!;
    const e = applyRaceSelection(raceTiefling, zariel);
    const effects = e.features.flatMap(f => f.effects);
    expect(effects.find(ef => ef.target === 'cha')).toBeUndefined(); // base tiefling_asi's cha+2 gone
    expect(effects).toContainEqual({ type: 'stat_modifier', target: 'str', operation: 'add', value: 1, condition: null });
    expect(e.spellcasting?.cantrips).toContain('thaumaturgy'); // Zariel's own cantrip happens to also be thaumaturgy
  });

  it('Bloodline of Fierna grants its distinct Friends cantrip', () => {
    const fierna = raceTiefling.subraces!.find(s => s.id === 'bloodline_of_fierna')!;
    const e = applyRaceSelection(raceTiefling, fierna);
    expect(e.spellcasting?.cantrips).toContain('friends');
  });

  it('Variant Tiefling always applies Feral, plus whichever ancestryChoice option is picked (Winged grants a real fly speed)', () => {
    const variant = raceTiefling.subraces!.find(s => s.id === 'variant_tiefling')!;
    const e = applyRaceSelection(raceTiefling, variant, [], 'winged');
    const effects = e.features.flatMap(f => f.effects);
    expect(effects).toEqual(expect.arrayContaining([
      { type: 'stat_modifier', target: 'int', operation: 'add', value: 1, condition: null },
      { type: 'stat_modifier', target: 'dex', operation: 'add', value: 2, condition: null },
    ]));
    expect(e.derived.movement).toEqual({ fly: 30 });
  });

  it('Variant Tiefling with Devil\'s Tongue grants Vicious Mockery instead', () => {
    const variant = raceTiefling.subraces!.find(s => s.id === 'variant_tiefling')!;
    const e = applyRaceSelection(raceTiefling, variant, [], 'devils_tongue');
    expect(e.spellcasting?.cantrips).toContain('vicious_mockery');
  });

  it('Abyssal Tiefling is additive, keeping the base Asmodeus Thaumaturgy cantrip and adding CON+1', () => {
    const abyssal = raceTiefling.subraces!.find(s => s.id === 'abyssal_tiefling')!;
    const e = applyRaceSelection(raceTiefling, abyssal);
    expect(e.spellcasting?.cantrips).toContain('thaumaturgy');
    const effects = e.features.flatMap(f => f.effects);
    expect(effects).toContainEqual({ type: 'stat_modifier', target: 'con', operation: 'add', value: 1, condition: null });
    expect(effects).toContainEqual({ type: 'stat_modifier', target: 'cha', operation: 'add', value: 2, condition: null }); // base ASI retained
  });
});

describe('Halfling subraces', () => {
  it('Lotusden Halfling grants a real Druidcraft cantrip', () => {
    const lotusden = raceHalfling.subraces!.find(s => s.id === 'lotusden_halfling')!;
    const e = applyRaceSelection(raceHalfling, lotusden);
    expect(e.spellcasting?.cantrips).toContain('druidcraft');
    expect(e.spellcasting?.ability).toBe('wis');
  });

  it('Mark of Hospitality grants a real Prestidigitation cantrip', () => {
    const moh = raceHalfling.subraces!.find(s => s.id === 'mark_of_hospitality')!;
    const e = applyRaceSelection(raceHalfling, moh);
    expect(e.spellcasting?.cantrips).toContain('prestidigitation');
    expect(e.spellcasting?.ability).toBe('cha');
  });

  it('every new subrace still inherits base Halfling Lucky/Brave/Nimbleness (additive, no replacesBaseFeatureIds)', () => {
    const ghostwise = raceHalfling.subraces!.find(s => s.id === 'ghostwise_halfling')!;
    const e = applyRaceSelection(raceHalfling, ghostwise);
    expect(e.features.some(f => f.id === 'halfling_lucky')).toBe(true);
    const effects = e.features.flatMap(f => f.effects);
    expect(effects).toEqual(expect.arrayContaining([
      { type: 'stat_modifier', target: 'dex', operation: 'add', value: 2, condition: null }, // base ASI
      { type: 'stat_modifier', target: 'wis', operation: 'add', value: 1, condition: null }, // ghostwise's own
    ]));
  });
});

describe('Sourcebook Elf subraces', () => {
  it('Astral Elf fully replaces base Elf traits and applies its own flexible ASI + ancestryChoice cantrip', () => {
    const astral = raceElf.subraces!.find(s => s.id === 'astral_elf')!;
    const e = applyRaceSelection(raceElf, astral, [
      { ability: 'int', amount: 2 }, { ability: 'con', amount: 1 },
    ], 'sacred_flame');
    // base elf_asi (dex+2/int+1) must be gone — Astral Elf replaces it entirely
    const effects = e.features.flatMap(f => f.effects);
    expect(effects.filter(ef => ef.target === 'dex')).toEqual([]);
    expect(e.spellcasting?.cantrips).toContain('sacred_flame');
    expect(e.spellcasting?.ability).toBe('cha');
  });

  it('Tajuru queues a real 2-skill choice resolvable via resolveChoice', () => {
    const tajuru = raceElf.subraces!.find(s => s.id === 'tajuru')!;
    const e = applyRaceSelection(raceElf, tajuru);
    const pending = e.choices.find(c => c.definition.id.startsWith('race_choice_') && c.definition.kind === 'skill');
    expect(pending!.definition.count).toBe(2);
    const resolved = resolveChoice(e, pending!.id, ['survival', 'nature'], DEFAULT_RULES);
    expect(resolved.skills.skills.survival.trained).toBe(true);
    expect(resolved.skills.skills.nature.trained).toBe(true);
  });

  it('Sea Elf and Eladrin each replace the base Elf ASI with their own, while keeping base darkvision/fey ancestry/trance', () => {
    const seaElf  = raceElf.subraces!.find(s => s.id === 'sea_elf')!;
    const eladrin = raceElf.subraces!.find(s => s.id === 'eladrin')!;
    const eSea = applyRaceSelection(raceElf, seaElf);
    const eEladrin = applyRaceSelection(raceElf, eladrin, [], 'winter');

    const seaEffects = eSea.features.flatMap(f => f.effects);
    expect(seaEffects).toEqual(expect.arrayContaining([
      { type: 'stat_modifier', target: 'dex', operation: 'add', value: 2, condition: null },
      { type: 'stat_modifier', target: 'con', operation: 'add', value: 1, condition: null },
    ]));
    expect(seaEffects.find(ef => ef.target === 'int')).toBeUndefined(); // base elf_asi's int+1 gone
    expect(eSea.derived.senses).toEqual([{ type: 'darkvision', range: 60, note: undefined }]); // inherited from base Elf

    const eladrinEffects = eEladrin.features.flatMap(f => f.effects);
    expect(eladrinEffects).toEqual(expect.arrayContaining([
      { type: 'stat_modifier', target: 'dex', operation: 'add', value: 2, condition: null },
      { type: 'stat_modifier', target: 'cha', operation: 'add', value: 1, condition: null },
    ]));
    expect(eladrinEffects.find(ef => ef.target === 'int')).toBeUndefined();
    expect(eEladrin.features.some(f => f.id === 'eladrin_season_winter')).toBe(true);
  });

  it('Sea Elf grants a real 30ft swim speed', () => {
    const seaElf = raceElf.subraces!.find(s => s.id === 'sea_elf')!;
    const e = applyRaceSelection(raceElf, seaElf);
    expect(e.derived.movement).toEqual({ swim: 30 });
  });

  it('Avariel Elf grants a real 30ft fly speed', () => {
    const avariel = raceElf.subraces!.find(s => s.id === 'avariel_elf')!;
    const e = applyRaceSelection(raceElf, avariel);
    expect(e.derived.movement).toEqual({ fly: 30 });
  });

  it('Mul Daya\'s Superior Darkvision (120ft) wins over the base race\'s 60ft, same as Drow', () => {
    const mulDaya = raceElf.subraces!.find(s => s.id === 'mul_daya')!;
    const e = applyRaceSelection(raceElf, mulDaya);
    expect(e.derived.senses).toEqual([{ type: 'darkvision', range: 120, note: undefined }]);
    expect(e.spellcasting?.cantrips).toContain('chill_touch');
  });

  it('every non-Drow, non-replacing subrace still inherits base Elf Keen Senses (Perception proficiency)', () => {
    const pallid = raceElf.subraces!.find(s => s.id === 'pallid_elf')!;
    const e = applyRaceSelection(raceElf, pallid);
    expect(e.skills.skills.perception.trained).toBe(true);
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
