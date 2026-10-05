// ============================================================================
// FILE: src/content/classes2024/warlock.ts
// Warlock (2024 rules), System Reference Document 5.2.1 (Creative Commons Attribution 4.0).
// Pact Magic uses the engine's warlock pact-slot table (identical to the SRD's). Eldritch Invocations are a
// real choice (1 at level 1, 3 at 2, 5 at 5, 6 at 7, 7 at 9, 8 at 12, 9 at 15, 10 at 18) from the SRD's
// options; an option's prerequisite is written on it (the picker does not enforce prerequisites) and options
// that name a cantrip (Agonizing Blast, Eldritch Spear, Repelling Blast) leave the cantrip to you. Spell
// invocations add their spell to the sheet. Mystic Arcanum picks (level 6-9 spells) are real choices from the
// Warlock list. Subclass: Fiend Patron.
// ============================================================================
import { ClassDef, classKit, activation } from './builder';
import { ChoiceDefinition, ChoiceOption, Effect, Prerequisite } from '../../engine/types';

const classId = 'warlock_2024';
const k = classKit(classId);
const spell = (id: string): Effect =>
  ({ type: 'grant_spell', target: '', operation: 'add', value: null, condition: null, spellIds: [id], spellcastingAbility: 'cha' });
const resist = (type: string): Effect => ({ type: 'grant_resistance', target: type, operation: 'resistance', value: null, condition: null });

type Inv = { key: string; requires?: Prerequisite[]; name: string; prereq?: string; text: string; effects?: Effect[]; repeatable?: boolean; choices?: ChoiceDefinition[] };
const INVOCATIONS: Inv[] = [
  { key: 'agonizing_blast', requires: [{ kind: 'level', min: 2 }, { kind: 'cantrip', traits: ['damage'], label: 'a Warlock cantrip that deals damage' }], name: 'Agonizing Blast', prereq: 'Level 2+, a damage-dealing Warlock cantrip', repeatable: true, text: 'Choose one of your known Warlock cantrips that deals damage. You can add your Charisma modifier to that spell\'s damage rolls. Repeatable: each time you take it, choose a different eligible cantrip.' },
  { key: 'armor_of_shadows', name: 'Armor of Shadows', text: 'You can cast Mage Armor on yourself without expending a spell slot.', effects: [spell('mage_armor')] },
  { key: 'ascendant_step', requires: [{ kind: 'level', min: 5 }], name: 'Ascendant Step', prereq: 'Level 5+', text: 'You can cast Levitate on yourself without expending a spell slot.', effects: [spell('levitate')] },
  { key: 'devils_sight', requires: [{ kind: 'level', min: 2 }], name: 'Devil\'s Sight', prereq: 'Level 2+', text: 'You can see normally in Dim Light and Darkness, both magical and nonmagical, within 120 feet of yourself.' },
  { key: 'devouring_blade', requires: [{ kind: 'level', min: 12 }, { kind: 'has_option', optionId: 'invocation_thirsting_blade', label: 'Thirsting Blade' }], name: 'Devouring Blade', prereq: 'Level 12+, Thirsting Blade', text: 'The Extra Attack of your Thirsting Blade invocation confers two extra attacks rather than one.' },
  { key: 'eldritch_mind', name: 'Eldritch Mind', text: 'You have Advantage on Constitution saving throws that you make to maintain Concentration.' },
  { key: 'eldritch_smite', requires: [{ kind: 'level', min: 5 }, { kind: 'has_option', optionId: 'invocation_pact_of_the_blade', label: 'Pact of the Blade' }], name: 'Eldritch Smite', prereq: 'Level 5+, Pact of the Blade', text: 'Once per turn when you hit a creature with your pact weapon, you can expend a Pact Magic spell slot to deal an extra 1d8 Force damage to the target, plus another 1d8 per level of the spell slot, and you can give the target the Prone condition if it is Huge or smaller.' },
  { key: 'eldritch_spear', requires: [{ kind: 'level', min: 2 }, { kind: 'cantrip', traits: ['damage', 'range_10_plus'], label: 'a damaging Warlock cantrip with a range of 10+ feet' }], name: 'Eldritch Spear', prereq: 'Level 2+, a damage-dealing Warlock cantrip with a range of 10+ feet', repeatable: true, text: 'Choose one of your known Warlock cantrips that deals damage and has a range of 10+ feet. When you cast that spell, its range increases by a number of feet equal to 30 times your Warlock level. Repeatable: each time you take it, choose a different eligible cantrip.' },
  { key: 'fiendish_vigor', requires: [{ kind: 'level', min: 2 }], name: 'Fiendish Vigor', prereq: 'Level 2+', text: 'You can cast False Life on yourself without expending a spell slot. When you cast the spell with this feature, you don\'t roll the die for the Temporary Hit Points; you automatically get the highest number on the die.', effects: [spell('false_life')] },
  { key: 'gaze_of_two_minds', requires: [{ kind: 'level', min: 5 }], name: 'Gaze of Two Minds', prereq: 'Level 5+', text: 'You can use a Bonus Action to touch a willing creature and perceive through its senses until the end of your next turn. As long as the creature is on the same plane of existence as you, you can take a Bonus Action on subsequent turns to maintain the connection. While perceiving through the other creature\'s senses, you benefit from any special senses it has, and you can cast spells as if you were in your space or its space if you are within 60 feet of each other.' },
  { key: 'gift_of_the_depths', requires: [{ kind: 'level', min: 5 }], name: 'Gift of the Depths', prereq: 'Level 5+', text: 'You can breathe underwater, and you gain a Swim Speed equal to your Speed. You can also cast Water Breathing once without expending a spell slot, regaining the ability to do so when you finish a Long Rest.', effects: [spell('water_breathing')] },
  { key: 'gift_of_the_protectors', requires: [{ kind: 'level', min: 9 }, { kind: 'has_option', optionId: 'invocation_pact_of_the_tome', label: 'Pact of the Tome' }], name: 'Gift of the Protectors', prereq: 'Level 9+, Pact of the Tome', text: 'A new page appears in your Book of Shadows when you conjure it. With your permission, a creature can take an action to write its name on that page, which can contain a number of names equal to your Charisma modifier (minimum of one). When any creature whose name is on the page is reduced to 0 Hit Points but not killed outright, it drops to 1 Hit Point instead. Once this triggers, no creature can benefit from it until you finish a Long Rest. As a Magic action, you can erase a name by touching it.' },
  { key: 'investment_of_the_chain_master', requires: [{ kind: 'level', min: 5 }, { kind: 'has_option', optionId: 'invocation_pact_of_the_chain', label: 'Pact of the Chain' }], name: 'Investment of the Chain Master', prereq: 'Level 5+, Pact of the Chain', text: 'When you cast Find Familiar, you infuse the familiar with eldritch power. Aerial or Aquatic: it gains a Fly Speed or a Swim Speed (your choice) of 40 feet. Quick Attack: as a Bonus Action, you can command it to take the Attack action. Necrotic or Radiant Damage: whenever it deals Bludgeoning, Piercing, or Slashing damage, you can make it deal Necrotic or Radiant damage instead. Your Save DC: if it forces a saving throw, it uses your spell save DC. Resistance: when it takes damage, you can take a Reaction to grant it Resistance against that damage.' },
  { key: 'lessons_of_the_first_ones', requires: [{ kind: 'level', min: 2 }], name: 'Lessons of the First Ones', prereq: 'Level 2+', repeatable: true, text: 'You have received knowledge from an elder entity of the multiverse, allowing you to gain one Origin feat of your choice (take it from the Feats list on your sheet). Repeatable: each time you take it, choose a different Origin feat.' },
  { key: 'lifedrinker', requires: [{ kind: 'level', min: 9 }, { kind: 'has_option', optionId: 'invocation_pact_of_the_blade', label: 'Pact of the Blade' }], name: 'Lifedrinker', prereq: 'Level 9+, Pact of the Blade', text: 'Once per turn when you hit a creature with your pact weapon, you can deal an extra 1d6 Necrotic, Psychic, or Radiant damage (your choice) to the creature, and you can expend one of your Hit Point Dice to roll it and regain a number of Hit Points equal to the roll plus your Constitution modifier (minimum of 1 Hit Point).' },
  { key: 'mask_of_many_faces', requires: [{ kind: 'level', min: 2 }], name: 'Mask of Many Faces', prereq: 'Level 2+', text: 'You can cast Disguise Self without expending a spell slot.', effects: [spell('disguise_self')] },
  { key: 'master_of_myriad_forms', requires: [{ kind: 'level', min: 5 }], name: 'Master of Myriad Forms', prereq: 'Level 5+', text: 'You can cast Alter Self without expending a spell slot.', effects: [spell('alter_self')] },
  { key: 'misty_visions', requires: [{ kind: 'level', min: 2 }], name: 'Misty Visions', prereq: 'Level 2+', text: 'You can cast Silent Image without expending a spell slot.', effects: [spell('silent_image')] },
  { key: 'one_with_shadows', requires: [{ kind: 'level', min: 5 }], name: 'One with Shadows', prereq: 'Level 5+', text: 'While you\'re in an area of Dim Light or Darkness, you can cast Invisibility on yourself without expending a spell slot.', effects: [spell('invisibility')] },
  { key: 'otherworldly_leap', requires: [{ kind: 'level', min: 2 }], name: 'Otherworldly Leap', prereq: 'Level 2+', text: 'You can cast Jump on yourself without expending a spell slot.', effects: [spell('jump')] },
  { key: 'pact_of_the_blade', name: 'Pact of the Blade', text: 'As a Bonus Action, you can conjure a pact weapon in your hand (a Simple or Martial Melee weapon of your choice with which you bond), or create a bond with a magic weapon you touch. Until the bond ends, you have proficiency with the weapon and can use it as a Spellcasting Focus. Whenever you attack with it, you can use your Charisma modifier for the attack and damage rolls instead of Strength or Dexterity, and you can cause it to deal Necrotic, Psychic, or Radiant damage or its normal damage type. The bond ends if you use this Bonus Action again, if the weapon is more than 5 feet away from you for 1 minute or more, or if you die.' },
  { key: 'pact_of_the_chain', name: 'Pact of the Chain', text: 'You learn the Find Familiar spell and can cast it as a Magic action without expending a spell slot. When you cast it you choose one of the normal forms or a special form: Imp, Pseudodragon, Quasit, Skeleton, Sphinx of Wonder, Sprite, or Venomous Snake. Additionally, when you take the Attack action, you can forgo one of your own attacks to allow your familiar to make one attack with its Reaction.', effects: [spell('find_familiar')] },
  { key: 'pact_of_the_tome', name: 'Pact of the Tome', choices: [
    k.spellsFrom('tome_cantrips', 3, 'Pact of the Tome: choose three cantrips from any class spell list.', { lists: 'any', label: 'Book of Shadows cantrips (any list)' }),
    k.spellsFrom('tome_rituals', 2, 'Pact of the Tome: choose two level 1 spells that have the Ritual tag, from any class spell list.', { lists: 'any', levels: [1], ritualOnly: true, label: 'Book of Shadows rituals (any list)' }),
  ], text: 'You conjure a Book of Shadows in your hand at the end of a Short or Long Rest. When the book appears, choose three cantrips and two level 1 spells that have the Ritual tag, from any class\'s spell list, that you don\'t already have prepared. While the book is on your person, you have them prepared and they function as Warlock spells for you. You can use the book as a Spellcasting Focus. The book disappears if you conjure another one or if you die.' },
  { key: 'repelling_blast', requires: [{ kind: 'level', min: 2 }, { kind: 'cantrip', traits: ['attack_roll'], label: 'a Warlock cantrip that requires an attack roll' }], name: 'Repelling Blast', prereq: 'Level 2+, a Warlock cantrip that requires an attack roll', repeatable: true, text: 'Choose one of your known Warlock cantrips that requires an attack roll. When you hit a Large or smaller creature with that cantrip, you can push the creature up to 10 feet straight away from you. Repeatable: each time you take it, choose a different eligible cantrip.' },
  { key: 'thirsting_blade', requires: [{ kind: 'level', min: 5 }, { kind: 'has_option', optionId: 'invocation_pact_of_the_blade', label: 'Pact of the Blade' }], name: 'Thirsting Blade', prereq: 'Level 5+, Pact of the Blade', text: 'You gain the Extra Attack feature for your pact weapon only: you can attack twice with it instead of once when you take the Attack action on your turn.' },
  { key: 'visions_of_distant_realms', requires: [{ kind: 'level', min: 9 }], name: 'Visions of Distant Realms', prereq: 'Level 9+', text: 'You can cast Arcane Eye without expending a spell slot.', effects: [spell('arcane_eye')] },
  { key: 'whispers_of_the_grave', requires: [{ kind: 'level', min: 7 }], name: 'Whispers of the Grave', prereq: 'Level 7+', text: 'You can cast Speak with Dead without expending a spell slot.', effects: [spell('speak_with_dead')] },
  { key: 'witch_sight', requires: [{ kind: 'level', min: 15 }], name: 'Witch Sight', prereq: 'Level 15+', text: 'You have Truesight with a range of 30 feet.',
    effects: [{ type: 'grant_sense', target: 'sense', operation: 'add', value: null, condition: null, senseType: 'truesight', senseRange: 30 }] },
];

const invocationOptions = (kit: ReturnType<typeof classKit>, level: number): ChoiceOption[] =>
  INVOCATIONS.map(i => kit.option(`invocation_${i.key}`, i.name, level,
    `${i.prereq ? `Prerequisite: ${i.prereq}. ` : ''}${i.text}`, { ...(i.effects ? { effects: i.effects } : {}), ...(i.choices ? { grantsChoices: i.choices } : {}), ...(i.requires ? { requires: i.requires } : {}) })).map((o, n) => ({ ...o, label: INVOCATIONS[n].prereq ? `${INVOCATIONS[n].name} (${INVOCATIONS[n].prereq})` : INVOCATIONS[n].name }));

const invocationChoice = (level: number, count: number) =>
  k.pick(`invocations_${level}`, count === 1 ? 'Eldritch Invocations: choose one invocation.' : `Eldritch Invocations: choose ${count} more invocations.`, count, invocationOptions(k, level), { timing: 'level_up', rule: 'Whenever you gain a Warlock level, you can replace one of your invocations with another one for which you qualify, unless it is a prerequisite for another invocation you have.' });

const ARCANUM: [number, number][] = [[11, 6], [13, 7], [15, 8], [17, 9]];
const DAMAGE_TYPES = ['acid', 'bludgeoning', 'cold', 'fire', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'];

export const warlock2024: ClassDef = {
  key: 'warlock', name: 'Warlock', hitDie: 8, savingThrows: ['wis', 'cha'],
  description: 'A wielder of magic derived from a bargain with an extraplanar entity. (2024 rules.)',
  armorProfs: ['light'], weaponProfs: ['simple'],
  startingProficiency: { armor: ['light'], weapons: ['simple'] },
  multiclass: { armor: ['light'] },
  asiLevels: [4, 8, 12, 16, 19],
  caster: {
    ability: 'cha', style: 'pact', policy: 'known',
    cantrips: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
    prepared: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
  },
  levels: {
    1: {
      choices: [
        k.skills(2, ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion']),
        k.equip('start', 'Starting equipment: (A) Leather Armor, Sickle, 2 Daggers, Arcane Focus (orb), Book (occult lore), Scholar\'s Pack, and 15 GP; or (B) 100 GP.', [
          { id: 'a', label: 'A: Leather Armor, Sickle, 2 Daggers, Arcane Focus (orb), Book, Scholar\'s Pack, 15 GP', items: ['leather_armor', 'sickle', 'dagger', 'dagger', 'arcane_focus_orb', 'book', 'scholars_pack'], gold: 15 },
          { id: 'b', label: 'B: 100 GP', items: [], gold: 100 },
        ]),
        invocationChoice(1, 1),
      ],
      grants: [
        k.g('eldritch_invocations', 'Eldritch Invocations', 1, 'You have unearthed Eldritch Invocations, pieces of forbidden knowledge that imbue you with an abiding magical ability or other lessons. You gain one invocation at level 1, three at level 2, and more at levels 5 (5), 7 (6), 9 (7), 12 (8), 15 (9) and 18 (10). Whenever you gain a Warlock level, you can replace one of your invocations with another one for which you qualify (swap it on the Features tab), unless it is a prerequisite for another invocation you have. You can\'t pick the same invocation more than once unless its description says otherwise.'),
        k.g('pact_magic', 'Pact Magic', 1, 'Through occult ceremony, you have formed a pact with a mysterious entity to gain magical powers. You cast spells using Charisma as your spellcasting ability, from a small number of spell slots that are all the same level and that you regain when you finish a Short or Long Rest. You know two Warlock cantrips (a third at level 4, a fourth at level 10) and prepare the number of level 1+ Warlock spells shown in the Prepared Spells column, of a level no higher than your slot level. Whenever you gain a Warlock level you can replace one cantrip and one prepared spell. You can use an Arcane Focus as a Spellcasting Focus.'),
      ],
    },
    2: {
      choices: [invocationChoice(2, 2)],
      grants: [
        k.g('magical_cunning', 'Magical Cunning', 2, 'You can perform an esoteric rite for 1 minute. At the end of it, you regain expended Pact Magic spell slots, but no more than a number equal to half your maximum (round up). Once you use this feature, you can\'t do so again until you finish a Long Rest.',
          { activation: activation('free', { resource: 'magical_cunning' }), tags: ['utility'] }),
        k.pool('magical_cunning', 'Magical Cunning', 1, 'long_rest'),
      ],
    },
    3: { choices: [k.subclassChoice('Warlock Subclass')], grants: [k.g('subclass', 'Warlock Subclass', 3, 'You gain a Warlock subclass of your choice.')] },
    5: { choices: [invocationChoice(5, 2)] },
    7: { choices: [invocationChoice(7, 1)] },
    9: { choices: [invocationChoice(9, 1)], grants: [
      k.g('contact_patron', 'Contact Patron', 9, 'You always have the Contact Other Plane spell prepared. You can cast the spell without expending a spell slot to contact your patron, and you automatically succeed on its saving throw. Once you cast it this way, you can\'t do so again until you finish a Long Rest.',
        { activation: activation('free', { resource: 'contact_patron' }), tags: ['utility'] }),
      k.pool('contact_patron', 'Contact Patron (free Contact Other Plane)', 1, 'long_rest'),
      { kind: 'known_spells', value: { spellIds: ['contact_other_plane'] } },
    ] },
    ...Object.fromEntries(ARCANUM.map(([lvl, spellLevel]) => [lvl, { grants: [
      k.g(`mystic_arcanum_${spellLevel}`, `Mystic Arcanum (level ${spellLevel})`, lvl, `Your patron grants you a magical secret called an arcanum. Choose one level ${spellLevel} Warlock spell as this arcanum. You can cast it once without expending a spell slot, and you must finish a Long Rest before you can cast it this way again. Whenever you gain a Warlock level you can replace an arcanum spell with another Warlock spell of the same level.`,
        { activation: activation('free', { resource: `mystic_arcanum_${spellLevel}` }), tags: ['utility'],
          grantsChoices: [k.spellsFrom(`arcanum_${spellLevel}`, 1, `Mystic Arcanum: choose one level ${spellLevel} Warlock spell.`, { lists: ['warlock_2024'], levels: [spellLevel], ignoreSlotCap: true, label: `Mystic Arcanum (level ${spellLevel} Warlock spell)` })] }),
      k.pool(`mystic_arcanum_${spellLevel}`, `Mystic Arcanum (level ${spellLevel}, free cast)`, 1, 'long_rest'),
    ] }])),
    12: { choices: [invocationChoice(12, 1)] },
    15: { choices: [invocationChoice(15, 1)] },
    18: { choices: [invocationChoice(18, 1)] },
    20: { grants: [k.g('eldritch_master', 'Eldritch Master', 20, 'When you use your Magical Cunning feature, you regain all your expended Pact Magic spell slots.')] },
  },
  subclass: {
    id: 'fiend_2024', name: 'Fiend Patron',
    entries: kit => [
      { level: 3, grants: [
        kit.g('fiend_dark_ones_blessing', 'Dark One\'s Blessing', 3, 'When you reduce an enemy to 0 Hit Points, you gain Temporary Hit Points equal to your Charisma modifier plus your Warlock level (minimum of 1 Temporary Hit Point). You also gain this benefit if someone else reduces an enemy within 10 feet of you to 0 Hit Points.',
          { trigger: 'You reduce an enemy to 0 Hit Points.', tags: ['utility'] }),
        kit.g('fiend_spells', 'Fiend Spells', 3, 'You always have certain spells prepared: Burning Hands, Command, Scorching Ray and Suggestion (level 3); Fireball and Stinking Cloud (level 5); Fire Shield and Wall of Fire (level 7); Geas and Insect Plague (level 9). They don\'t count against your prepared spells.'),
        { kind: 'known_spells', value: { spellIds: ['burning_hands', 'command', 'scorching_ray', 'suggestion'] } },
      ] },
      { level: 5, grants: [{ kind: 'known_spells', value: { spellIds: ['fireball', 'stinking_cloud'] } }] },
      { level: 6, grants: [
        kit.g('fiend_dark_ones_own_luck', 'Dark One\'s Own Luck', 6, 'When you make an ability check or a saving throw, you can add 1d10 to your roll. You can do so after seeing the roll but before any of the roll\'s effects occur. You can use this feature a number of times equal to your Charisma modifier (minimum of once), but no more than once per roll. You regain all expended uses when you finish a Long Rest.',
          { activation: activation('free', { resource: 'dark_ones_own_luck' }), tags: ['utility'] }),
        { kind: 'resource', value: { resourceId: 'dark_ones_own_luck', name: 'Dark One\'s Own Luck', maximum: 1, recharge: 'long_rest', perAbilityModifier: 'cha' } },
      ] },
      { level: 7, grants: [{ kind: 'known_spells', value: { spellIds: ['fire_shield', 'wall_of_fire'] } }] },
      { level: 9, grants: [{ kind: 'known_spells', value: { spellIds: ['geas', 'insect_plague'] } }] },
      { level: 10, choices: [kit.pick('fiendish_resilience', 'Fiendish Resilience: choose one damage type (other than Force). Whenever you finish a Short or Long Rest you can choose a different one (swap it on the Features tab).', 1,
          DAMAGE_TYPES.map(t => kit.option(`fiendish_resilience_${t}`, t[0].toUpperCase() + t.slice(1), 10, `You have Resistance to ${t} damage until you choose a different type with this feature.`, { effects: [resist(t)] })), { timing: 'rest', rule: 'Whenever you finish a Short or Long Rest, you can choose a different damage type.' })],
        grants: [kit.g('fiend_fiendish_resilience', 'Fiendish Resilience', 10, 'Choose one damage type, other than Force, whenever you finish a Short or Long Rest. You have Resistance to that damage type until you choose a different one with this feature.')] },
      { level: 14, grants: [
        kit.g('fiend_hurl_through_hell', 'Hurl Through Hell', 14, 'Once per turn when you hit a creature with an attack roll, you can try to instantly transport the target through the Lower Planes. The target must succeed on a Charisma saving throw against your spell save DC, or it disappears and hurtles through a nightmare landscape. The target takes 8d10 Psychic damage if it isn\'t a Fiend, and it has the Incapacitated condition until the end of your next turn, when it returns to the space it previously occupied or the nearest unoccupied space. Once you use this feature, you can\'t use it again until you finish a Long Rest unless you expend a Pact Magic spell slot (no action required) to restore your use of it.',
          { activation: activation('free', { resource: 'hurl_through_hell', range: 'weapon', target: 'single', requiresSave: { ability: 'cha', dc: 'spell_save_dc' } }),
            abilityEffects: [{ type: 'damage', dice: '8d10', damageType: 'psychic' }], tags: ['damage', 'control', 'save'] }),
        { kind: 'resource', value: { resourceId: 'hurl_through_hell', name: 'Hurl Through Hell', maximum: 1, recharge: 'long_rest' } },
      ] },
    ],
  },
};
