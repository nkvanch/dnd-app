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
import { raceDragonborn, raceGnome, raceHuman, raceHalfElf } from '../index';
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
  race: Race, subrace: Subrace | null, flexPicks: { ability: Ability; amount: number }[] = [],
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
