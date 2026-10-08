// src/content/infusions/index.ts
// Artificer's Infuse Item catalog (TCE). Each entry's `feature` (when not
// null) is additively appended onto an ItemInstance's own features when
// applied — see app/sheet/[id].tsx's handleApplyInfusion, which appends
// rather than replaces (unlike equip hydration). Reuses the exact Effect
// shapes traitCompiler.ts's buildTraitFeature already produces — no new
// engine plumbing needed for the ones that have a real mechanical hook.
//
// Several official infusions have NO engine hook to attach to (confirmed:
// no attack/damage-roll bonus mechanism exists anywhere —
// DerivedStats.attackBonuses is hardcoded empty; no generic saving-throw
// effect path exists; no attack-roll automation exists at all) — those ship
// as feature: null (flavor/description only), same honest-disclosure
// pattern used everywhere else in this app rather than pretending to work.
import { Feature } from '../../engine/types';

export type Infusion = {
  id:          string;
  name:        string;
  description: string;
  /** Artificer level required to learn this infusion. */
  minLevel:    number;
  /** Informational only — what kind of item this is meant to go on. */
  itemType:    string;
  /** Additively appended to the item's features when applied; null = flavor-only. */
  feature:     Feature | null;
};

function flavor(id: string, name: string, description: string, minLevel: number, itemType: string): Infusion {
  return { id, name, description, minLevel, itemType, feature: null };
}

export const ALL_INFUSIONS: Infusion[] = [
  {
    id: 'enhanced_defense', name: 'Enhanced Defense', minLevel: 2, itemType: 'armor or shield',
    description: 'You can infuse armor or a shield with this magic, giving it a +1 bonus to AC.',
    feature: {
      id: 'infusion_enhanced_defense', name: 'Enhanced Defense',
      description: 'A +1 bonus to AC while worn/wielded.',
      source: { kind: 'item', refId: 'infusion_enhanced_defense' },
      level: null, actions: [], choices: [], passive: true,
      effects: [{ type: 'stat_modifier', target: 'ac', operation: 'add', value: 1, condition: null }],
    },
  },
  flavor('enhanced_weapon', 'Enhanced Weapon', 'A weapon infused with this magic grants a +1 bonus to attack and damage rolls made with it. Flavor-only in-app — no attack/damage-roll bonus mechanism exists anywhere in the engine yet.', 2, 'weapon'),
  flavor('repeating_shot', 'Repeating Shot', 'Turns a nonmagical weapon with the ammunition property into a magic weapon that produces its own magical ammunition, +1 to attack and damage rolls when used to make a ranged attack. Flavor-only — same attack-roll-bonus gap as Enhanced Weapon.', 2, 'weapon (ammunition)'),
  {
    id: 'resistant_armor', name: 'Resistant Armor', minLevel: 6, itemType: 'armor',
    description: 'Armor infused with this magic protects the wearer from a specific type of damage of your choice — bludgeoning, cold, fire, lightning, thunder, etc.',
    feature: {
      id: 'infusion_resistant_armor', name: 'Resistant Armor',
      description: 'Resistance to a chosen damage type while worn (author-time: set the damage type when infusing).',
      source: { kind: 'item', refId: 'infusion_resistant_armor' },
      level: null, actions: [], choices: [], passive: true,
      // Damage type is filled in at apply-time by the infusion UI, mirroring
      // how the homebrew damage_resistance trait kind works — see
      // app/sheet/[id].tsx's handleApplyInfusion for the substitution.
      effects: [{ type: 'grant_resistance', target: '__CHOOSE_DAMAGE_TYPE__', operation: 'resistance', value: null, condition: null }],
    },
  },
  flavor('boots_of_the_winding_path', 'Boots of the Winding Path', 'Wearing these boots, you can teleport up to 15 feet as a bonus action to an unoccupied space you can see. Flavor-only — the app has no teleport/movement-action mechanic.', 2, 'wondrous item (boots)'),
  flavor('radiant_weapon', 'Radiant Weapon', 'A weapon infused with this magic sheds light and can be used to deal extra radiant damage a limited number of times. Flavor-only — no attack/damage-roll bonus mechanism exists yet.', 2, 'weapon'),
  flavor('repulsion_shield', 'Repulsion Shield', 'A shield infused with this magic lets you push a creature that hits you with a melee attack, as a reaction. Flavor-only — the app has no reaction-trigger automation.', 2, 'shield'),
  flavor('returning_weapon', 'Returning Weapon', 'A returning weapon flies back to your hand immediately after it is used to make a ranged attack. Flavor-only — no thrown-weapon-return mechanic exists.', 2, 'weapon (thrown)'),
  flavor('spell_refueling_ring', 'Spell-Refueling Ring', 'This ring contains a reservoir of magical energy you can use to restore your own or an ally\'s expended spell slot. Flavor-only for now — restoring a specific spell slot tier via an item isn\'t wired into the resource system yet.', 6, 'wondrous item (ring)'),
  {
    id: 'armor_of_magical_strength', name: 'Armor of Magical Strength', minLevel: 6, itemType: 'armor',
    description: "While wearing this armor, the wearer's Strength score becomes 19. It has no effect if the wearer's Strength is already 19 or higher.",
    feature: {
      id: 'infusion_armor_of_magical_strength', name: 'Armor of Magical Strength',
      description: 'Sets STR to 19 while worn (no effect if already 19+).',
      source: { kind: 'item', refId: 'infusion_armor_of_magical_strength' },
      level: null, actions: [], choices: [], passive: true,
      effects: [{ type: 'stat_modifier', target: 'str', operation: 'set', value: 19, condition: null }],
    },
  },
  {
    id: 'boots_of_elvenkind', name: 'Boots of Elvenkind', minLevel: 2, itemType: 'wondrous item (boots)',
    description: 'These boots are crafted from soft leather. While you wear them, your steps make no sound, and you have advantage on Dexterity (Stealth) checks that rely on moving silently.',
    feature: {
      id: 'infusion_boots_of_elvenkind', name: 'Boots of Elvenkind',
      description: 'Advantage on Stealth checks that rely on moving silently, while worn.',
      source: { kind: 'item', refId: 'infusion_boots_of_elvenkind' },
      level: null, actions: [], choices: [], passive: true,
      effects: [{ type: 'stat_modifier', target: 'skill:stealth (moving silently)', operation: 'advantage', value: null, condition: null }],
    },
  },
  {
    id: 'cloak_of_protection', name: 'Cloak of Protection', minLevel: 6, itemType: 'wondrous item (cloak)',
    description: 'You gain a +1 bonus to AC and saving throws while you wear this cloak.',
    feature: {
      id: 'infusion_cloak_of_protection', name: 'Cloak of Protection',
      description: '+1 AC while worn. (+1 to saving throws is not yet mechanically applied — no generic save-modifying effect path exists in the engine; announce it manually for now.)',
      source: { kind: 'item', refId: 'infusion_cloak_of_protection' },
      level: null, actions: [], choices: [], passive: true,
      effects: [{ type: 'stat_modifier', target: 'ac', operation: 'add', value: 1, condition: null }],
    },
  },
  flavor('gloves_of_missile_snaring', 'Gloves of Missile Snaring', 'Wearing these gloves, you can reduce the damage of a ranged weapon attack that hits you, and catch the missile if it\'s small enough. Flavor-only — the app has no reaction-trigger automation.', 2, 'wondrous item (gloves)'),
  {
    id: 'goggles_of_night', name: 'Goggles of Night', minLevel: 2, itemType: 'wondrous item (goggles)',
    description: 'While wearing these dark lenses, you have darkvision out to a range of 60 feet. If you already have darkvision, wearing the goggles increases its range by 60 feet.',
    feature: {
      id: 'infusion_goggles_of_night', name: 'Goggles of Night',
      description: 'Darkvision 60 ft while worn.',
      source: { kind: 'item', refId: 'infusion_goggles_of_night' },
      level: null, actions: [], choices: [], passive: true,
      effects: [{ type: 'grant_sense', target: 'senses', operation: 'add', value: null, condition: null, senseType: 'darkvision', senseRange: 60 }],
    },
  },
  {
    id: 'helm_of_awareness', name: 'Helm of Awareness', minLevel: 10, itemType: 'wondrous item (helm)',
    description: 'While wearing this helm, you have advantage on initiative rolls. In addition, you can\'t be surprised, unless you are incapacitated.',
    feature: {
      id: 'infusion_helm_of_awareness', name: 'Helm of Awareness',
      description: 'Advantage on initiative rolls while worn.',
      source: { kind: 'item', refId: 'infusion_helm_of_awareness' },
      level: null, actions: [], choices: [], passive: true,
      effects: [{ type: 'stat_modifier', target: 'initiative', operation: 'advantage', value: null, condition: null }],
    },
  },
  flavor('mind_sharpener', 'Mind Sharpener', "While wearing this armor, you gain 1 additional failed death saving throw you can have before you die, and Intelligence saving throws you make to maintain concentration gain a bonus equal to your Intelligence modifier. Flavor-only — no engine hook for death-save/concentration-check bonuses yet.", 6, 'armor'),
];

export function getInfusion(id: string): Infusion | null {
  return ALL_INFUSIONS.find(i => i.id === id) ?? null;
}

/**
 * Max simultaneously-infused items, from TCE's Infuse Item table. This table
 * is Artificer-specific — knownInfusionIds only ever grows via an
 * Artificer-only 'infusion' choice (src/content/classes/artificer.ts), so
 * assuming the Artificer level table here is safe without checking classId.
 */
export { maxInfusedItems } from '../../engine/infusionRules';
