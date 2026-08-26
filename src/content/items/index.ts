// ============================================================================
// FILE: src/content/items/index.ts
// Standard weapons, armor, and adventuring gear.
// ============================================================================
import { Item } from '../../engine/types';
import { IMPORTED_ITEMS } from './importedItems';
import importedSrdClassification from './srdClassification.json';
import { ContentRegistry } from '../ContentRegistry';

// ── Simple Melee Weapons ──────────────────────────────────────────────────────

export const itemDagger: Item = {
  id: 'dagger', name: 'Dagger', weight: 1, cost: '2 gp',
  properties: ['finesse', 'light', 'thrown (range 20/60)'],
  features: [{
    id: 'dagger_attack', name: 'Dagger', description: 'Melee or ranged weapon attack.',
    source: { kind: 'item', refId: 'dagger' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d4', damageType: 'piercing' }],
  }],
};

export const itemHandaxe: Item = {
  id: 'handaxe', name: 'Handaxe', weight: 2, cost: '5 gp',
  properties: ['light', 'thrown (range 20/60)'],
  features: [{
    id: 'handaxe_attack', name: 'Handaxe', description: 'Melee or ranged weapon attack.',
    source: { kind: 'item', refId: 'handaxe' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d6', damageType: 'slashing' }],
  }],
};

export const itemClub: Item = {
  id: 'club', name: 'Club', weight: 2, cost: '1 sp',
  properties: ['light'],
  features: [{
    id: 'club_attack', name: 'Club', description: 'Melee weapon attack.',
    source: { kind: 'item', refId: 'club' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d4', damageType: 'bludgeoning' }],
  }],
};

export const itemGreatclub: Item = {
  id: 'greatclub', name: 'Greatclub', weight: 10, cost: '2 sp',
  properties: ['two-handed'],
  features: [{
    id: 'greatclub_attack', name: 'Greatclub', description: 'Melee weapon attack.',
    source: { kind: 'item', refId: 'greatclub' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'bludgeoning' }],
  }],
};

export const itemLightHammer: Item = {
  id: 'light_hammer', name: 'Light Hammer', weight: 2, cost: '2 gp',
  properties: ['light', 'thrown (range 20/60)'],
  features: [{
    id: 'light_hammer_attack', name: 'Light Hammer', description: 'Melee or ranged weapon attack.',
    source: { kind: 'item', refId: 'light_hammer' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d4', damageType: 'bludgeoning' }],
  }],
};

export const itemSickle: Item = {
  id: 'sickle', name: 'Sickle', weight: 2, cost: '1 gp',
  properties: ['light'],
  features: [{
    id: 'sickle_attack', name: 'Sickle', description: 'Melee weapon attack.',
    source: { kind: 'item', refId: 'sickle' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d4', damageType: 'slashing' }],
  }],
};

export const itemQuarterstaff: Item = {
  id: 'quarterstaff', name: 'Quarterstaff', weight: 4, cost: '2 sp',
  properties: ['versatile (1d8)'],
  features: [{
    id: 'quarterstaff_attack', name: 'Quarterstaff', description: 'Melee weapon attack.',
    source: { kind: 'item', refId: 'quarterstaff' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d6', damageType: 'bludgeoning' }],
  }],
};

export const itemJavelin: Item = {
  id: 'javelin', name: 'Javelin', weight: 2, cost: '5 sp',
  properties: ['thrown (range 30/120)'],
  features: [{
    id: 'javelin_attack', name: 'Javelin', description: 'Melee or ranged weapon attack.',
    source: { kind: 'item', refId: 'javelin' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '30 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d6', damageType: 'piercing' }],
  }],
};

export const itemSpear: Item = {
  id: 'spear', name: 'Spear', weight: 3, cost: '1 gp',
  properties: ['thrown (range 20/60)', 'versatile (1d8)'],
  features: [{
    id: 'spear_attack', name: 'Spear', description: 'Melee or ranged weapon attack.',
    source: { kind: 'item', refId: 'spear' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d6', damageType: 'piercing' }],
  }],
};

export const itemMace: Item = {
  id: 'mace', name: 'Mace', weight: 4, cost: '5 gp',
  properties: [],
  features: [{
    id: 'mace_attack', name: 'Mace', description: 'Melee weapon attack.',
    source: { kind: 'item', refId: 'mace' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d6', damageType: 'bludgeoning' }],
  }],
};

// ── Simple Ranged Weapons ─────────────────────────────────────────────────────

export const itemDart: Item = {
  id: 'dart', name: 'Dart', weight: 0.25, cost: '5 cp',
  properties: ['finesse', 'thrown (range 20/60)'],
  features: [{
    id: 'dart_attack', name: 'Dart', description: 'Ranged weapon attack.',
    source: { kind: 'item', refId: 'dart' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '20 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d4', damageType: 'piercing' }],
  }],
};

export const itemShortbow: Item = {
  id: 'shortbow', name: 'Shortbow', weight: 2, cost: '25 gp',
  properties: ['ammunition (range 80/320)', 'two-handed'],
  features: [{
    id: 'shortbow_attack', name: 'Shortbow', description: 'Ranged weapon attack.',
    source: { kind: 'item', refId: 'shortbow' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '80 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d6', damageType: 'piercing' }],
  }],
};

export const itemSling: Item = {
  id: 'sling', name: 'Sling', weight: 0, cost: '1 sp',
  properties: ['ammunition (range 30/120)'],
  features: [{
    id: 'sling_attack', name: 'Sling', description: 'Ranged weapon attack.',
    source: { kind: 'item', refId: 'sling' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '30 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d4', damageType: 'bludgeoning' }],
  }],
};

export const itemLightCrossbow: Item = {
  id: 'light_crossbow', name: 'Light Crossbow', weight: 5, cost: '25 gp',
  properties: ['ammunition (range 80/320)', 'loading', 'two-handed'],
  features: [{
    id: 'light_crossbow_attack', name: 'Light Crossbow', description: 'Ranged weapon attack.',
    source: { kind: 'item', refId: 'light_crossbow' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '80 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'piercing' }],
  }],
};

// ── Martial Melee Weapons ─────────────────────────────────────────────────────

export const itemFlail: Item = {
  id: 'flail', name: 'Flail', weight: 2, cost: '10 gp',
  properties: [],
  features: [{
    id: 'flail_attack', name: 'Flail', description: 'Melee weapon attack.',
    source: { kind: 'item', refId: 'flail' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'bludgeoning' }],
  }],
};

export const itemGlaive: Item = {
  id: 'glaive', name: 'Glaive', weight: 6, cost: '20 gp',
  properties: ['heavy', 'reach', 'two-handed'],
  features: [{
    id: 'glaive_attack', name: 'Glaive', description: 'Melee weapon attack. Reach 10 feet.',
    source: { kind: 'item', refId: 'glaive' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '10 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d10', damageType: 'slashing' }],
  }],
};

export const itemHalberd: Item = {
  id: 'halberd', name: 'Halberd', weight: 6, cost: '20 gp',
  properties: ['heavy', 'reach', 'two-handed'],
  features: [{
    id: 'halberd_attack', name: 'Halberd', description: 'Melee weapon attack. Reach 10 feet.',
    source: { kind: 'item', refId: 'halberd' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '10 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d10', damageType: 'slashing' }],
  }],
};

export const itemLance: Item = {
  id: 'lance', name: 'Lance', weight: 6, cost: '10 gp',
  properties: ['reach', 'special (disadvantage within 5 ft)'],
  features: [{
    id: 'lance_attack', name: 'Lance', description: 'Melee weapon attack. Reach 10 feet. Disadvantage when used against targets within 5 feet.',
    source: { kind: 'item', refId: 'lance' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '10 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d12', damageType: 'piercing' }],
  }],
};

export const itemMorningstar: Item = {
  id: 'morningstar', name: 'Morningstar', weight: 4, cost: '15 gp',
  properties: [],
  features: [{
    id: 'morningstar_attack', name: 'Morningstar', description: 'Melee weapon attack.',
    source: { kind: 'item', refId: 'morningstar' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'piercing' }],
  }],
};

export const itemPike: Item = {
  id: 'pike', name: 'Pike', weight: 18, cost: '5 gp',
  properties: ['heavy', 'reach', 'two-handed'],
  features: [{
    id: 'pike_attack', name: 'Pike', description: 'Melee weapon attack. Reach 10 feet.',
    source: { kind: 'item', refId: 'pike' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '10 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d10', damageType: 'piercing' }],
  }],
};

export const itemTrident: Item = {
  id: 'trident', name: 'Trident', weight: 4, cost: '5 gp',
  properties: ['thrown (range 20/60)', 'versatile (1d8)'],
  features: [{
    id: 'trident_attack', name: 'Trident', description: 'Melee or ranged weapon attack.',
    source: { kind: 'item', refId: 'trident' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d6', damageType: 'piercing' }],
  }],
};

export const itemWarPick: Item = {
  id: 'war_pick', name: 'War Pick', weight: 2, cost: '5 gp',
  properties: [],
  features: [{
    id: 'war_pick_attack', name: 'War Pick', description: 'Melee weapon attack.',
    source: { kind: 'item', refId: 'war_pick' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'piercing' }],
  }],
};

export const itemWhip: Item = {
  id: 'whip', name: 'Whip', weight: 3, cost: '2 gp',
  properties: ['finesse', 'reach'],
  features: [{
    id: 'whip_attack', name: 'Whip', description: 'Melee weapon attack. Reach 10 feet.',
    source: { kind: 'item', refId: 'whip' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '10 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d4', damageType: 'slashing' }],
  }],
};

export const itemLongsword: Item = {
  id: 'longsword', name: 'Longsword', weight: 3, cost: '15 gp',
  properties: ['versatile (1d10)'],
  features: [{
    id: 'longsword_attack', name: 'Longsword', description: 'Melee weapon attack.',
    source: { kind: 'item', refId: 'longsword' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'slashing' }],
  }],
};

export const itemBattleaxe: Item = {
  id: 'battleaxe', name: 'Battleaxe', weight: 4, cost: '10 gp',
  properties: ['versatile (1d10)'],
  features: [{
    id: 'battleaxe_attack', name: 'Battleaxe', description: 'Melee weapon attack.',
    source: { kind: 'item', refId: 'battleaxe' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'slashing' }],
  }],
};

export const itemGreatsword: Item = {
  id: 'greatsword', name: 'Greatsword', weight: 6, cost: '50 gp',
  properties: ['heavy', 'two-handed'],
  features: [{
    id: 'greatsword_attack', name: 'Greatsword', description: 'Melee weapon attack.',
    source: { kind: 'item', refId: 'greatsword' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '2d6', damageType: 'slashing' }],
  }],
};

export const itemGreatswordLifeDrinking: Item = {
  id: 'greatsword_life_drinking', name: '+1 Life-Drinking Greatsword', weight: 6, cost: '—',
  properties: [
    'heavy', 'magic weapon', '+1 to attack and damage rolls',
    'two-handed (one-handed for Large creatures)',
  ],
  features: [
    {
      id: 'greatsword_life_drinking_attack',
      name: '+1 Life-Drinking Greatsword',
      description:
        'Melee weapon attack (+1 bonus to attack and damage rolls). Deals 2d8 slashing damage ' +
        '(oversized damage die for Large creatures; base 2d6 for Medium). ' +
        'Life Drain: on a hit, roll 3d6 — deal that as additional necrotic damage, then heal ' +
        'yourself for the same value (up to your maximum HP). Roll the 3d6 once and apply it to both.',
      source: { kind: 'item', refId: 'greatsword_life_drinking' },
      level: null, actions: [], choices: [], effects: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [
        { type: 'damage', dice: '2d8', damageType: 'slashing' },
        { type: 'damage', dice: '3d6', damageType: 'necrotic' },
        { type: 'heal',   dice: '3d6' },
      ],
    },
  ],
};

export const itemRopeOfMending: Item = {
  id: 'rope_of_mending', name: 'Rope of Mending', weight: 3, cost: '—',
  properties: ['magic item', '50 feet'],
  features: [{
    id: 'rope_of_mending_use', name: 'Rope of Mending',
    description: 'A 50-foot coil of fine, silken rope. Lay a length of it across a tear or break — in cloth, wood, rope, stone, or even a wound-worthy seam — and after one minute the material knits back together as if it had never been damaged. The rope itself never frays and can be used again and again.',
    source: { kind: 'item', refId: 'rope_of_mending' }, level: null, effects: [], actions: [], choices: [], passive: true,
  }],
};

export const itemGreataxe: Item = {
  id: 'greataxe', name: 'Greataxe', weight: 7, cost: '30 gp',
  properties: ['heavy', 'two-handed'],
  features: [{
    id: 'greataxe_attack', name: 'Greataxe', description: 'Melee weapon attack.',
    source: { kind: 'item', refId: 'greataxe' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d12', damageType: 'slashing' }],
  }],
};

export const itemScimitar: Item = {
  id: 'scimitar', name: 'Scimitar', weight: 3, cost: '25 gp',
  properties: ['finesse', 'light'],
  features: [{
    id: 'scimitar_attack', name: 'Scimitar', description: 'Melee weapon attack.',
    source: { kind: 'item', refId: 'scimitar' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d6', damageType: 'slashing' }],
  }],
};

export const itemRapier: Item = {
  id: 'rapier', name: 'Rapier', weight: 2, cost: '25 gp',
  properties: ['finesse'],
  features: [{
    id: 'rapier_attack', name: 'Rapier', description: 'Melee weapon attack.',
    source: { kind: 'item', refId: 'rapier' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'piercing' }],
  }],
};

export const itemWarhammer: Item = {
  id: 'warhammer', name: 'Warhammer', weight: 2, cost: '15 gp',
  properties: ['versatile (1d10)'],
  features: [{
    id: 'warhammer_attack', name: 'Warhammer', description: 'Melee weapon attack.',
    source: { kind: 'item', refId: 'warhammer' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'bludgeoning' }],
  }],
};

export const itemMaul: Item = {
  id: 'maul', name: 'Maul', weight: 10, cost: '10 gp',
  properties: ['heavy', 'two-handed'],
  features: [{
    id: 'maul_attack', name: 'Maul', description: 'Melee weapon attack.',
    source: { kind: 'item', refId: 'maul' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '2d6', damageType: 'bludgeoning' }],
  }],
};

export const itemShortSword: Item = {
  id: 'shortsword', name: 'Shortsword', weight: 2, cost: '10 gp',
  properties: ['finesse', 'light'],
  features: [{
    id: 'shortsword_attack', name: 'Shortsword', description: 'Melee weapon attack.',
    source: { kind: 'item', refId: 'shortsword' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d6', damageType: 'piercing' }],
  }],
};

// ── Martial Ranged Weapons ────────────────────────────────────────────────────

export const itemLongbow: Item = {
  id: 'longbow', name: 'Longbow', weight: 2, cost: '50 gp',
  properties: ['ammunition (range 150/600)', 'heavy', 'two-handed'],
  features: [{
    id: 'longbow_attack', name: 'Longbow', description: 'Ranged weapon attack.',
    source: { kind: 'item', refId: 'longbow' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '150 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'piercing' }],
  }],
};

export const itemHeavyCrossbow: Item = {
  id: 'heavy_crossbow', name: 'Heavy Crossbow', weight: 18, cost: '50 gp',
  properties: ['ammunition (range 100/400)', 'heavy', 'loading', 'two-handed'],
  features: [{
    id: 'heavy_crossbow_attack', name: 'Heavy Crossbow', description: 'Ranged weapon attack.',
    source: { kind: 'item', refId: 'heavy_crossbow' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '100 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d10', damageType: 'piercing' }],
  }],
};

export const itemBlowgun: Item = {
  id: 'blowgun', name: 'Blowgun', weight: 1, cost: '10 gp',
  properties: ['ammunition (range 25/100)', 'loading'],
  features: [{
    id: 'blowgun_attack', name: 'Blowgun', description: 'Ranged weapon attack.',
    source: { kind: 'item', refId: 'blowgun' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '25 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d1', damageType: 'piercing' }],
  }],
};

export const itemNet: Item = {
  id: 'net', name: 'Net', weight: 3, cost: '1 gp',
  properties: ['special', 'thrown (range 5/15)'],
  features: [{
    id: 'net_attack', name: 'Net', description: 'Ranged weapon attack. On a hit, a Large or smaller creature is restrained. DC 10 Strength check to escape.',
    source: { kind: 'item', refId: 'net' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
    abilityEffects: [],
  }],
};

export const itemHandCrossbow: Item = {
  id: 'hand_crossbow', name: 'Hand Crossbow', weight: 3, cost: '75 gp',
  properties: ['ammunition (range 30/120)', 'light', 'loading'],
  features: [{
    id: 'hand_crossbow_attack', name: 'Hand Crossbow', description: 'Ranged weapon attack.',
    source: { kind: 'item', refId: 'hand_crossbow' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '30 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d6', damageType: 'piercing' }],
  }],
};

// ── Light Armor ───────────────────────────────────────────────────────────────

export const itemLeatherArmor: Item = {
  id: 'leather_armor', name: 'Leather Armor', weight: 10, cost: '10 gp',
  properties: ['light armor'],
  features: [{
    id: 'leather_armor_ac', name: 'Leather Armor', description: 'Base AC 11 + DEX modifier.',
    source: { kind: 'item', refId: 'leather_armor' }, level: null, actions: [], choices: [], passive: true,
    effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 11, condition: null, formulaAbilities: ['dex'] as any }],
  }],
};

export const itemStuddedLeather: Item = {
  id: 'studded_leather', name: 'Studded Leather', weight: 13, cost: '45 gp',
  properties: ['light armor'],
  features: [{
    id: 'studded_leather_ac', name: 'Studded Leather', description: 'Base AC 12 + DEX modifier.',
    source: { kind: 'item', refId: 'studded_leather' }, level: null, actions: [], choices: [], passive: true,
    effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 12, condition: null, formulaAbilities: ['dex'] as any }],
  }],
};

// ── Medium Armor ──────────────────────────────────────────────────────────────
// Medium armor: base + DEX (max +2). The pipeline takes formulaAbilities mods
// uncapped; for medium armor correctness the DEX cap would need pipeline support.
// For now we express as base_ac_formula with DEX so equipping any medium armor
// at least shows the correct base and adds DEX. Cap enforcement is a TODO.

export const itemChainShirt: Item = {
  id: 'chain_shirt', name: 'Chain Shirt', weight: 20, cost: '50 gp',
  properties: ['medium armor'],
  features: [{
    id: 'chain_shirt_ac', name: 'Chain Shirt', description: 'Base AC 13 + DEX modifier (max +2).',
    source: { kind: 'item', refId: 'chain_shirt' }, level: null, actions: [], choices: [], passive: true,
    effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 13, condition: null, formulaAbilities: ['dex'] as any, formulaAbilityCap: { dex: 2 } }],
  }],
};

export const itemScaleMail: Item = {
  id: 'scale_mail', name: 'Scale Mail', weight: 45, cost: '50 gp',
  properties: ['medium armor', 'disadvantage on stealth'],
  features: [{
    id: 'scale_mail_ac', name: 'Scale Mail', description: 'Base AC 14 + DEX modifier (max +2).',
    source: { kind: 'item', refId: 'scale_mail' }, level: null, actions: [], choices: [], passive: true,
    effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 14, condition: null, formulaAbilities: ['dex'] as any, formulaAbilityCap: { dex: 2 } }],
  }],
};

export const itemBreastplate: Item = {
  id: 'breastplate', name: 'Breastplate', weight: 20, cost: '400 gp',
  properties: ['medium armor'],
  features: [{
    id: 'breastplate_ac', name: 'Breastplate', description: 'Base AC 14 + DEX modifier (max +2).',
    source: { kind: 'item', refId: 'breastplate' }, level: null, actions: [], choices: [], passive: true,
    effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 14, condition: null, formulaAbilities: ['dex'] as any, formulaAbilityCap: { dex: 2 } }],
  }],
};

export const itemCastOffBreastplate: Item = {
  id: 'cast_off_breastplate', name: 'Cast-Off Breastplate', weight: 20, cost: '—',
  properties: ['medium armor'],
  features: [{
    id: 'cast_off_breastplate_ac', name: 'Cast-Off Breastplate',
    description: 'A breastplate hammered down and refitted from plate cast off by a creature far larger than its current wearer — the seams still bear the marks of the reforging. Base AC 14 + DEX modifier (max +2).',
    source: { kind: 'item', refId: 'cast_off_breastplate' }, level: null, actions: [], choices: [], passive: true,
    effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 14, condition: null, formulaAbilities: ['dex'] as any, formulaAbilityCap: { dex: 2 } }],
  }],
};

export const itemHalfPlate: Item = {
  id: 'half_plate', name: 'Half Plate', weight: 40, cost: '750 gp',
  properties: ['medium armor', 'disadvantage on stealth'],
  features: [{
    id: 'half_plate_ac', name: 'Half Plate', description: 'Base AC 15 + DEX modifier (max +2).',
    source: { kind: 'item', refId: 'half_plate' }, level: null, actions: [], choices: [], passive: true,
    effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 15, condition: null, formulaAbilities: ['dex'] as any, formulaAbilityCap: { dex: 2 } }],
  }],
};

// ── Heavy Armor ───────────────────────────────────────────────────────────────

export const itemRingMail: Item = {
  id: 'ring_mail', name: 'Ring Mail', weight: 40, cost: '30 gp',
  properties: ['heavy armor', 'disadvantage on stealth'],
  features: [{
    id: 'ring_mail_ac', name: 'Ring Mail', description: 'Base AC 14.',
    source: { kind: 'item', refId: 'ring_mail' }, level: null, actions: [], choices: [], passive: true,
    effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 14, condition: null }],
  }],
};

export const itemChainMail: Item = {
  id: 'chain_mail', name: 'Chain Mail', weight: 55, cost: '75 gp',
  properties: ['heavy armor', 'disadvantage on stealth', 'STR 13 required'],
  features: [{
    id: 'chain_mail_ac', name: 'Chain Mail', description: 'Base AC 16.',
    source: { kind: 'item', refId: 'chain_mail' }, level: null, actions: [], choices: [], passive: true,
    effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 16, condition: null }],
  }],
};

export const itemSplint: Item = {
  id: 'splint', name: 'Splint', weight: 60, cost: '200 gp',
  properties: ['heavy armor', 'disadvantage on stealth', 'STR 15 required'],
  features: [{
    id: 'splint_ac', name: 'Splint', description: 'Base AC 17.',
    source: { kind: 'item', refId: 'splint' }, level: null, actions: [], choices: [], passive: true,
    effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 17, condition: null }],
  }],
};

export const itemPlateMail: Item = {
  id: 'plate_mail', name: 'Plate Mail', weight: 65, cost: '1500 gp',
  properties: ['heavy armor', 'disadvantage on stealth', 'STR 15 required'],
  features: [{
    id: 'plate_mail_ac', name: 'Plate Mail', description: 'Base AC 18.',
    source: { kind: 'item', refId: 'plate_mail' }, level: null, actions: [], choices: [], passive: true,
    effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 18, condition: null }],
  }],
};

// ── Shield ────────────────────────────────────────────────────────────────────

export const itemShieldItem: Item = {
  id: 'shield', name: 'Shield', weight: 6, cost: '10 gp',
  properties: ['shield'],
  features: [{
    id: 'shield_ac_bonus', name: 'Shield', description: '+2 AC while equipped.',
    source: { kind: 'item', refId: 'shield' }, level: null, actions: [], choices: [], passive: true,
    effects: [{ type: 'stat_modifier', target: 'ac', operation: 'add', value: 2, condition: null }],
  }],
};

// ── Adventuring Gear ──────────────────────────────────────────────────────────

export const itemBackpack: Item = {
  id: 'backpack', name: 'Backpack', weight: 5, cost: '2 gp', properties: [], features: [],
};

export const itemRope50ft: Item = {
  id: 'rope_hemp_50ft', name: 'Rope, Hemp (50 feet)', weight: 10, cost: '1 gp', properties: [], features: [],
};

export const itemTorch: Item = {
  id: 'torch', name: 'Torch', weight: 1, cost: '1 cp',
  properties: ['illuminates 20-foot radius (bright), 20-foot radius (dim) for 1 hour'],
  features: [],
};

export const itemRations1day: Item = {
  id: 'rations_1day', name: 'Rations (1 day)', weight: 2, cost: '5 sp', properties: [], features: [],
};

export const itemHealersKit: Item = {
  id: 'healers_kit', name: "Healer's Kit", weight: 3, cost: '5 gp',
  properties: ['10 uses'],
  features: [],
};

export const itemArcaneOrb: Item = {
  id: 'arcane_focus_orb', name: 'Arcane Focus (Orb)', weight: 3, cost: '20 gp',
  properties: ['arcane focus'],
  features: [],
};

export const itemHolySymbol: Item = {
  id: 'holy_symbol', name: 'Holy Symbol', weight: 1, cost: '5 gp',
  properties: ['divine focus'],
  features: [],
};

export const itemDruidicFocus: Item = {
  id: 'druidic_focus', name: 'Druidic Focus (Wooden Staff)', weight: 4, cost: '5 gp',
  properties: ['druidic focus'],
  features: [],
};

export const itemComponentPouch: Item = {
  id: 'component_pouch', name: 'Component Pouch', weight: 2, cost: '25 gp',
  properties: ['spellcasting focus'], features: [],
};

export const itemSpellbook: Item = {
  id: 'spellbook', name: 'Spellbook', weight: 3, cost: '50 gp',
  properties: ['100 blank pages'], features: [],
};

export const itemLute: Item = {
  id: 'lute', name: 'Lute', weight: 2, cost: '35 gp',
  properties: ['musical instrument'], features: [],
};

export const itemThievesTools: Item = {
  id: 'thieves_tools', name: "Thieves' Tools", weight: 1, cost: '25 gp',
  properties: ['tool'], features: [],
};

export const itemArrows20: Item = {
  id: 'arrows_20', name: 'Arrows (20)', weight: 1, cost: '1 gp',
  properties: ['ammunition'], features: [],
};

export const itemBolts20: Item = {
  id: 'bolts_20', name: 'Crossbow Bolts (20)', weight: 1.5, cost: '1 gp',
  properties: ['ammunition'], features: [],
};

// ── Equipment Packs ───────────────────────────────────────────────────────────

export const itemExplorersPack: Item = {
  id: 'explorers_pack', name: "Explorer's Pack", weight: 59, cost: '10 gp',
  properties: ['backpack, bedroll, mess kit, tinderbox, 10 torches, 10 rations, waterskin, 50 ft rope'],
  features: [],
};

export const itemDungeoneersPack: Item = {
  id: 'dungeoneers_pack', name: "Dungeoneer's Pack", weight: 61, cost: '12 gp',
  properties: ['backpack, crowbar, hammer, 10 pitons, 10 torches, tinderbox, 10 rations, waterskin, 50 ft rope'],
  features: [],
};

export const itemPriestsPack: Item = {
  id: 'priests_pack', name: "Priest's Pack", weight: 24, cost: '19 gp',
  properties: ['backpack, blanket, 10 candles, tinderbox, alms box, 2 blocks of incense, censer, vestments, 2 days rations, waterskin'],
  features: [],
};

export const itemScholarsPack: Item = {
  id: 'scholars_pack', name: "Scholar's Pack", weight: 10, cost: '40 gp',
  properties: ['backpack, book of lore, ink, ink pen, 10 sheets parchment, little bag of sand, small knife'],
  features: [],
};

export const itemDiplomatsPack: Item = {
  id: 'diplomats_pack', name: "Diplomat's Pack", weight: 39, cost: '39 gp',
  properties: ['chest, 2 cases for maps/scrolls, fine clothes, ink, ink pen, lamp, 2 flasks oil, 5 sheets paper, vial of perfume, sealing wax, soap'],
  features: [],
};

export const itemEntertainersPack: Item = {
  id: 'entertainers_pack', name: "Entertainer's Pack", weight: 38, cost: '40 gp',
  properties: ['backpack, bedroll, 2 costumes, 5 candles, 5 days rations, waterskin, disguise kit'],
  features: [],
};

export const itemBurglarsPack: Item = {
  id: 'burglars_pack', name: "Burglar's Pack", weight: 44, cost: '16 gp',
  properties: ['backpack, ball bearings, 10 ft string, bell, 5 candles, crowbar, hammer, 10 pitons, hooded lantern, 2 flasks oil, 5 days rations, tinderbox, waterskin, 50 ft rope'],
  features: [],
};

// ── Master export ─────────────────────────────────────────────────────────────

/**
 * Hand-authored core items. These have mechanically-correct data (proper AC
 * formulas, ability effects, weights, the special homebrew items) and take
 * precedence over the auto-imported catalog on id collision.
 *
 * SRD tagging: standard PHB equipment (weapons/armor/gear/packs) carries no
 * Product Identity risk at all, so it's tagged true in bulk below. The three
 * named magic items mixed in here (+1 Life-Drinking Greatsword, Rope of
 * Mending, Cast-Off Breastplate) are Nick's own original homebrew — not WotC
 * content, no legal risk, but shouldn't be presented as "official" content,
 * same treatment as the Abyssal Claim spell and Skeleton race.
 */
const HOMEBREW_ITEM_IDS = new Set([
  'greatsword_life_drinking', 'rope_of_mending', 'cast_off_breastplate',
]);

const CORE_ITEMS: Item[] = [
  // Simple melee
  itemDagger, itemHandaxe, itemClub, itemGreatclub, itemLightHammer, itemSickle,
  itemQuarterstaff, itemJavelin, itemSpear, itemMace,
  // Simple ranged
  itemShortbow, itemLightCrossbow, itemSling, itemDart,
  // Martial melee
  itemLongsword, itemBattleaxe, itemFlail, itemGlaive, itemHalberd, itemLance,
  itemGreatsword, itemGreatswordLifeDrinking, itemGreataxe,
  itemMorningstar, itemPike, itemScimitar, itemRapier, itemTrident, itemWarPick,
  itemWarhammer, itemMaul, itemShortSword, itemWhip,
  // Martial ranged
  itemLongbow, itemHeavyCrossbow, itemHandCrossbow, itemBlowgun, itemNet,
  // Light armor
  itemLeatherArmor, itemStuddedLeather,
  // Medium armor
  itemChainShirt, itemScaleMail, itemBreastplate, itemCastOffBreastplate, itemHalfPlate,
  // Heavy armor
  itemRingMail, itemChainMail, itemSplint, itemPlateMail,
  // Shield
  itemShieldItem,
  // Gear
  itemBackpack, itemRope50ft, itemRopeOfMending, itemTorch, itemRations1day, itemHealersKit,
  itemArcaneOrb, itemHolySymbol, itemDruidicFocus,
  itemComponentPouch, itemSpellbook, itemLute, itemThievesTools, itemArrows20, itemBolts20,
  // Packs
  itemExplorersPack, itemDungeoneersPack, itemPriestsPack, itemScholarsPack,
  itemDiplomatsPack, itemEntertainersPack, itemBurglarsPack,
].map(item => ({ ...item, srd: !HOMEBREW_ITEM_IDS.has(item.id) }));

/**
 * The full item catalog: hand-authored core + auto-imported catalog
 * (src/content/items/importedItems.ts, generated by scripts/parse_items.py).
 * Imported items whose id collides with a core item are dropped so the
 * mechanically-correct hand-authored version always wins.
 */
const CORE_IDS = new Set(CORE_ITEMS.map(i => i.id));

// importedItems.ts carries no srd field itself (see that file's header) —
// classification is merged in here, at load time, from the small separate
// srdClassification.json. This means re-running parse_items.py after a
// classification-only change leaves importedItems.ts completely untouched
// (only this tiny JSON updates), instead of rewriting the entire ~541KB
// item file every time — same fix applied to spells, see
// src/content/spells/index.ts.
const CLASSIFIED_IMPORTED_ITEMS: Item[] = IMPORTED_ITEMS.map(i => ({
  ...i,
  srd: (importedSrdClassification as Record<string, boolean>)[i.id],
}));

export const FULL_ITEM_LIBRARY: Item[] = [
  ...CORE_ITEMS,
  ...CLASSIFIED_IMPORTED_ITEMS.filter(i => !CORE_IDS.has(i.id)),
];

const SRD_ONLY = process.env.EXPO_PUBLIC_SRD_ONLY === 'true';

/**
 * The item list the app should use — filtered to srd === true only on the
 * EAS `production` build profile (see eas.json). Same build-target-aware
 * pattern as spells/subclasses/races/backgrounds/feats/monsters. See
 * docs/ROADMAP_1.0.md Phase 1 — note that most of importedItems.ts is still
 * unclassified (undefined) rather than confirmed true/false, so it's
 * correctly excluded from public builds by the safe default until audited
 * further.
 */
export const ALL_ITEMS: Item[] = SRD_ONLY
  ? FULL_ITEM_LIBRARY.filter(i => i.srd === true)
  : FULL_ITEM_LIBRARY;

// ── Lazy id-lookup registry ─────────────────────────────────────────────────
// Same rationale as spells/index.ts's spellRegistry — O(1) id lookup instead
// of a linear scan over 920 items, built lazily and memoized once on first
// real access. ALL_ITEMS itself stays an eager array since 50+ files import
// it directly as Item[].
export const itemRegistry = new ContentRegistry<Item>(() => ALL_ITEMS);
