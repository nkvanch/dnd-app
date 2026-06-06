// ============================================================================
// FILE: src/content/items/index.ts
// Standard weapons, armor, and adventuring gear.
// ============================================================================
import { Item } from '../../engine/types';

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
    effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 11, condition: null }],
  }],
};

export const itemStuddedLeather: Item = {
  id: 'studded_leather', name: 'Studded Leather', weight: 13, cost: '45 gp',
  properties: ['light armor'],
  features: [{
    id: 'studded_leather_ac', name: 'Studded Leather', description: 'Base AC 12 + DEX modifier.',
    source: { kind: 'item', refId: 'studded_leather' }, level: null, actions: [], choices: [], passive: true,
    effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 12, condition: null }],
  }],
};

// ── Medium Armor ──────────────────────────────────────────────────────────────

export const itemChainShirt: Item = {
  id: 'chain_shirt', name: 'Chain Shirt', weight: 20, cost: '50 gp',
  properties: ['medium armor'],
  features: [{
    id: 'chain_shirt_ac', name: 'Chain Shirt', description: 'Base AC 13 + DEX modifier (max 2).',
    source: { kind: 'item', refId: 'chain_shirt' }, level: null, actions: [], choices: [], passive: true,
    effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 13, condition: null }],
  }],
};

export const itemScaleMail: Item = {
  id: 'scale_mail', name: 'Scale Mail', weight: 45, cost: '50 gp',
  properties: ['medium armor', 'disadvantage on stealth'],
  features: [{
    id: 'scale_mail_ac', name: 'Scale Mail', description: 'Base AC 14 + DEX modifier (max 2).',
    source: { kind: 'item', refId: 'scale_mail' }, level: null, actions: [], choices: [], passive: true,
    effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 14, condition: null }],
  }],
};

export const itemBreastplate: Item = {
  id: 'breastplate', name: 'Breastplate', weight: 20, cost: '400 gp',
  properties: ['medium armor'],
  features: [{
    id: 'breastplate_ac', name: 'Breastplate', description: 'Base AC 14 + DEX modifier (max 2).',
    source: { kind: 'item', refId: 'breastplate' }, level: null, actions: [], choices: [], passive: true,
    effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 14, condition: null }],
  }],
};

export const itemHalfPlate: Item = {
  id: 'half_plate', name: 'Half Plate', weight: 40, cost: '750 gp',
  properties: ['medium armor', 'disadvantage on stealth'],
  features: [{
    id: 'half_plate_ac', name: 'Half Plate', description: 'Base AC 15 + DEX modifier (max 2).',
    source: { kind: 'item', refId: 'half_plate' }, level: null, actions: [], choices: [], passive: true,
    effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 15, condition: null }],
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

export const ALL_ITEMS: Item[] = [
  // Simple melee
  itemDagger, itemHandaxe, itemClub, itemQuarterstaff, itemJavelin, itemSpear, itemMace,
  // Simple ranged
  itemShortbow, itemLightCrossbow, itemDart,
  // Martial melee
  itemLongsword, itemBattleaxe, itemGreatsword, itemGreataxe, itemScimitar, itemRapier, itemWarhammer, itemMaul, itemShortSword,
  // Martial ranged
  itemLongbow, itemHandCrossbow,
  // Light armor
  itemLeatherArmor, itemStuddedLeather,
  // Medium armor
  itemChainShirt, itemScaleMail, itemBreastplate, itemHalfPlate,
  // Heavy armor
  itemRingMail, itemChainMail, itemSplint, itemPlateMail,
  // Shield
  itemShieldItem,
  // Gear
  itemBackpack, itemRope50ft, itemTorch, itemRations1day, itemHealersKit,
  itemArcaneOrb, itemHolySymbol, itemDruidicFocus,
  itemComponentPouch, itemSpellbook, itemLute, itemThievesTools, itemArrows20, itemBolts20,
  // Packs
  itemExplorersPack, itemDungeoneersPack, itemPriestsPack, itemScholarsPack,
  itemDiplomatsPack, itemEntertainersPack, itemBurglarsPack,
];
