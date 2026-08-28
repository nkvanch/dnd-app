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

// Reminder-only, same mechanism DerivedStats.advantageStates already uses
// elsewhere (e.g. infusions/index.ts, Barbarian's Feral Instinct) — shown to
// the player so they remember to roll 2d20, not auto-applied to any roll.
function advantage(target: string): Effect {
  return { type: 'stat_modifier', target, operation: 'advantage', value: null, condition: null };
}
function resistance(damageType: string): Effect {
  return { type: 'grant_resistance', target: damageType, operation: 'resistance', value: null, condition: null };
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
  // SRD status: CONFIRMED via direct verification against the actual SRD 5.1
  // text (5thsrd.org, a faithful CC-BY mirror) on 2026-08-04. The SRD 5.1
  // Feats section contains ONLY Grappler — the "optional feats rule" framing
  // in the class text names Grappler as the sole worked example, unlike
  // classes/races/backgrounds/monsters which got much fuller treatment.
  // This CORRECTS an earlier optimistic guess (all 42 PHB feats) that was
  // based on a pattern from other content types that turned out NOT to
  // apply to feats. See docs/ROADMAP_1.0.md Phase 1 Step 1.4 for the full
  // verification writeup and links.
  const srd = id === 'grappler';
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
const ERLW = 'Eberron: Rising from the Last War';
const SDQ  = 'Dragonlance: Shadow of the Dragon Queen';
const PS   = 'Planescape: Adventures in the Multiverse';
const SCC  = "Strixhaven: A Curriculum of Chaos";
const BHH  = "Blood Hunter's Handbook";
const TOH  = 'Tome of Heroes';

// ── feats ───────────────────────────────────────────────────────────────────

const allFeatEntries: Feat[] = [
  feat('aberrant_dragonmark', 'Aberrant Dragonmark', 'No other dragonmark',
    '+1 Constitution, to a maximum of 20. You manifest an aberrant dragonmark: you learn a sorcerer cantrip and a 1st-level sorcerer spell, the latter castable once per short or long rest without a slot using Constitution, and develop a random flaw. Casting the 1st-level spell through your mark lets you spend a Hit Die for a temporary-HP-or-force-damage effect. (The ASI is real. The cantrip/spell are both player choices with no fixed spell, and the leveled spell has no mechanism for a limited-use LEVELED spell without a slot — neither is applied mechanically, nor is the Hit-Die-roll effect.)',
    ERLW, [abilityBonus('con')]),

  feat('actor', 'Actor', null,
    '+1 Charisma. Advantage on Deception and Performance checks made to pass yourself off as a different person, and you can mimic the speech of a person or the sounds made by a creature.',
    PHB, [abilityBonus('cha')]),

  feat('adept_of_the_black_robes', 'Adept of the Black Robes', '4th level, Initiate of High Sorcery (Nuitari)',
    'Ambitious Magic: you learn a 2nd-level Enchantment or Necromancy spell of your choice, castable once per long rest without a slot (or normally with a slot), using the ability chosen for Initiate of High Sorcery. Life Channel: you can expend Hit Dice to add their roll to the damage of a spell that just made a creature fail its save. (The spell is a player choice with no fixed spell, and it\'s a leveled spell — no mechanism for a limited-use LEVELED spell without a slot fits, and no Hit-Dice-expenditure-for-bonus-damage mechanism exists — neither is applied mechanically.)',
    SDQ),

  feat('adept_of_the_red_robes', 'Adept of the Red Robes', '4th level, Initiate of High Sorcery (Lunitari)',
    'Insightful Magic: you learn a 2nd-level Illusion or Transmutation spell of your choice, castable once per long rest without a slot (or normally with a slot), using the ability chosen for Initiate of High Sorcery. Magical Balance: a number of times equal to your proficiency bonus (regaining all on a long rest), you can treat a d20 roll of 9 or lower on an attack roll or ability check as a 10 instead. (The spell is a player choice with no fixed spell and no mechanism for a limited-use LEVELED spell without a slot — not applied mechanically. Feats have no mechanism to track a custom resource pool — same gap as this app\'s existing Lucky/Martial Adept feats — so Magical Balance\'s uses aren\'t tracked either.)',
    SDQ),

  feat('adept_of_the_white_robes', 'Adept of the White Robes', '4th level, Initiate of High Sorcery (Solinari)',
    'Protective Magic: you learn a 2nd-level Abjuration or Divination spell of your choice, castable once per long rest without a slot (or normally with a slot), using the ability chosen for Initiate of High Sorcery. Protective Ward: as a reaction, you can expend a spell slot to reduce damage to yourself or a nearby creature by a roll of d6s equal to the slot\'s level plus your spellcasting modifier. (The spell is a player choice with no fixed spell and no mechanism for a limited-use LEVELED spell without a slot — not applied mechanically. The Ward\'s reactive damage reduction has no automated hook either.)',
    SDQ),

  feat('agent_of_order', 'Agent of Order', '4th level, Scion of the Outer Planes (Lawful Outer Plane)',
    '+1 to one ability score of your choice, to a maximum of 20. Stasis Strike: a number of times equal to your proficiency bonus (regaining all on a long rest), once per turn when you damage a creature within 60 feet you can deal extra force damage and force a Wisdom save or restrain it until the start of your next turn. (The ASI is real. Feats have no mechanism to track a custom resource pool — same gap as this app\'s existing Lucky/Martial Adept feats — so Stasis Strike\'s uses, extra damage, and save aren\'t applied mechanically.)',
    PS, [], choose(ALL_ABILITIES)),

  feat('alert', 'Alert', null,
    '+5 bonus to initiative. You can\'t be surprised while conscious, and creatures you don\'t see don\'t gain advantage on attack rolls against you.',
    PHB, [statBonus('initiative', 5)]),

  feat('artificer_initiate', 'Artificer Initiate', null,
    'You learn one cantrip and one 1st-level artificer spell (cast once per long rest without a slot), and gain proficiency with one type of artisan\'s tools.',
    TCE),

  feat('athlete', 'Athlete', null,
    '+1 Strength or Dexterity (your choice). You stand up from prone using only 5 feet of movement, climbing doesn\'t cost extra movement, and you can make a running jump after only 5 feet of run-up.',
    PHB, [], choose(['str', 'dex'])),

  feat('baleful_scion', 'Baleful Scion', '4th level, Scion of the Outer Planes (Evil Outer Plane)',
    '+1 to one ability score of your choice, to a maximum of 20. Grasp of Avarice: a number of times equal to your proficiency bonus (regaining all on a long rest), once per turn when you damage a creature within 60 feet you can also deal necrotic damage and heal yourself for the same amount. (The ASI is real. Feats have no mechanism to track a custom resource pool — same gap as this app\'s existing Lucky/Martial Adept feats — so Grasp of Avarice\'s uses, damage, and healing aren\'t applied mechanically.)',
    PS, [], choose(ALL_ABILITIES)),

  feat('bountiful_luck', 'Bountiful Luck', 'Halfling',
    'When an ally within 30 feet rolls a 1 on a d20, you can use your reaction to let them reroll, and they must use the new roll.',
    XGE),

  feat('cartomancer', 'Cartomancer', '4th level, Spellcasting feature',
    'You can use a card deck as a spellcasting focus. Card Tricks: you learn the Prestidigitation cantrip and can use it to perform card-trick-style stage magic. Hidden Ace: when you finish a long rest, you can imbue an action-casting-time spell you know into a card, letting you cast it as a bonus action within the next 8 hours (once, then the card loses its magic). (The Prestidigitation cantrip is real. Hidden Ace has no mechanism for imbuing an arbitrary known spell into an item for later casting — not applied mechanically.)',
    SCC, [{ type: 'grant_spell', target: 'spell', operation: 'add', value: null, condition: null, cantripIds: ['prestidigitation'], spellcastingAbility: 'int' }]),

  feat('charger', 'Charger', null,
    'As part of the Dash action you can make one melee attack or shove with a +5 bonus if you move at least 10 feet in a straight line first.',
    PHB),

  feat('chef', 'Chef', null,
    '+1 Constitution or Wisdom (your choice). You gain proficiency with cook\'s utensils and can cook special food that restores hit points or grants temporary hit points.',
    TCE, [], choose(['con', 'wis'])),

  feat('cohort_of_chaos', 'Cohort of Chaos', '4th level, Scion of the Outer Planes (Chaotic Outer Plane)',
    '+1 to one ability score of your choice, to a maximum of 20. Chaotic Flare: whenever you roll a 1 or 20 on an attack roll or save, roll a d4 to trigger a random chaotic effect (battle fury on an ally, a damaging aura around you, a short teleport, or a Wisdom-save-imposing wind) lasting until the end of your next turn. (The ASI is real. The flare\'s random trigger and its 4 distinct effects have no automated hook — not applied mechanically.)',
    PS, [], choose(ALL_ABILITIES)),

  feat('crossbow_expert', 'Crossbow Expert', null,
    'You ignore the loading property of crossbows, being within 5 feet of a hostile creature doesn\'t impose disadvantage on your ranged attacks, and you can make a hand crossbow attack as a bonus action after a one-handed attack.',
    PHB),

  feat('cruel', 'Cruel', null,
    'You gain a number of d6 cruelty dice equal to your proficiency bonus (regaining all on a long rest, one usable per turn). Spend one to add extra damage on a hit, gain temporary hit points on a critical hit, or add to a Charisma (Intimidation) check. (Feats have no mechanism to track a custom resource pool — same gap as this app\'s existing Lucky/Martial Adept feats — so the cruelty dice aren\'t tracked or applied mechanically.)',
    TOH),

  feat('crusher', 'Crusher', null,
    '+1 Strength or Constitution (your choice). Once per turn when you deal bludgeoning damage you can move the target 5 feet, and after a critical hit attackers have advantage against it until your next turn.',
    TCE, [], choose(['str', 'con'])),

  feat('defensive_duelist', 'Defensive Duelist', 'Dexterity 13+',
    'When wielding a finesse weapon and hit by a melee attack, you can use your reaction to add your proficiency bonus to your AC for that attack.',
    PHB),

  feat('divinely_favored', 'Divinely Favored', '4th level, Dragonlance campaign',
    'A god has chosen you to carry a spark of their power. You learn a cleric cantrip of your choice, the Augury spell, and a 1st-level spell tied to your alignment (a warlock spell if evil, a cleric spell if good, a druid spell if neutral). You can cast Augury and the alignment spell once each per long rest without a slot, using Intelligence, Wisdom, or Charisma (your choice), and can use a holy symbol as your focus for them. (Every spell here is a player choice with no fixed spell, and the 1st-level spells have no mechanism for a limited-use LEVELED spell without a slot — not applied mechanically.)',
    SDQ),

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
    // "Resistance to trap damage" stays description-only — "trap damage" isn't
    // a real 5e damage type the resistance system can key on.
    PHB, [
      advantage('Perception and Investigation checks to detect secret doors'),
      advantage('saving throws against traps'),
    ]),

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

  feat('flash_recall', 'Flash Recall', 'Spellcasting feature from a class that prepares spells',
    'As a bonus action, you can swap a prepared spell for a different spell of the same level or lower from your class list (or spellbook, if a wizard), once per short or long rest. (No mechanism for swapping a prepared spell mid-session — not applied mechanically.)',
    SCC),

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

  // "Pin a grappled creature" stays description-only — not a passive stat
  // bonus, no action/resource mechanism to automate it.
  feat('grappler', 'Grappler', 'Strength 13+',
    'You have advantage on attack rolls against a creature you are grappling, and can use your action to try to pin a grappled creature (restrained).',
    PHB, [advantage('attack rolls against a creature you are grappling')]),

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
    XGE, [
      abilityBonus('con'), resistance('cold'), resistance('poison'),
      advantage('saving throws against being poisoned'),
    ]),

  feat('initiate_of_high_sorcery', 'Initiate of High Sorcery', 'Dragonlance campaign, Sorcerer or Wizard class or Mage of High Sorcery background',
    'Choose one of Krynn\'s three moons (Nuitari, Lunitari, or Solinari) to influence your magic. You learn a wizard cantrip of your choice and two 1st-level spells from that moon\'s list, each castable once per long rest without a slot, using Intelligence, Wisdom, or Charisma (your choice). (Every spell here is a player choice with no fixed spell, and the 1st-level spells have no mechanism for a limited-use LEVELED spell without a slot — not applied mechanically.)',
    SDQ),

  feat('inspiring_leader', 'Inspiring Leader', 'Charisma 13+',
    'Spend 10 minutes to grant up to six friendly creatures temporary hit points equal to your level + your Charisma modifier.',
    PHB),

  feat('keen_mind', 'Keen Mind', null,
    '+1 Intelligence. You always know which way is north and the number of hours until sunrise/sunset, and can recall anything seen or heard within the past month.',
    PHB, [abilityBonus('int')]),

  feat('keenness_of_the_stone_giant', 'Keenness of the Stone Giant', '4th level, Strike of the Giants (Stone Strike)',
    '+1 Strength, Constitution, or Wisdom. You gain darkvision 60 ft and can deal 1d10 force damage at 60 ft and knock a creature prone (proficiency bonus per long rest).',
    GG, [], choose(['str', 'con', 'wis'])),

  feat('knight_of_the_crown', 'Knight of the Crown', '4th level, Squire of Solamnia',
    '+1 Strength, Dexterity, or Constitution (your choice), to a maximum of 20. Commanding Rally: as a bonus action, a number of times equal to your proficiency bonus (regaining all on a long rest), you can command an ally within 30 feet to immediately make a reaction weapon attack with a bonus to the damage roll if it hits. (The ASI is real. Feats have no mechanism to track a custom resource pool — same gap as this app\'s existing Lucky/Martial Adept feats — so Commanding Rally\'s uses and the reaction attack it grants aren\'t applied mechanically.)',
    SDQ, [], choose(['str', 'dex', 'con'])),

  feat('knight_of_the_rose', 'Knight of the Rose', '4th level, Squire of Solamnia',
    '+1 Constitution, Wisdom, or Charisma (your choice), to a maximum of 20. Bolstering Rally: as a bonus action, a number of times equal to your proficiency bonus (regaining all on a long rest), you can grant yourself or a creature within 30 feet temporary hit points equal to 1d8 + your proficiency bonus + the modifier of the ability you increased. (The ASI is real. Feats have no mechanism to track a custom resource pool — same gap as this app\'s existing Lucky/Martial Adept feats — so Bolstering Rally\'s uses and temporary hit points aren\'t applied mechanically.)',
    SDQ, [], choose(['con', 'wis', 'cha'])),

  feat('knight_of_the_sword', 'Knight of the Sword', '4th level, Squire of Solamnia',
    '+1 Intelligence, Wisdom, or Charisma (your choice), to a maximum of 20. Demoralizing Strike: once per turn on a weapon hit, a number of times equal to your proficiency bonus (regaining all on a long rest), you can force a Wisdom save (DC 8 + proficiency bonus + the modifier of the ability you increased) or frighten the target, imposing disadvantage on its next attack even on a success. (The ASI is real. Feats have no mechanism to track a custom resource pool — same gap as this app\'s existing Lucky/Martial Adept feats — so Demoralizing Strike\'s uses, save, and frighten effect aren\'t applied mechanically.)',
    SDQ, [], choose(['int', 'wis', 'cha'])),

  feat('lightly_armored', 'Lightly Armored', null,
    '+1 Strength or Dexterity (your choice). You gain proficiency with light armor.',
    PHB, [], choose(['str', 'dex'])),

  feat('linguist', 'Linguist', null,
    '+1 Intelligence. You learn three languages and can create written ciphers.',
    PHB, [abilityBonus('int')]),

  feat('lucky', 'Lucky', null,
    'You have 3 luck points per long rest. Spend one to roll an extra d20 for your own attack roll, ability check, or save, or to force an attacker to reroll.',
    PHB),

  // The reaction attack and imposing disadvantage on the SPELLCASTER's
  // concentration save both stay description-only — no mechanism for one
  // entity's feature debuffing a different creature's stat block.
  feat('mage_slayer', 'Mage Slayer', null,
    'When a creature within 5 feet casts a spell you can use your reaction to attack it. You impose disadvantage on its concentration saves and have advantage on saves against its spells.',
    PHB, [advantage('saving throws against spells cast by a creature within 5 feet')]),

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

  // Redirecting attacks to yourself and the mount's Dex-save damage rule
  // stay description-only — both reactive/active mechanics, not passive
  // stat bonuses.
  feat('mounted_combatant', 'Mounted Combatant', null,
    'Advantage on melee attacks against unmounted creatures smaller than your mount, you can redirect attacks aimed at your mount to yourself, and your mount takes no damage on successful Dex saves (half on failure).',
    PHB, [advantage('melee attacks against unmounted creatures smaller than your mount')]),

  feat('mystic_conflux', 'Mystic Conflux', null,
    'You can attune to up to four magic items instead of three, and can cast Identify once per long rest without a spell slot or material components. (No mechanism for a custom attunement-slot count, and Identify is a leveled spell with no mechanism for a limited-use cast without a slot — neither is applied mechanically.)',
    TOH),

  feat('observant', 'Observant', null,
    '+1 Intelligence or Wisdom (your choice). You can read lips, and you gain a +5 bonus to passive Perception and passive Investigation.',
    PHB, [statBonus('passivePerception', 5), statBonus('passiveInvestigation', 5)], choose(['int', 'wis'])),

  feat('orcish_fury', 'Orcish Fury', 'Half-orc',
    '+1 Strength or Constitution (your choice). Once per short rest, add a weapon damage die when you hit, and you can attack as a reaction after using Relentless Endurance.',
    XGE, [], choose(['str', 'con'])),

  feat('outlands_envoy', 'Outlands Envoy', '4th level, Scion of the Outer Planes (The Outlands)',
    '+1 to one ability score of your choice, to a maximum of 20. Crossroads Emissary: you learn Misty Step and Tongues, each castable once per long rest without a slot, using the ability chosen for Scion of the Outer Planes (Tongues requires no material components when cast this way). (The ASI is real. Both spells are leveled spells with no mechanism for a limited-use cast without a slot — not applied mechanically.)',
    PS, [], choose(ALL_ABILITIES)),

  feat('piercer', 'Piercer', null,
    '+1 Strength or Dexterity (your choice). Once per turn you can reroll a piercing damage die, and a critical hit with a piercing weapon rolls one additional damage die.',
    TCE, [], choose(['str', 'dex'])),

  feat('planar_wanderer', 'Planar Wanderer', '4th level, Scion of the Outer Planes',
    'Planar Adaptation: when you finish a long rest, you gain resistance to acid, cold, or fire (your choice) until your next long rest. Portal Cracker: as an action, you can attempt to force a nearby portal open or shut for 1 hour with an Intelligence (Arcana) check, taking psychic damage on a failure. Portal Sense: you can sense the direction to the last portal you used and detect nearby portals once per long rest. (None of these has an automatable hook — a daily player-chosen resistance, a DC-based portal interaction, and a portal-detection sense are all disclosed, not applied mechanically.)',
    PS),

  feat('poisoner', 'Poisoner', null,
    'You gain proficiency with the poisoner\'s kit, can apply poison as a bonus action, your weapon attacks ignore resistance to poison, and you can craft potent poison.',
    TCE),

  feat('polearm_master', 'Polearm Master', null,
    'When wielding a glaive, halberd, quarterstaff, or spear you can make a bonus-action attack with the opposite end (1d4), and creatures provoke an opportunity attack when entering your reach.',
    PHB),

  // Tool proficiency and language stay description-only — skillChoice is
  // skills-only, no tool/language choice mechanism exists on Feat.
  feat('prodigy', 'Prodigy', 'Half-elf, half-orc, or human',
    'You gain one skill proficiency, one tool proficiency, and one language, plus expertise in one skill you\'re proficient with.',
    XGE, [], undefined, skillPicks([
      { id: 'prodigy_prof',      label: 'Skill proficiency', mode: 'proficiency', from: 'any' },
      { id: 'prodigy_expertise', label: 'Expertise',         mode: 'expertise',  from: 'proficient' },
    ])),

  feat('quicksmithing', 'Quicksmithing', 'Intelligence 13+',
    'You master two ritual-tagged 1st-level spells (from any class list) as short-term device-based effects, using Intelligence, and can learn more over time by study. You also gain proficiency with quicksmith\'s tools, letting you spend 1 hour and 10 gp to build a temporary Tiny clockwork device (a toy, fire starter, or music box), up to three active at once. (The tool proficiency is real. The ritual-spell mimicry and clockwork devices have no automated hook — not applied mechanically.)',
    TOH, [{ type: 'grant_proficiency', target: 'tool:quicksmiths_tools', operation: 'add', value: null, condition: null }]),

  feat('remarkable_recovery', 'Remarkable Recovery', null,
    '+1 Constitution, to a maximum of 20. When you\'re stabilized while dying you regain hit points equal to your Constitution modifier, and whenever you regain hit points from a spell, potion, or class feature (not this feat) you regain additional hit points equal to your Constitution modifier. (The ASI is real. The bonus healing triggers have no automated hook — not applied mechanically.)',
    TOH, [abilityBonus('con')]),

  feat('resilient', 'Resilient', null,
    '+1 to one ability score of your choice, and you gain proficiency in saving throws using that ability.',
    PHB, [], choose(ALL_ABILITIES, 1, true)),

  feat('righteous_heritor', 'Righteous Heritor', '4th level, Scion of the Outer Planes (Good Outer Plane)',
    '+1 to one ability score of your choice, to a maximum of 20. Soothe Pain: as a reaction, a number of times equal to your proficiency bonus (regaining all on a long rest), you can reduce damage to yourself or a creature within 30 feet by 1d10 + your proficiency bonus. (The ASI is real. Feats have no mechanism to track a custom resource pool — same gap as this app\'s existing Lucky/Martial Adept feats — so Soothe Pain\'s uses and damage reduction aren\'t applied mechanically.)',
    PS, [], choose(ALL_ABILITIES)),

  feat('ritual_caster', 'Ritual Caster', 'Intelligence or Wisdom 13+',
    'You acquire a ritual book with two 1st-level ritual spells from a chosen class and can add more rituals you find.',
    PHB),

  feat('rune_shaper', 'Rune Shaper', 'Spellcasting feature or Rune Carver background',
    'You learn Comprehend Languages and can cast a number of 1st-level spells equal to half your proficiency bonus using a rune or spell slot.',
    GG),

  feat('savage_attacker', 'Savage Attacker', null,
    'Once per turn when you roll damage for a melee weapon attack, you can reroll the damage dice and use either total.',
    PHB),

  feat('scion_of_the_outer_planes', 'Scion of the Outer Planes', 'Planescape campaign',
    'Choose an Outer Plane alignment (Chaotic, Evil, Good, Lawful, or the Outlands). You gain resistance to that plane\'s associated damage type and can cast its associated cantrip without material components, using Intelligence, Wisdom, or Charisma (your choice). (Both the resistance and the cantrip depend on a single 5-way plane choice with no fixed value — no mechanism fits a compound choice like this, matching the same gap as this app\'s existing Magic Initiate — not applied mechanically.)',
    PS),

  feat('second_chance', 'Second Chance', 'Halfling',
    '+1 Dexterity, Constitution, or Charisma (your choice). When a creature you can see hits you, you can use your reaction to force it to reroll (once per rest until you do).',
    XGE, [], choose(['dex', 'con', 'cha'])),

  feat('sentinel', 'Sentinel', null,
    'A creature you hit with an opportunity attack has its speed reduced to 0, creatures provoke opportunity attacks even when they Disengage, and you can attack as a reaction when an enemy attacks an ally near you.',
    PHB),

  feat('servo_crafting', 'Servo Crafting', 'Intelligence 13+',
    'You can cast Find Familiar as a ritual to summon a servo — a Tiny construct familiar you can perceive and speak through — instead of the spell\'s normal forms. When you take the Attack action, you can forgo one attack to let your servo make one of its own. (No familiar-summoning mechanism exists — not applied mechanically.)',
    TOH),

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

  feat('spelldriver', 'Spelldriver', 'Character level 11 or higher, Spellcasting or Pact Magic feature',
    'When you cast a spell of 1st level or higher with your bonus action, you can also cast another spell of 1st level or higher with your action that same turn, though only one of the two can be 3rd level or higher. (No mechanism to override the normal one-leveled-spell-per-turn action economy rule — not applied mechanically.)',
    TOH),

  feat('squat_nimbleness', 'Squat Nimbleness', 'Dwarf or a Small race',
    '+1 Strength or Dexterity (your choice). Your speed increases by 5 feet, you gain proficiency in Acrobatics or Athletics, and advantage on checks to escape a grapple.',
    XGE, [statBonus('speed', 5)], choose(['str', 'dex'])),

  feat('squire_of_solamnia', 'Squire of Solamnia', 'Dragonlance campaign, Fighter or Paladin class or Knight of Solamnia background',
    'Mount Up: mounting or dismounting costs only 5 feet of movement. Precise Strike: once per turn, a number of times equal to your proficiency bonus (regaining all on a long rest, expended only on a hit), you can grant one of your weapon attack rolls advantage and add a d8 to the damage if it hits. (Feats have no mechanism to track a custom resource pool — same gap as this app\'s existing Lucky/Martial Adept feats — so neither Mount Up\'s movement discount nor Precise Strike\'s advantage/bonus damage is applied mechanically.)',
    SDQ),

  feat('strike_of_the_giants', 'Strike of the Giants', 'Proficiency with a martial weapon or Giant Foundling background',
    'Choose a giant type. You can deal extra damage and an additional effect (varies by type) when you hit with a weapon attack (proficiency bonus per long rest).',
    GG),

  feat('strixhaven_initiate', 'Strixhaven Initiate', null,
    'Choose one of Strixhaven\'s five colleges (Lorehold, Prismari, Quandrix, Silverquill, or Witherbloom). You learn two of that college\'s cantrips and one of its 1st-level spells, the latter castable once per long rest without a slot, using Intelligence, Wisdom, or Charisma (your choice). (Every spell here depends on a college choice with no fixed value, and the 1st-level spell has no mechanism for a limited-use LEVELED spell without a slot — not applied mechanically.)',
    SCC),

  feat('strixhaven_mascot', 'Strixhaven Mascot', '4th level, Strixhaven Initiate',
    'You can cast Find Familiar as a ritual, taking the form of your chosen college\'s mascot. When you take the Attack action, you can forgo one attack to let your mascot make one of its own with its reaction. If your mascot is within 60 feet, you can teleport to swap places with it as an action, once per long rest (or again by expending a 2nd-level+ spell slot). (No familiar-summoning or swap-teleport mechanism exists — not applied mechanically.)',
    SCC),

  feat('tavern_brawler', 'Tavern Brawler', null,
    '+1 Strength or Constitution (your choice). Proficiency with improvised weapons, your unarmed strikes deal 1d4, and you can grapple as a bonus action after hitting with an unarmed strike or improvised weapon.',
    PHB, [], choose(['str', 'con'])),

  feat('telekinetic', 'Telekinetic', null,
    '+1 Intelligence, Wisdom, or Charisma (your choice). You learn Mage Hand (cast without components) and can telekinetically shove a creature 5 feet as a bonus action.',
    TCE, [], choose(['int', 'wis', 'cha'])),

  feat('telepathic', 'Telepathic', null,
    '+1 Intelligence, Wisdom, or Charisma (your choice). You can speak telepathically to creatures within 60 feet and can cast Detect Thoughts once per long rest without a slot.',
    TCE, [], choose(['int', 'wis', 'cha'])),

  feat('thrown_arms_master', 'Thrown Arms Master', null,
    '+1 Strength or Dexterity (your choice), to a maximum of 20. Simple and martial melee weapons without the thrown property gain it for you (one-handed: 20/60 ft; two-handed: 15/30 ft), weapons that already have it get +20/+40 ft range, and a missed light thrown weapon flies back into your hand at the end of your turn. (The ASI is real. The thrown-property overrides and weapon-range changes have no automated hook — not applied mechanically.)',
    TOH, [], choose(['str', 'dex'])),

  feat('tough', 'Tough', null,
    'Your hit point maximum increases by twice your level when you take this feat, and by 2 every time you gain a level thereafter.',
    PHB),

  feat('vigor_of_the_hill_giant', 'Vigor of the Hill Giant', '4th level, Strike of the Giants (Hill Strike)',
    '+1 Strength, Constitution, or Wisdom. You can\'t be knocked prone unless willing, and when you spend a Hit Die you regain extra HP equal to your Constitution modifier + proficiency bonus.',
    GG, [], choose(['str', 'con', 'wis'])),

  feat('vital_sacrifice', 'Vital Sacrifice', null,
    'As a bonus action, you can take 1d6 necrotic damage (irreducible) to gain a blood boon lasting 1 hour. You can expend it to add a d6 to an attack roll, deal an extra 2d6 necrotic damage on a hit, or reduce a creature\'s Strength, Dexterity, or Constitution save by a d4. (No mechanism for a self-damage-triggered temporary buff with these swap-in effects — not applied mechanically.)',
    BHH),

  // Somatic-components-with-weapon-in-hand and opportunity-attack spellcasting
  // stay description-only — genuinely not representable as a stat effect.
  feat('war_caster', 'War Caster', 'The ability to cast at least one spell',
    'Advantage on concentration saves, you can perform somatic components with weapons or a shield in hand, and you can cast a spell as an opportunity attack.',
    PHB, [advantage('Constitution saving throws to maintain concentration')]),

  feat('weapon_master', 'Weapon Master', null,
    '+1 Strength or Dexterity (your choice). You gain proficiency with four weapons of your choice.',
    PHB, [], choose(['str', 'dex'])),

  feat('wood_elf_magic', 'Wood Elf Magic', 'Elf (wood)',
    'You learn one druid cantrip and can cast Longstrider and Pass Without Trace once per long rest each.',
    XGE),
];

/** Every feat, unfiltered. Prefer ALL_FEATS below in app code. */
export const FULL_FEAT_LIBRARY: Feat[] = allFeatEntries;

const SRD_ONLY = process.env.EXPO_PUBLIC_SRD_ONLY === 'true';

/**
 * The feat list the app should use — filtered to srd === true only on the
 * EAS `production` build profile (see eas.json). Same build-target-aware
 * pattern as spells/subclasses/races/backgrounds. srd is computed
 * automatically per-feat from its source constant (see the feat() helper
 * above) — see the HIGH-STAKES JUDGMENT CALL note on Feat.srd in
 * engine/types.ts before trusting this for a real public release.
 */
export const ALL_FEATS: Feat[] = SRD_ONLY
  ? FULL_FEAT_LIBRARY.filter(f => f.srd === true)
  : FULL_FEAT_LIBRARY;

/** Lookup map: featId → Feat. */
export const FEATS_BY_ID: Record<string, Feat> = Object.fromEntries(
  ALL_FEATS.map(f => [f.id, f]),
);
