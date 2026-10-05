// ============================================================================
// FILE: src/content/weaponMastery.ts
// Weapon Mastery (2024 rules / 5.5e), from the System Reference Document 5.2.1 (Creative Commons
// Attribution 4.0). Every weapon has ONE mastery property; a character whose class grants Weapon
// Mastery can use the property of a limited number of weapon KINDS they pick. This file is the data:
// each weapon's mastery, category, melee/ranged and its other properties (what class eligibility
// rules read), and the eight mastery properties' rules text. Weapons are identified by the same id
// the item catalog uses (the weapon name in lowercase with underscores: 'greataxe', 'war_pick').
// ============================================================================

export type MasteryProperty = 'cleave' | 'graze' | 'nick' | 'push' | 'sap' | 'slow' | 'topple' | 'vex';

export const MASTERY_RULES: Record<MasteryProperty, string> = {
  cleave: 'If you hit a creature with a melee attack roll using this weapon, you can make a melee attack roll with the weapon against a second creature within 5 feet of the first that is also within your reach. On a hit, the second creature takes the weapon\'s damage, but don\'t add your ability modifier to that damage unless that modifier is negative. You can make this extra attack only once per turn.',
  graze: 'If your attack roll with this weapon misses a creature, you can deal damage to that creature equal to the ability modifier you used to make the attack roll. This damage is the same type dealt by the weapon, and the damage can be increased only by increasing the ability modifier.',
  nick: 'When you make the extra attack of the Light property, you can make it as part of the Attack action instead of as a Bonus Action. You can make this extra attack only once per turn.',
  push: 'If you hit a creature with this weapon, you can push the creature up to 10 feet straight away from yourself if it is Large or smaller.',
  sap: 'If you hit a creature with this weapon, that creature has Disadvantage on its next attack roll before the start of your next turn.',
  slow: 'If you hit a creature with this weapon and deal damage to it, you can reduce its Speed by 10 feet until the start of your next turn. If the creature is hit more than once by weapons that have this property, the Speed reduction doesn\'t exceed 10 feet.',
  topple: 'If you hit a creature with this weapon, you can force the creature to make a Constitution saving throw (DC 8 plus the ability modifier used to make the attack roll and your Proficiency Bonus). On a failed save, the creature has the Prone condition.',
  vex: 'If you hit a creature with this weapon and deal damage to the creature, you have Advantage on your next attack roll against that creature before the end of your next turn.',
};

export type WeaponMasteryEntry = {
  id: string;
  name: string;
  category: 'simple' | 'martial';
  kind: 'melee' | 'ranged';
  mastery: MasteryProperty;
  /** Lowercase property keywords: finesse, light, heavy, reach, thrown, two-handed, versatile, ammunition, loading. */
  properties: string[];
};

const w = (name: string, category: 'simple' | 'martial', kind: 'melee' | 'ranged', mastery: MasteryProperty, ...properties: string[]): WeaponMasteryEntry =>
  ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '_'), name, category, kind, mastery, properties });

export const WEAPON_MASTERY_TABLE: WeaponMasteryEntry[] = [
  // Simple melee
  w('Club', 'simple', 'melee', 'slow', 'light'),
  w('Dagger', 'simple', 'melee', 'nick', 'finesse', 'light', 'thrown'),
  w('Greatclub', 'simple', 'melee', 'push', 'two-handed'),
  w('Handaxe', 'simple', 'melee', 'vex', 'light', 'thrown'),
  w('Javelin', 'simple', 'melee', 'slow', 'thrown'),
  w('Light Hammer', 'simple', 'melee', 'nick', 'light', 'thrown'),
  w('Mace', 'simple', 'melee', 'sap'),
  w('Quarterstaff', 'simple', 'melee', 'topple', 'versatile'),
  w('Sickle', 'simple', 'melee', 'nick', 'light'),
  w('Spear', 'simple', 'melee', 'sap', 'thrown', 'versatile'),
  // Simple ranged
  w('Dart', 'simple', 'ranged', 'vex', 'finesse', 'thrown'),
  w('Light Crossbow', 'simple', 'ranged', 'slow', 'ammunition', 'loading', 'two-handed'),
  w('Shortbow', 'simple', 'ranged', 'vex', 'ammunition', 'two-handed'),
  w('Sling', 'simple', 'ranged', 'slow', 'ammunition'),
  // Martial melee
  w('Battleaxe', 'martial', 'melee', 'topple', 'versatile'),
  w('Flail', 'martial', 'melee', 'sap'),
  w('Glaive', 'martial', 'melee', 'graze', 'heavy', 'reach', 'two-handed'),
  w('Greataxe', 'martial', 'melee', 'cleave', 'heavy', 'two-handed'),
  w('Greatsword', 'martial', 'melee', 'graze', 'heavy', 'two-handed'),
  w('Halberd', 'martial', 'melee', 'cleave', 'heavy', 'reach', 'two-handed'),
  w('Lance', 'martial', 'melee', 'topple', 'heavy', 'reach', 'two-handed'),
  w('Longsword', 'martial', 'melee', 'sap', 'versatile'),
  w('Maul', 'martial', 'melee', 'topple', 'heavy', 'two-handed'),
  w('Morningstar', 'martial', 'melee', 'sap'),
  w('Pike', 'martial', 'melee', 'push', 'heavy', 'reach', 'two-handed'),
  w('Rapier', 'martial', 'melee', 'vex', 'finesse'),
  w('Scimitar', 'martial', 'melee', 'nick', 'finesse', 'light'),
  w('Shortsword', 'martial', 'melee', 'vex', 'finesse', 'light'),
  w('Trident', 'martial', 'melee', 'topple', 'thrown', 'versatile'),
  w('Warhammer', 'martial', 'melee', 'push', 'versatile'),
  w('War Pick', 'martial', 'melee', 'sap', 'versatile'),
  w('Whip', 'martial', 'melee', 'slow', 'finesse', 'reach'),
  // Martial ranged
  w('Blowgun', 'martial', 'ranged', 'vex', 'ammunition', 'loading'),
  w('Hand Crossbow', 'martial', 'ranged', 'vex', 'ammunition', 'light', 'loading'),
  w('Heavy Crossbow', 'martial', 'ranged', 'push', 'ammunition', 'heavy', 'loading', 'two-handed'),
  w('Longbow', 'martial', 'ranged', 'slow', 'ammunition', 'heavy', 'two-handed'),
  w('Musket', 'martial', 'ranged', 'slow', 'ammunition', 'loading', 'two-handed'),
  w('Pistol', 'martial', 'ranged', 'vex', 'ammunition', 'loading'),
];

export const WEAPON_MASTERY_BY_ID: Record<string, WeaponMasteryEntry> = Object.fromEntries(WEAPON_MASTERY_TABLE.map(e => [e.id, e]));

/** The mastery entry for an item id or name ('Greataxe', 'greataxe', 'war_pick'), or undefined for a non-weapon / unknown weapon. */
export function masteryEntryFor(idOrName: string | undefined): WeaponMasteryEntry | undefined {
  if (!idOrName) return undefined;
  return WEAPON_MASTERY_BY_ID[idOrName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')];
}

/**
 * Which weapon kinds a class's Weapon Mastery may pick, as a rule key read from the granting feature:
 *   'melee'           Simple or Martial MELEE weapons (Barbarian)
 *   'any'             any Simple or Martial weapon (Fighter, Paladin, Ranger)
 *   'finesse_or_light' Simple or Martial weapons with the Finesse or Light property (Rogue)
 */
export type MasteryEligibility = 'melee' | 'any' | 'finesse_or_light';

export function isEligibleForMastery(entry: WeaponMasteryEntry, rule: MasteryEligibility): boolean {
  if (rule === 'melee') return entry.kind === 'melee';
  if (rule === 'finesse_or_light') return entry.properties.includes('finesse') || entry.properties.includes('light');
  return true;
}
