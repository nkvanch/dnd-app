// demo/aster-test-pack/asterTestPack.ts
// ORIGINAL, TEST/DEMO-ONLY homebrew dataset ("Aster Test Pack") used for
// screenshots, demo recordings and outreach. NOT part of the app bundle:
// nothing under app/ or src/ imports this file, so Metro never ships it. It
// reaches a device only as a separate .grimoire-pack import file (see
// build.ts) — the same import path any creator's pack uses.
//
// Everything is built through the app's OWN trait compiler
// (src/content/traitCompiler.ts — what the homebrew builders call) and its
// own pack constructor, so the dataset exercises the real engine rather
// than a hand-faked shape. Nothing here uses third-party content.
import { newDraftTrait, buildTraitFeature } from '../../src/content/traitCompiler';
import { createPackageContentPack, GrimoirePack, PackageContentRef } from '../../src/engine/backup';
import type { Race, Feat, Item, Spell, Condition, Feature } from '../../src/engine/types';
import type { MonsterTemplate } from '../../src/content/monsters/types';

const DEMO = '(Demo)';
const DEMO_NOTE = 'TEST/DEMO CONTENT, part of the Aster Test Pack. Not for play.';

export const ASTER_IDS = {
  spell:     'aster_lance_demo',
  condition: 'star_marked_demo',
  race:      'aster_touched_demo',
  feat:      'aster_focus_demo',
  item:      'aster_lantern_demo',
  monster:   'aster_wisp_demo',
} as const;

// ── Spell (a dependency of the race AND the item) ───────────────────────────
const asterLance: Spell = {
  id: ASTER_IDS.spell, name: `Aster Lance ${DEMO}`, level: 1, school: 'Evocation',
  castingTime: '1 action', range: '60 feet', components: ['V', 'S'], duration: 'Instantaneous',
  description: `${DEMO_NOTE} A beam of starlight strikes a creature you can see: it makes a Dexterity save or takes 2d6 radiant damage (half on a success).`,
  upcast: 'Damage increases by 1d6 for each slot level above 1st.',
  ritual: false, concentration: false, classes: ['wizard', 'sorcerer'], spellType: ['damage'],
};

// ── Condition (a dependency of the item and the monster) ────────────────────
const starMarkedTrait = newDraftTrait('Starlit Outline');
starMarkedTrait.effectKind = 'ac_bonus';
starMarkedTrait.acBonusAmount = '-1';
starMarkedTrait.description = 'A faint star-shaped outline makes you easier to hit: -1 AC while marked.';
const starMarked: Condition = {
  id: ASTER_IDS.condition, name: `Star-Marked ${DEMO}`,
  description: `${DEMO_NOTE} You are outlined in starlight: -1 AC.`,
  features: [buildTraitFeature(starMarkedTrait, {
    idPrefix: ASTER_IDS.condition, sourceKind: 'condition', sourceRefId: ASTER_IDS.condition, level: null,
  }).feature],
};

// ── Race: a custom character option with a mechanical modifier, a sense, a
//    limited resource, and an at-will spell grant (→ spell dependency) ───────
const ability = newDraftTrait('Aster Resilience');
ability.effectKind = 'ability_score'; ability.abilityTarget = 'con'; ability.abilityAmount = '1';
ability.description = '+1 Constitution.';

const sense = newDraftTrait('Starsight');
sense.effectKind = 'sense'; sense.senseType = 'darkvision'; sense.senseRange = '60';
sense.description = 'Darkvision 60 ft.';

const pulse = newDraftTrait('Starlit Pulse');
pulse.effectKind = 'resource_ability'; pulse.actionType = 'bonus_action';
pulse.recharge = 'short_rest'; pulse.uses = '2'; pulse.healDice = '1d6';
pulse.description = 'Bonus action: heal 1d6. 2 uses per short rest.';

const lanceGrant = newDraftTrait('Aster Lance Gift');
lanceGrant.effectKind = 'spell_grant'; lanceGrant.spellGrantAbility = 'cha';
lanceGrant.spellGrants = [{
  localId: 'g1', spellId: ASTER_IDS.spell, spellName: asterLance.name, actionType: 'action',
  unlockLevel: '1', mode: 'resource', recharge: 'long_rest', rechargeOther: '', uses: '1', minSlotLevel: '1',
}];
lanceGrant.description = 'Cast Aster Lance (Demo) once per long rest.';

const raceOpts = { idPrefix: ASTER_IDS.race, sourceKind: 'race' as const, sourceRefId: ASTER_IDS.race, level: null };
const usedRaceIds = new Set<string>();
const raceBuilt = [ability, sense, pulse, lanceGrant].map(t => buildTraitFeature(t, { ...raceOpts, usedIds: usedRaceIds }));
const asterTouched: Race = {
  id: ASTER_IDS.race, name: `Aster-Touched ${DEMO}`,
  features: raceBuilt.flatMap(b => [b.feature, ...(b.extraFeatures ?? [])]),
  resources: raceBuilt.flatMap(b => [...(b.resource ? [b.resource] : []), ...(b.extraResources ?? [])]),
  size: 'Medium', speed: 30, languages: ['Common'],
} as Race;

// ── Feat: a structured choice (which ability) plus a skill proficiency ──────
const arcana = newDraftTrait('Aster Study');
arcana.effectKind = 'skill_proficiency'; arcana.skillTarget = 'arcana';
arcana.description = 'Proficiency in Arcana.';
const feat: Feat = {
  id: ASTER_IDS.feat, name: `Aster Focus ${DEMO}`, prerequisite: null, source: 'Aster Test Pack (demo)',
  description: `${DEMO_NOTE} Increase Intelligence, Wisdom or Charisma by 1 (your choice) and gain Arcana proficiency.`,
  abilityChoice: { options: ['int', 'wis', 'cha'], amount: 1 },
  feature: buildTraitFeature(arcana, { idPrefix: ASTER_IDS.feat, sourceKind: 'feat', sourceRefId: ASTER_IDS.feat, level: null }).feature,
};

// ── Item: a passive modifier + an active ability that applies the condition ─
const lanternPassive: Feature = {
  id: 'aster_lantern_ward', name: 'Lantern Ward', description: '+1 AC while the lantern is attuned.',
  source: { kind: 'item', refId: ASTER_IDS.item }, level: null, passive: true, actions: [], choices: [],
  effects: [{ type: 'stat_modifier', target: 'ac', operation: 'add', value: 1, condition: null }],
};
const lanternFlash: Feature = {
  id: 'aster_lantern_flash', name: 'Starflash', description: 'Action: mark a creature with starlight for 3 rounds (applies Star-Marked).',
  source: { kind: 'item', refId: ASTER_IDS.item }, level: null, passive: false, actions: [], choices: [], effects: [],
  activation: { actionType: 'action', resourceCost: null, range: '30 feet', target: 'single', requiresSave: null },
  abilityEffects: [{ type: 'apply_condition', conditionId: ASTER_IDS.condition, duration: { unit: 'rounds', remaining: 3 } }],
};
const lantern: Item = {
  id: ASTER_IDS.item, name: `Aster Lantern ${DEMO}`, weight: 2, cost: '-',
  properties: ['wondrous item', 'requires attunement', DEMO_NOTE],
  features: [lanternPassive, lanternFlash],
};

// ── Monster: an original creature that also depends on the condition ────────
const wispTrait = newDraftTrait('Flickering Light');
wispTrait.effectKind = 'sense'; wispTrait.senseType = 'darkvision'; wispTrait.senseRange = '120';
wispTrait.description = 'Darkvision 120 ft.';
const wispMark: Feature = {
  id: 'aster_wisp_mark', name: 'Star Mark', description: 'Action: mark a creature (Star-Marked) for 2 rounds.',
  source: { kind: 'campaign', refId: ASTER_IDS.monster }, level: null, passive: false, actions: [], choices: [], effects: [],
  activation: { actionType: 'action', resourceCost: null, range: '30 feet', target: 'single', requiresSave: { ability: 'wis', dc: 12 } },
  abilityEffects: [{ type: 'apply_condition', conditionId: ASTER_IDS.condition, duration: { unit: 'rounds', remaining: 2 } }],
};
const wisp: MonsterTemplate = {
  id: ASTER_IDS.monster, name: `Aster Wisp ${DEMO}`, cr: 0.25, size: 'tiny', type: 'elemental', alignment: 'unaligned',
  stats: { str: 3, dex: 16, con: 10, int: 8, wis: 12, cha: 10 },
  hp: { dice: '3d4', average: 8 }, ac: { value: 13, source: 'natural' }, speed: 0,
  features: [buildTraitFeature(wispTrait, { idPrefix: ASTER_IDS.monster, sourceKind: 'campaign', sourceRefId: ASTER_IDS.monster, level: null }).feature, wispMark],
  savingThrows: [], skills: {}, senses: ['darkvision 120 ft'], languages: [],
};

export function buildAsterTestPack(): GrimoirePack {
  const contents: PackageContentRef[] = [
    { type: 'race',      id: ASTER_IDS.race,      name: asterTouched.name, included: 'selected' },
    { type: 'feat',      id: ASTER_IDS.feat,      name: feat.name,         included: 'selected' },
    { type: 'item',      id: ASTER_IDS.item,      name: lantern.name,      included: 'selected' },
    { type: 'monster',   id: ASTER_IDS.monster,   name: wisp.name,         included: 'selected' },
    { type: 'spell',     id: ASTER_IDS.spell,     name: asterLance.name,   included: 'dependency' },
    { type: 'condition', id: ASTER_IDS.condition, name: starMarked.name,   included: 'dependency' },
  ];
  return createPackageContentPack(
    { races: [asterTouched], feats: [feat], items: [lantern], monsters: [wisp], spells: [asterLance], conditions: [starMarked] },
    contents,
    {
      name: 'Aster Test Pack', author: 'Grimoire (original demo content)', packageVersion: '1.0',
      description: 'TEST/DEMO ONLY. Original mini-dataset that exercises species traits, a structured feat choice, a limited resource, an item with an attunement bonus and an active ability, a condition, a spell and a monster, with cross-content dependencies.',
    },
    null, '1.0.0',
  );
}
