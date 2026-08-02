// ============================================================================
// FILE: src/content/feats/index.ts
// 5e feats, salvaged from the Obsidian vault (Feats 5e.md).
//
// Each feat is selectable in place of an Ability Score Increase. `feature`
// carries any AUTOMATED effects; only targets the pipeline is known to resolve
// are automated (ability scores, speed, initiative). Feats with ability CHOICES
// ("+1 Str or Dex") or non-numeric benefits apply as a named, described Feature
// the player tracks manually — the description states the full benefit.
// ============================================================================
import { Feat, Feature, Effect, Ability } from '../../engine/types';

// ── helpers ───────────────────────────────────────────────────────────────────

function abilityBonus(ability: Ability, amount = 1): Effect {
  return { type: 'stat_modifier', target: ability, operation: 'add', value: amount, condition: null };
}

function statBonus(target: string, amount: number): Effect {
  return { type: 'stat_modifier', target, operation: 'add', value: amount, condition: null };
}

function feat(
  id: string,
  name: string,
  prerequisite: string | null,
  description: string,
  source: string,
  effects: Effect[] = [],
  abilityChoice?: { options: Ability[]; amount: number; grantsSaveProficiency?: boolean },
  skillChoice?: { picks: { id: string; label: string; mode: 'proficiency' | 'expertise'; from: 'any' | 'proficient' }[] },
): Feat {
  const feature: Feature = {
    id: `feat_${id}`,
    name,
    description,
    source: { kind: 'feat', refId: id },
    level: null,
    effects,
    actions: [],
    choices: [],
    passive: true,
  };
  // SRD status computed automatically from the source constant passed in —
  // see the HIGH-STAKES JUDGMENT CALL note on Feat.srd in engine/types.ts.
  // Only PHB-sourced feats are tagged safe; XGE/TCE/FTD/GG are all later
  // expansion books with no SRD ambiguity — confidently excluded.
  const srd = source === PHB;
  return { id, name, prerequisite, description, source, feature, abilityChoice, skillChoice, srd };
}

// Ability-option shorthands for choice feats.
const ALL_ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
function choose(options: Ability[], amount = 1, grantsSaveProficiency = false) {
  return grantsSaveProficiency
    ? { options, amount, grantsSaveProficiency: true }
    : { options, amount };
}

// Shorthand for a feat's skill picks (Skill Expert, Skilled, Prodigy).
function skillPicks(
  picks: { id: string; label: string; mode: 'proficiency' | 'expertise'; from: 'any' | 'proficient' }[],
) {
  return { picks };
}

const PHB = "Player's Handbook";
const XGE = "Xanathar's Guide to Everything";
const TCE = "Tasha's Cauldron of Everything";
const FTD = "Fizban's Treasury of Dragons";
const GG  = 'Glory of the Giants';

// ── feats ───────────────────────────────────────────────────────────────────

export const ALL_FEATS: Feat[] = [
  feat('actor', 'Actor', null,
    '+1 Charisma. Advantage on Deception and Performance checks made to pass yourself off as a different person, and you can mimic the speech of a person or the sounds made by a creature.',
    PHB, [abilityBonus('cha')]),

  feat('alert', 'Alert', null,
    '+5 bonus to initiative. You can\'t be surprised while conscious, and creatures you don\'t see don\'t gain advantage on attack rolls against you.',
    PHB, [statBonus('initiative', 5)]),

  feat('artificer_initiate', 'Artificer Initiate', null,
    'You learn one cantrip and one 1st-level artificer spell (cast once per long rest without a slot), and gain proficiency with one type of artisan\'s tools.',
    TCE),

  feat('athlete', 'Athlete', null,
    '+1 Strength or Dexterity (your choice). You stand up from prone using only 5 feet of movement, climbing doesn\'t cost extra movement, and you can make a running jump after only 5 feet of run-up.',
    PHB, [], choose(['str', 'dex'])),

  feat('bountiful_luck', 'Bountiful Luck', 'Halfling',
    'When an ally within 30 feet rolls a 1 on a d20, you can use your reaction to let them reroll, and they must use the new roll.',
    XGE),

  feat('charger', 'Charger', null,
    'As part of the Dash action you can make one melee attack or shove with a +5 bonus if you move at least 10 feet in a straight line first.',
    PHB),

  feat('chef', 'Chef', null,
    '+1 Constitution or Wisdom (your choice). You gain proficiency with cook\'s utensils and can cook special food that restores hit points or grants temporary hit points.',
    TCE, [], choose(['con', 'wis'])),

  feat('crossbow_expert', 'Crossbow Expert', null,
    'You ignore the loading property of crossbows, being within 5 feet of a hostile creature doesn\'t impose disadvantage on your ranged attacks, and you can make a hand crossbow attack as a bonus action after a one-handed attack.',
    PHB),

  feat('crusher', 'Crusher', null,
    '+1 Strength or Constitution (your choice). Once per turn when you deal bludgeoning damage you can move the target 5 feet, and after a critical hit attackers have advantage against it until your next turn.',
    TCE, [], choose(['str', 'con'])),

  feat('defensive_duelist', 'Defensive Duelist', 'Dexterity 13+',
    'When wielding a finesse weapon and hit by a melee attack, you can use your reaction to add your proficiency bonus to your AC for that attack.',
    PHB),

  feat('dragon_fear', 'Dragon Fear', 'Dragonborn',
    '+1 Strength, Constitution, or Charisma (your choice). You can use your Breath Weapon to frighten creatures instead of dealing damage.',
    XGE, [], choose(['str', 'con', 'cha'])),

  feat('dragon_hide', 'Dragon Hide', 'Dragonborn',
    '+1 Strength, Constitution, or Charisma (your choice). Your AC can become 13 + Dex modifier when unarmored, and your claws deal 1d4 + Str slashing damage.',
    XGE, [], choose(['str', 'con', 'cha'])),

  feat('drow_high_magic', 'Drow High Magic', 'Elf (drow)',
    'You can cast Detect Magic at will, and Levitate and Dispel Magic once per long rest each, using Charisma.',
    XGE),

  feat('dual_wielder', 'Dual Wielder', null,
    '+1 AC while wielding a separate melee weapon in each hand, you can two-weapon fight with non-light weapons, and you can draw or stow two one-handed weapons at once.',
    PHB),

  feat('dungeon_delver', 'Dungeon Delver', null,
    'Advantage on Perception and Investigation checks to detect secret doors, advantage on saves against traps, resistance to trap damage, and you can search for traps at normal travel pace.',
    PHB),

  feat('durable', 'Durable', null,
    '+1 Constitution. When you regain hit points from spending Hit Dice, the minimum you regain is twice your Constitution modifier.',
    PHB, [abilityBonus('con')]),

  feat('dwarf_fortitude', 'Dwarf Fortitude', 'Dwarf',
    '+1 Constitution. When you take the Dodge action you can spend one Hit Die to heal yourself.',
    XGE, [abilityBonus('con')]),

  feat('eldritch_adept', 'Eldritch Adept', 'Spellcasting or Pact Magic feature',
    'You learn one Eldritch Invocation of your choice that doesn\'t have a prerequisite.',
    TCE),

  feat('elemental_adept', 'Elemental Adept', 'The ability to cast at least one spell',
    'Choose acid, cold, fire, lightning, or thunder. Your spells ignore resistance to that damage type, and treat any 1 on a damage die of that type as a 2.',
    PHB),

  feat('elven_accuracy', 'Elven Accuracy', 'Elf or half-elf',
    '+1 Dexterity, Intelligence, Wisdom, or Charisma (your choice). When you have advantage on an attack using that ability, you can reroll one of the dice once.',
    XGE, [], choose(['dex', 'int', 'wis', 'cha'])),

  feat('ember_of_the_fire_giant', 'Ember of the Fire Giant', '4th level, Strike of the Giants (Fire Strike)',
    '+1 Strength, Constitution, or Wisdom. You gain resistance to fire damage and can deal 1d8 + proficiency bonus fire damage in a 15-foot radius and blind creatures (proficiency bonus per long rest).',
    GG, [], choose(['str', 'con', 'wis'])),

  feat('fade_away', 'Fade Away', 'Gnome',
    '+1 Dexterity or Intelligence (your choice). When you take damage you can use your reaction to become invisible until the end of your next turn.',
    XGE, [], choose(['dex', 'int'])),

  feat('fey_teleportation', 'Fey Teleportation', 'Elf (high)',
    '+1 Intelligence or Charisma (your choice). You learn Sylvan and can cast Misty Step once per short rest using Intelligence.',
    XGE, [], choose(['int', 'cha'])),

  feat('fey_touched', 'Fey Touched', null,
    '+1 Intelligence, Wisdom, or Charisma (your choice). You learn Misty Step and one 1st-level divination or enchantment spell, castable once per long rest without a slot.',
    TCE, [], choose(['int', 'wis', 'cha'])),

  feat('fighting_initiate', 'Fighting Initiate', 'Proficiency with a martial weapon',
    'You learn one Fighting Style option from the fighter class.',
    TCE),

  feat('flames_of_phlegethos', 'Flames of Phlegethos', 'Tiefling',
    '+1 Intelligence or Charisma (your choice). You can reroll 1s on fire spell damage, and creatures that hit you with melee attacks while you concentrate take fire damage.',
    XGE, [], choose(['int', 'cha'])),

  feat('fury_of_the_frost_giant', 'Fury of the Frost Giant', '4th level, Strike of the Giants (Frost Strike)',
    '+1 Strength, Constitution, or Wisdom. You gain resistance to cold damage and can deal 1d8 + proficiency bonus cold damage and reduce a creature\'s speed to 0 (proficiency bonus per long rest).',
    GG, [], choose(['str', 'con', 'wis'])),

  feat('gift_of_the_chromatic_dragon', 'Gift of the Chromatic Dragon', null,
    'You can imbue a weapon with 1d4 elemental damage (acid, cold, fire, lightning, or poison) as a bonus action, and gain resistance to one such type as a reaction.',
    FTD),

  feat('gift_of_the_gem_dragon', 'Gift of the Gem Dragon', null,
    '+1 Intelligence, Wisdom, or Charisma (your choice). As a reaction to taking damage, force a creature to make a Strength save or take 2d8 force damage and be pushed 10 feet (proficiency bonus per long rest).',
    FTD, [], choose(['int', 'wis', 'cha'])),

  feat('gift_of_the_metallic_dragon', 'Gift of the Metallic Dragon', null,
    '+1 Strength, Constitution, Wisdom, or Charisma. You can cast Cure Wounds once per long rest, and manifest protective wings as a reaction to grant +PB AC to a creature (proficiency bonus per long rest).',
    FTD, [], choose(['str', 'con', 'wis', 'cha'])),

  feat('grappler', 'Grappler', 'Strength 13+',
    'You have advantage on attack rolls against a creature you are grappling, and can use your action to try to pin a grappled creature (restrained).',
    PHB),

  feat('great_weapon_master', 'Great Weapon Master', null,
    'On a critical hit or reducing a creature to 0 HP with a melee weapon, make one bonus-action melee attack. Before a heavy-weapon attack you can take -5 to hit for +10 damage.',
    PHB),

  feat('guile_of_the_cloud_giant', 'Guile of the Cloud Giant', '4th level, Strike of the Giants (Cloud Strike)',
    '+1 Strength, Constitution, or Wisdom. You gain resistance to an attack\'s damage as a reaction and can teleport up to 30 feet (proficiency bonus per long rest).',
    GG, [], choose(['str', 'con', 'wis'])),

  feat('gunner', 'Gunner', null,
    '+1 Dexterity. You gain proficiency with firearms, ignore their loading property, and don\'t have disadvantage on ranged attacks within 5 feet.',
    TCE, [abilityBonus('dex')]),

  feat('healer', 'Healer', null,
    'Using a healer\'s kit you can stabilize and restore 1 HP to a creature, or as an action restore 1d6 + 4 + the creature\'s Hit Dice in hit points (once per rest per creature).',
    PHB),

  feat('heavily_armored', 'Heavily Armored', 'Proficiency with medium armor',
    '+1 Strength. You gain proficiency with heavy armor.',
    PHB, [abilityBonus('str')]),

  feat('heavy_armor_master', 'Heavy Armor Master', 'Proficiency with heavy armor',
    '+1 Strength. While wearing heavy armor, bludgeoning, piercing, and slashing damage from nonmagical weapons is reduced by 3.',
    PHB, [abilityBonus('str')]),

  feat('infernal_constitution', 'Infernal Constitution', 'Tiefling',
    '+1 Constitution. You gain resistance to cold and poison damage and advantage on saves against being poisoned.',
    XGE, [abilityBonus('con')]),

  feat('inspiring_leader', 'Inspiring Leader', 'Charisma 13+',
    'Spend 10 minutes to grant up to six friendly creatures temporary hit points equal to your level + your Charisma modifier.',
    PHB),

  feat('keen_mind', 'Keen Mind', null,
    '+1 Intelligence. You always know which way is north and the number of hours until sunrise/sunset, and can recall anything seen or heard within the past month.',
    PHB, [abilityBonus('int')]),

  feat('keenness_of_the_stone_giant', 'Keenness of the Stone Giant', '4th level, Strike of the Giants (Stone Strike)',
    '+1 Strength, Constitution, or Wisdom. You gain darkvision 60 ft and can deal 1d10 force damage at 60 ft and knock a creature prone (proficiency bonus per long rest).',
    GG, [], choose(['str', 'con', 'wis'])),

  feat('lightly_armored', 'Lightly Armored', null,
    '+1 Strength or Dexterity (your choice). You gain proficiency with light armor.',
    PHB, [], choose(['str', 'dex'])),

  feat('linguist', 'Linguist', null,
    '+1 Intelligence. You learn three languages and can create written ciphers.',
    PHB, [abilityBonus('int')]),

  feat('lucky', 'Lucky', null,
    'You have 3 luck points per long rest. Spend one to roll an extra d20 for your own attack roll, ability check, or save, or to force an attacker to reroll.',
    PHB),

  feat('mage_slayer', 'Mage Slayer', null,
    'When a creature within 5 feet casts a spell you can use your reaction to attack it. You impose disadvantage on its concentration saves and have advantage on saves against its spells.',
    PHB),

  feat('magic_initiate', 'Magic Initiate', null,
    'Choose a class: you learn two of its cantrips and one 1st-level spell, castable once per long rest without a slot.',
    PHB),

  feat('martial_adept', 'Martial Adept', null,
    'You learn two maneuvers from the Battle Master archetype and gain one superiority die (d6).',
    PHB),

  feat('medium_armor_master', 'Medium Armor Master', 'Proficiency with medium armor',
    'Wearing medium armor doesn\'t impose disadvantage on Stealth, and you can add up to +3 Dexterity (instead of +2) to AC.',
    PHB),

  feat('metamagic_adept', 'Metamagic Adept', 'Spellcasting or Pact Magic feature',
    'You learn two Metamagic options from the sorcerer class and gain 2 sorcery points to use them.',
    TCE),

  feat('mobile', 'Mobile', null,
    'Your speed increases by 10 feet. Dashing through difficult terrain costs no extra movement, and you don\'t provoke opportunity attacks from a creature you made a melee attack against this turn.',
    PHB, [statBonus('speed', 10)]),

  feat('moderately_armored', 'Moderately Armored', 'Proficiency with light armor',
    '+1 Strength or Dexterity (your choice). You gain proficiency with medium armor and shields.',
    PHB, [], choose(['str', 'dex'])),

  feat('mounted_combatant', 'Mounted Combatant', null,
    'Advantage on melee attacks against unmounted creatures smaller than your mount, you can redirect attacks aimed at your mount to yourself, and your mount takes no damage on successful Dex saves (half on failure).',
    PHB),

  feat('observant', 'Observant', null,
    '+1 Intelligence or Wisdom (your choice). You can read lips, and you gain a +5 bonus to passive Perception and passive Investigation.',
    PHB, [statBonus('passivePerception', 5)], choose(['int', 'wis'])),

  feat('orcish_fury', 'Orcish Fury', 'Half-orc',
    '+1 Strength or Constitution (your choice). Once per short rest, add a weapon damage die when you hit, and you can attack as a reaction after using Relentless Endurance.',
    XGE, [], choose(['str', 'con'])),

  feat('piercer', 'Piercer', null,
    '+1 Strength or Dexterity (your choice). Once per turn you can reroll a piercing damage die, and a critical hit with a piercing weapon rolls one additional damage die.',
    TCE, [], choose(['str', 'dex'])),

  feat('poisoner', 'Poisoner', null,
    'You gain proficiency with the poisoner\'s kit, can apply poison as a bonus action, your weapon attacks ignore resistance to poison, and you can craft potent poison.',
    TCE),

  feat('polearm_master', 'Polearm Master', null,
    'When wielding a glaive, halberd, quarterstaff, or spear you can make a bonus-action attack with the opposite end (1d4), and creatures provoke an opportunity attack when entering your reach.',
    PHB),

  feat('prodigy', 'Prodigy', 'Half-elf, half-orc, or human',
    'You gain one skill proficiency, one tool proficiency, and one language, plus expertise in one skill you\'re proficient with.',
    XGE),

  feat('resilient', 'Resilient', null,
    '+1 to one ability score of your choice, and you gain proficiency in saving throws using that ability.',
    PHB, [], choose(ALL_ABILITIES, 1, true)),

  feat('ritual_caster', 'Ritual Caster', 'Intelligence or Wisdom 13+',
    'You acquire a ritual book with two 1st-level ritual spells from a chosen class and can add more rituals you find.',
    PHB),

  feat('rune_shaper', 'Rune Shaper', 'Spellcasting feature or Rune Carver background',
    'You learn Comprehend Languages and can cast a number of 1st-level spells equal to half your proficiency bonus using a rune or spell slot.',
    GG),

  feat('savage_attacker', 'Savage Attacker', null,
    'Once per turn when you roll damage for a melee weapon attack, you can reroll the damage dice and use either total.',
    PHB),

  feat('second_chance', 'Second Chance', 'Halfling',
    '+1 Dexterity, Constitution, or Charisma (your choice). When a creature you can see hits you, you can use your reaction to force it to reroll (once per rest until you do).',
    XGE, [], choose(['dex', 'con', 'cha'])),

  feat('sentinel', 'Sentinel', null,
    'A creature you hit with an opportunity attack has its speed reduced to 0, creatures provoke opportunity attacks even when they Disengage, and you can attack as a reaction when an enemy attacks an ally near you.',
    PHB),

  feat('shadow_touched', 'Shadow Touched', null,
    '+1 Intelligence, Wisdom, or Charisma (your choice). You learn Invisibility and one 1st-level illusion or necromancy spell, castable once per long rest without a slot.',
    TCE, [], choose(['int', 'wis', 'cha'])),

  feat('sharpshooter', 'Sharpshooter', null,
    'Long-range attacks don\'t have disadvantage, your ranged attacks ignore half and three-quarters cover, and you can take -5 to hit for +10 damage.',
    PHB),

  feat('shield_master', 'Shield Master', null,
    'You can shove as a bonus action when you Attack, add your shield\'s AC to Dexterity saves against effects targeting only you, and take no damage on a successful Dex save (half on failure).',
    PHB),

  feat('skill_expert', 'Skill Expert', null,
    '+1 to one ability score, one skill proficiency, and expertise in one skill you\'re proficient with.',
    TCE, [], choose(ALL_ABILITIES), skillPicks([
      { id: 'se_prof',      label: 'Skill proficiency', mode: 'proficiency', from: 'any' },
      { id: 'se_expertise', label: 'Expertise',         mode: 'expertise',  from: 'proficient' },
    ])),

  feat('skilled', 'Skilled', null,
    'You gain proficiency in any combination of three skills or tools.',
    PHB),

  feat('skulker', 'Skulker', 'Dexterity 13+',
    'You can hide when lightly obscured, missing with a ranged attack doesn\'t reveal your position, and dim light doesn\'t impose disadvantage on your Perception checks relying on sight.',
    PHB),

  feat('slasher', 'Slasher', null,
    '+1 Strength or Dexterity (your choice). Once per turn reduce a target\'s speed by 10 feet on a slashing hit, and a slashing critical hit gives the target disadvantage on attacks until your next turn.',
    TCE, [], choose(['str', 'dex'])),

  feat('soul_of_the_storm_giant', 'Soul of the Storm Giant', '4th level, Strike of the Giants (Storm Strike)',
    '+1 Strength, Constitution, or Wisdom. You gain resistance to lightning and thunder, impose disadvantage on attacks against you, and can reduce an attacker\'s speed (proficiency bonus per long rest).',
    GG, [], choose(['str', 'con', 'wis'])),

  feat('spell_sniper', 'Spell Sniper', 'The ability to cast at least one spell',
    'Doubles the range of your attack-roll spells, those spells ignore half and three-quarters cover, and you learn one attack cantrip.',
    PHB),

  feat('squat_nimbleness', 'Squat Nimbleness', 'Dwarf or a Small race',
    '+1 Strength or Dexterity (your choice). Your speed increases by 5 feet, you gain proficiency in Acrobatics or Athletics, and advantage on checks to escape a grapple.',
    XGE, [statBonus('speed', 5)], choose(['str', 'dex'])),

  feat('strike_of_the_giants', 'Strike of the Giants', 'Proficiency with a martial weapon or Giant Foundling background',
    'Choose a giant type. You can deal extra damage and an additional effect (varies by type) when you hit with a weapon attack (proficiency bonus per long rest).',
    GG),

  feat('tavern_brawler', 'Tavern Brawler', null,
    '+1 Strength or Constitution (your choice). Proficiency with improvised weapons, your unarmed strikes deal 1d4, and you can grapple as a bonus action after hitting with an unarmed strike or improvised weapon.',
    PHB, [], choose(['str', 'con'])),

  feat('telekinetic', 'Telekinetic', null,
    '+1 Intelligence, Wisdom, or Charisma (your choice). You learn Mage Hand (cast without components) and can telekinetically shove a creature 5 feet as a bonus action.',
    TCE, [], choose(['int', 'wis', 'cha'])),

  feat('telepathic', 'Telepathic', null,
    '+1 Intelligence, Wisdom, or Charisma (your choice). You can speak telepathically to creatures within 60 feet and can cast Detect Thoughts once per long rest without a slot.',
    TCE, [], choose(['int', 'wis', 'cha'])),

  feat('tough', 'Tough', null,
    'Your hit point maximum increases by twice your level when you take this feat, and by 2 every time you gain a level thereafter.',
    PHB),

  feat('vigor_of_the_hill_giant', 'Vigor of the Hill Giant', '4th level, Strike of the Giants (Hill Strike)',
    '+1 Strength, Constitution, or Wisdom. You can\'t be knocked prone unless willing, and when you spend a Hit Die you regain extra HP equal to your Constitution modifier + proficiency bonus.',
    GG, [], choose(['str', 'con', 'wis'])),

  feat('war_caster', 'War Caster', 'The ability to cast at least one spell',
    'Advantage on concentration saves, you can perform somatic components with weapons or a shield in hand, and you can cast a spell as an opportunity attack.',
    PHB),

  feat('weapon_master', 'Weapon Master', null,
    '+1 Strength or Dexterity (your choice). You gain proficiency with four weapons of your choice.',
    PHB, [], choose(['str', 'dex'])),

  feat('wood_elf_magic', 'Wood Elf Magic', 'Elf (wood)',
    'You learn one druid cantrip and can cast Longstrider and Pass Without Trace once per long rest each.',
    XGE),
];

/** Lookup map: featId → Feat. */
export const FEATS_BY_ID: Record<string, Feat> = Object.fromEntries(
  ALL_FEATS.map(f => [f.id, f]),
);
