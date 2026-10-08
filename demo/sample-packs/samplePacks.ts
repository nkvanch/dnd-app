// demo/sample-packs/samplePacks.ts
// Three ORIGINAL, TEST/DEMO-ONLY sample packs for creator outreach. Like the
// Aster Test Pack, nothing under app/ or src/ imports this file, so none of it
// ships in the app bundle — each reaches a device only as a separate
// .grimoire-pack import file, the same path any creator's own pack uses.
//
//   Breadth Test Pack    — 1 species, 1 subclass, 1 feat, 2 spells, 1 item, 1 monster (breadth + dependencies)
//   Stormbound Test Pack — feat, spell, weapon, creature, condition (one theme across content types)
//   Understudy Test Pack — one deliberately awkward CHARACTER concept (resource + progression + condition + passive + active)
//
// Everything is built through the app's OWN trait compiler and pack
// constructor, and nothing uses third-party content or wording.
import { newDraftTrait, buildTraitFeature } from '../../src/content/traitCompiler';
import { createPackageContentPack, GrimoirePack, PackageContentRef } from '../../src/engine/backup';
import { asSubclassId } from '../../src/engine/types';
import type {
  Race, Feat, Item, Spell, Condition, Feature, HomebrewSubclass, Grant, DraftTrait, LevelEntry,
} from '../../src/engine/types';
import type { MonsterTemplate } from '../../src/content/monsters/types';

const DEMO = '(Demo)';
const note = (pack: string) => `TEST/DEMO CONTENT, part of the ${pack}. Not for play.`;

type ContentType = PackageContentRef['type'];
const ref = (type: ContentType, id: string, name: string, included: 'selected' | 'dependency'): PackageContentRef =>
  ({ type, id, name, included });

/** Compile one draft trait into the Grants a subclass level entry carries. */
function traitGrants(t: DraftTrait, subclassId: string, level: number): Grant[] {
  const built = buildTraitFeature(t, { idPrefix: `${subclassId}_l${level}`, sourceKind: 'subclass', sourceRefId: subclassId, level });
  const grants: Grant[] = [{ kind: 'feature', value: built.feature }];
  if (built.resource) grants.push({ kind: 'resource', value: built.resource });
  for (const f of built.extraFeatures ?? []) grants.push({ kind: 'feature', value: f });
  for (const r of built.extraResources ?? []) grants.push({ kind: 'resource', value: r });
  return grants;
}

function subclassEntries(hpDie: LevelEntry['hpDie'], levels: Record<number, Grant[]>): LevelEntry[] {
  return Object.entries(levels).map(([lvl, grants]) => ({ level: Number(lvl), grants, choices: [], hpDie }));
}

function pack(
  homebrew: Parameters<typeof createPackageContentPack>[0],
  contents: PackageContentRef[],
  meta: { name: string; description: string },
): GrimoirePack {
  return createPackageContentPack(
    homebrew, contents,
    { name: meta.name, author: 'Grimoire (original demo content)', packageVersion: '1.0', description: meta.description },
    null, '1.0.0',
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 1. BREADTH TEST PACK (Jonoman3000)
// ════════════════════════════════════════════════════════════════════════════
export const BREADTH_IDS = {
  spellA: 'tide_pull_demo', spellB: 'brine_ward_demo',
  race: 'tidewalker_demo', subclass: 'undertow_vanguard_demo',
  feat: 'tide_reader_demo', item: 'tidecaller_buckle_demo', monster: 'tide_thrall_demo',
} as const;
const BP = 'Breadth Test Pack';

export function buildBreadthPack(): GrimoirePack {
  const tidePull: Spell = {
    id: BREADTH_IDS.spellA, name: `Tide Pull ${DEMO}`, level: 1, school: 'Transmutation',
    castingTime: '1 action', range: '30 feet', components: ['V', 'S'], duration: 'Instantaneous',
    description: `${note(BP)} Water drags a creature you can see 10 feet toward you unless it succeeds on a Strength save.`,
    upcast: '', ritual: false, concentration: false, classes: ['wizard', 'druid'], spellType: ['control'],
  };
  const brineWard: Spell = {
    id: BREADTH_IDS.spellB, name: `Brine Ward ${DEMO}`, level: 2, school: 'Abjuration',
    castingTime: '1 reaction', range: 'Self', components: ['V', 'S'], duration: '1 round',
    description: `${note(BP)} A shell of brine reduces the damage you take from one attack.`,
    upcast: '', ritual: false, concentration: false, classes: ['wizard', 'cleric'], spellType: ['defense'],
  };

  // Species: a modifier, a resistance, and a spell grant (→ dependency on Tide Pull)
  const dex = newDraftTrait('Quick Current');
  dex.effectKind = 'ability_score'; dex.abilityTarget = 'dex'; dex.abilityAmount = '1'; dex.description = '+1 Dexterity.';
  const cold = newDraftTrait('Deepwater Blood');
  cold.effectKind = 'damage_resistance'; cold.damageType = 'cold'; cold.description = 'Resistance to cold damage.';
  const pull = newDraftTrait('Tidal Gift');
  pull.effectKind = 'spell_grant'; pull.spellGrantAbility = 'wis';
  pull.spellGrants = [{
    localId: 'g1', spellId: BREADTH_IDS.spellA, spellName: tidePull.name, actionType: 'action',
    unlockLevel: '1', mode: 'resource', recharge: 'long_rest', rechargeOther: '', uses: '1', minSlotLevel: '1',
  }];
  pull.description = 'Cast Tide Pull (Demo) once per long rest.';
  const raceOpts = { idPrefix: BREADTH_IDS.race, sourceKind: 'race' as const, sourceRefId: BREADTH_IDS.race, level: null };
  const used = new Set<string>();
  const raceBuilt = [dex, cold, pull].map(t => buildTraitFeature(t, { ...raceOpts, usedIds: used }));
  const tidewalker: Race = {
    id: BREADTH_IDS.race, name: `Tidewalker ${DEMO}`,
    features: raceBuilt.flatMap(b => [b.feature, ...(b.extraFeatures ?? [])]),
    resources: raceBuilt.flatMap(b => [...(b.resource ? [b.resource] : []), ...(b.extraResources ?? [])]),
    size: 'Medium', speed: 30, languages: ['Common'],
  } as Race;

  // Subclass of an OFFICIAL class (fighter): level-3 passive, level-7 spell gift (→ dependency on Brine Ward)
  const stance = newDraftTrait('Undertow Stance');
  stance.effectKind = 'ac_bonus'; stance.acBonusAmount = '1'; stance.description = '+1 AC.';
  const gift = newDraftTrait('Brine Ward Gift');
  gift.effectKind = 'spell_grant'; gift.spellGrantAbility = 'wis';
  gift.spellGrants = [{
    localId: 'g1', spellId: BREADTH_IDS.spellB, spellName: brineWard.name, actionType: 'reaction',
    unlockLevel: '7', mode: 'resource', recharge: 'long_rest', rechargeOther: '', uses: '1', minSlotLevel: '2',
  }];
  gift.description = 'Cast Brine Ward (Demo) once per long rest.';
  const subclass: HomebrewSubclass = {
    id: asSubclassId(BREADTH_IDS.subclass), name: `Undertow Vanguard ${DEMO}`, classId: 'fighter',
    entries: subclassEntries(10, { 3: traitGrants(stance, BREADTH_IDS.subclass, 3), 7: traitGrants(gift, BREADTH_IDS.subclass, 7) }),
  };

  const study = newDraftTrait('Tide Study');
  study.effectKind = 'skill_proficiency'; study.skillTarget = 'survival'; study.description = 'Proficiency in Survival.';
  const feat: Feat = {
    id: BREADTH_IDS.feat, name: `Tide Reader ${DEMO}`, prerequisite: null, source: `${BP} (demo)`,
    description: `${note(BP)} Increase Wisdom or Constitution by 1 (your choice) and gain Survival proficiency.`,
    abilityChoice: { options: ['wis', 'con'], amount: 1 },
    feature: buildTraitFeature(study, { idPrefix: BREADTH_IDS.feat, sourceKind: 'feat', sourceRefId: BREADTH_IDS.feat, level: null }).feature,
  };

  const bucklePassive: Feature = {
    id: 'tidecaller_buckle_ward', name: 'Salt Ward', description: 'Resistance to fire damage while attuned.',
    source: { kind: 'item', refId: BREADTH_IDS.item }, level: null, passive: true, actions: [], choices: [],
    effects: [{ type: 'grant_resistance', target: 'fire', operation: 'resistance', value: null, condition: null }],
  };
  const buckle: Item = {
    id: BREADTH_IDS.item, name: `Tidecaller Buckle ${DEMO}`, weight: 1, cost: '-',
    properties: ['wondrous item', 'requires attunement', note(BP)], features: [bucklePassive],
  };

  const gillTrait = newDraftTrait('Waterlogged');
  gillTrait.effectKind = 'damage_resistance'; gillTrait.damageType = 'cold'; gillTrait.description = 'Resistance to cold damage.';
  const thrall: MonsterTemplate = {
    id: BREADTH_IDS.monster, name: `Tide Thrall ${DEMO}`, cr: 1, size: 'medium', type: 'elemental', alignment: 'neutral',
    stats: { str: 14, dex: 12, con: 14, int: 6, wis: 10, cha: 6 },
    hp: { dice: '4d8+8', average: 26 }, ac: { value: 12, source: 'natural' }, speed: 30,
    features: [buildTraitFeature(gillTrait, { idPrefix: BREADTH_IDS.monster, sourceKind: 'campaign', sourceRefId: BREADTH_IDS.monster, level: null }).feature],
    savingThrows: [], skills: {}, senses: [], languages: [],
  };

  return pack(
    { races: [tidewalker], subclasses: [subclass], feats: [feat], items: [buckle], monsters: [thrall], spells: [tidePull, brineWard] },
    [
      ref('race', tidewalker.id, tidewalker.name, 'selected'),
      ref('subclass', subclass.id, subclass.name, 'selected'),
      ref('feat', feat.id, feat.name, 'selected'),
      ref('item', buckle.id, buckle.name, 'selected'),
      ref('monster', thrall.id, thrall.name, 'selected'),
      ref('spell', tidePull.id, tidePull.name, 'dependency'),
      ref('spell', brineWard.id, brineWard.name, 'dependency'),
    ],
    {
      name: BP,
      description: 'TEST/DEMO ONLY. One species, one subclass, one feat, two spells, one item and one monster, all original, with two spell dependencies, to show the package workflow across content types.',
    },
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 2. STORMBOUND TEST PACK (Lee / This Crits!)
// ════════════════════════════════════════════════════════════════════════════
export const STORM_IDS = {
  feat: 'stormbound_feat_demo', spell: 'stormbound_bolt_demo', weapon: 'stormbound_spear_demo',
  monster: 'stormbound_hound_demo', condition: 'static_charged_demo',
} as const;
const SP = 'Stormbound Test Pack';

export function buildStormboundPack(): GrimoirePack {
  const staticTrait = newDraftTrait('Crackling Skin');
  staticTrait.effectKind = 'damage_vulnerability'; staticTrait.damageType = 'lightning';
  staticTrait.description = 'Vulnerable to lightning damage while charged.';
  const charged: Condition = {
    id: STORM_IDS.condition, name: `Static-Charged ${DEMO}`,
    description: `${note(SP)} Your skin crackles: you are vulnerable to lightning damage.`,
    features: [buildTraitFeature(staticTrait, { idPrefix: STORM_IDS.condition, sourceKind: 'condition', sourceRefId: STORM_IDS.condition, level: null }).feature],
  };

  const bolt: Spell = {
    id: STORM_IDS.spell, name: `Stormbound Bolt ${DEMO}`, level: 1, school: 'Evocation',
    castingTime: '1 action', range: '90 feet', components: ['V', 'S'], duration: 'Instantaneous',
    description: `${note(SP)} A bolt strikes a creature you can see: Dexterity save or 3d6 lightning damage (half on a success).`,
    upcast: 'Damage increases by 1d6 for each slot level above 1st.',
    ritual: false, concentration: false, classes: ['sorcerer', 'wizard'], spellType: ['damage'],
  };

  const ward = newDraftTrait('Stormward');
  ward.effectKind = 'damage_resistance'; ward.damageType = 'lightning'; ward.description = 'Resistance to lightning damage.';
  const feat: Feat = {
    id: STORM_IDS.feat, name: `Stormbound ${DEMO}`, prerequisite: null, source: `${SP} (demo)`,
    description: `${note(SP)} Gain resistance to lightning damage.`,
    feature: buildTraitFeature(ward, { idPrefix: STORM_IDS.feat, sourceKind: 'feat', sourceRefId: STORM_IDS.feat, level: null }).feature,
  };

  const spearHit: Feature = {
    id: 'stormbound_spear_strike', name: 'Stormbound Strike', description: 'Weapon attack; on a hit the target becomes Static-Charged for 2 rounds.',
    source: { kind: 'item', refId: STORM_IDS.weapon }, level: null, passive: false, actions: [], choices: [], effects: [],
    activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
    abilityEffects: [
      { type: 'damage', dice: '1d8', damageType: 'piercing' },
      { type: 'damage', dice: '1d6', damageType: 'lightning' },
      { type: 'apply_condition', conditionId: STORM_IDS.condition, duration: { unit: 'rounds', remaining: 2 } },
    ],
  };
  const spear: Item = {
    id: STORM_IDS.weapon, name: `Stormbound Spear ${DEMO}`, weight: 3, cost: '-',
    properties: ['martial', 'melee', 'thrown', 'versatile', note(SP)], features: [spearHit],
  };

  const houndMark: Feature = {
    id: 'stormbound_hound_bite', name: 'Charged Bite', description: 'Action: bite; the target becomes Static-Charged for 2 rounds (Con save DC 12).',
    source: { kind: 'campaign', refId: STORM_IDS.monster }, level: null, passive: false, actions: [], choices: [], effects: [],
    activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: { ability: 'con', dc: 12 } },
    abilityEffects: [
      { type: 'damage', dice: '1d8', damageType: 'lightning' },
      { type: 'apply_condition', conditionId: STORM_IDS.condition, duration: { unit: 'rounds', remaining: 2 } },
    ],
  };
  const immune = newDraftTrait('Storm Hide');
  immune.effectKind = 'damage_immunity'; immune.damageType = 'lightning'; immune.description = 'Immune to lightning damage.';
  const hound: MonsterTemplate = {
    id: STORM_IDS.monster, name: `Stormbound Hound ${DEMO}`, cr: 1, size: 'medium', type: 'monstrosity', alignment: 'unaligned',
    stats: { str: 14, dex: 14, con: 12, int: 3, wis: 12, cha: 6 },
    hp: { dice: '4d8+4', average: 22 }, ac: { value: 13, source: 'natural' }, speed: 40,
    features: [buildTraitFeature(immune, { idPrefix: STORM_IDS.monster, sourceKind: 'campaign', sourceRefId: STORM_IDS.monster, level: null }).feature, houndMark],
    savingThrows: [], skills: {}, senses: ['darkvision 60 ft'], languages: [],
  };

  return pack(
    { feats: [feat], spells: [bolt], items: [spear], monsters: [hound], conditions: [charged] },
    [
      ref('feat', feat.id, feat.name, 'selected'),
      ref('spell', bolt.id, bolt.name, 'selected'),
      ref('item', spear.id, spear.name, 'selected'),
      ref('monster', hound.id, hound.name, 'selected'),
      ref('condition', charged.id, charged.name, 'dependency'),
    ],
    {
      name: SP,
      description: 'TEST/DEMO ONLY. A feat, a spell, a weapon, a creature and a condition sharing one storm theme, where the weapon and creature both depend on the condition, to show several content types working in one ecosystem.',
    },
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 3. UNDERSTUDY TEST PACK (DM V — the "awkward character concept" sample)
// ════════════════════════════════════════════════════════════════════════════
// Concept: a performer who never plays themself. They carry a small pool of
// "Borrowed Roles", get a custom multi-level progression, a passive defensive
// modifier, an active ability that puts a condition on a target, and a
// condition that has a real mechanical drawback.
export const UNDERSTUDY_IDS = { subclass: 'understudy_demo', condition: 'spotlit_demo' } as const;
const UP = 'Understudy Test Pack';

export function buildUnderstudyPack(): GrimoirePack {
  const spotTrait = newDraftTrait('In the Spotlight');
  spotTrait.effectKind = 'advantage_disadvantage'; spotTrait.advDirection = 'disadvantage'; spotTrait.advTarget = 'stealth';
  spotTrait.description = 'Disadvantage on Stealth checks while lit by the spotlight.';
  const spotlit: Condition = {
    id: UNDERSTUDY_IDS.condition, name: `Spotlit ${DEMO}`,
    description: `${note(UP)} You can't hide while the spotlight is on you: disadvantage on Stealth.`,
    features: [buildTraitFeature(spotTrait, { idPrefix: UNDERSTUDY_IDS.condition, sourceKind: 'condition', sourceRefId: UNDERSTUDY_IDS.condition, level: null }).feature],
  };

  const sid = UNDERSTUDY_IDS.subclass;
  // L3: the unusual resource (3 Borrowed Roles per long rest) + a passive modifier
  const roles = newDraftTrait('Borrowed Roles');
  roles.effectKind = 'resource_ability'; roles.actionType = 'bonus_action'; roles.recharge = 'long_rest'; roles.uses = '3';
  roles.description = 'Bonus action: step into a borrowed role. You have 3 uses per long rest.';
  const costume = newDraftTrait('Costume Guard');
  costume.effectKind = 'ac_bonus'; costume.acBonusAmount = '1'; costume.description = '+1 AC. The costume is sturdier than it looks.';
  // L6: an active ability that applies a condition to a target
  const cue: Feature = {
    id: `${sid}_l6_cue_the_spotlight`, name: 'Cue the Spotlight',
    description: 'Action: throw the spotlight on a creature within 30 feet for 3 rounds (applies Spotlit).',
    source: { kind: 'subclass', refId: sid }, level: 6, passive: false, actions: [], choices: [], effects: [],
    activation: { actionType: 'action', resourceCost: null, range: '30 feet', target: 'single', requiresSave: { ability: 'wis', dc: 13 } },
    abilityEffects: [{ type: 'apply_condition', conditionId: UNDERSTUDY_IDS.condition, duration: { unit: 'rounds', remaining: 3 } }],
  };
  // L10: a second passive with a different flavour of effect
  const nerves = newDraftTrait('Steady Nerves');
  nerves.effectKind = 'damage_resistance'; nerves.damageType = 'psychic'; nerves.description = 'Resistance to psychic damage.';

  const subclass: HomebrewSubclass = {
    id: asSubclassId(sid), name: `The Understudy ${DEMO}`, classId: 'bard',
    entries: subclassEntries(8, {
      3:  [...traitGrants(roles, sid, 3), ...traitGrants(costume, sid, 3)],
      6:  [{ kind: 'feature', value: cue }],
      10: traitGrants(nerves, sid, 10),
    }),
  };

  return pack(
    { subclasses: [subclass], conditions: [spotlit] },
    [
      ref('subclass', subclass.id, subclass.name, 'selected'),
      ref('condition', spotlit.id, spotlit.name, 'dependency'),
    ],
    {
      name: UP,
      description: 'TEST/DEMO ONLY. One deliberately awkward original character concept: a limited "Borrowed Roles" resource, a three-stage custom progression, a passive AC modifier, an active ability that applies a condition, and that condition, packaged so you can see what a pack feels like.',
    },
  );
}
