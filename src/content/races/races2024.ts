// ============================================================================
// FILE: src/content/races/races2024.ts
// The species of the System Reference Document 5.2.1 (2024 rules / 5.5e): Dragonborn, Dwarf, Elf, Gnome,
// Goliath, Halfling, Orc, Tiefling (Human already exists as human_2024). SRD 5.2.1 is Creative Commons
// Attribution 4.0: "This work includes material from the System Reference Document 5.2.1 by Wizards of
// the Coast LLC". Tagged rulesetId 'dnd5e-2024'; `srd` stays false because that flag here means SRD 5.1.
//
// 2024 species have no ability-score bonus (the background grants it). What the engine now does for them:
//   - level-gated traits (Draconic Flight, Large Form, the lineage spells at 3 and 5): a trait carries its
//     unlock `level`; its effects and its action card stay off until the character reaches it.
//   - uses equal to the proficiency bonus: pools that follow PB (Breath Weapon, Stonecunning, ...).
//   - scaling damage (Breath Weapon 1d10 -> 4d10 at levels 5/11/17) through AbilityEffect.diceByLevel.
//   - Dwarven Toughness as +1 maximum HP per character level.
//
// The Elf, Gnome and Tiefling ask which of Intelligence, Wisdom or Charisma is the spellcasting ability for their
// lineage spells (spellAbilityChoice.ts; the species' usual one is the default until chosen). The level 3 and 5
// lineage spells are always prepared, castable once per Long Rest from their action cards and with spell slots.
// Tiefling and Human (Small or Medium) size is a Small/Medium choice. Languages are not a species trait in
// the 2024 rules and are not granted here.
// ============================================================================
import {
  Race, Subrace, Feature, Effect, ResourceGrant, AncestryOption, ChoiceDefinition, RulesetId, RACE_CHOICE_PREFIX,
} from '../../engine/types';
import { feature, activation, adv } from '../homebrewPack/helpers';
import { spellAbilityChoice } from '../spellAbilityChoice';

const RULESET = 'dnd5e-2024' as RulesetId;
const CC = 'dnd5e-2024';
void CC;

type Ability = 'int' | 'wis' | 'cha';

// ── constructors ─────────────────────────────────────────────────────────────

const mk = (raceId: string) => ({
  trait: (id: string, name: string, description: string, extra: Partial<Parameters<typeof feature>[0]> = {}): Feature =>
    feature({ id: `${raceId}_${id}`, name, description, source: { kind: 'race', refId: raceId }, ...extra }),
});

const darkvision = (range: number): Effect =>
  ({ type: 'grant_sense', target: 'sense', operation: 'add', value: null, condition: null, senseType: 'darkvision', senseRange: range });
const resist = (type: string): Effect => ({ type: 'grant_resistance', target: type, operation: 'resistance', value: null, condition: null });
const speed = (n: number): Effect => ({ type: 'stat_modifier', target: 'speed', operation: 'set', value: n, condition: null });
// `from` names the spellcasting-ability choice the species asks for (spellAbilityChoice.ts); `ability` is the default until it is made.
const cantrip = (id: string, ability: Ability, from?: string): Effect =>
  ({ type: 'grant_spell', target: '', operation: 'add', value: null, condition: null, cantripIds: [id], spellcastingAbility: ability, ...(from ? { spellcastingAbilityFrom: from } : {}) });
const spell = (id: string, ability: Ability, from?: string): Effect =>
  ({ type: 'grant_spell', target: '', operation: 'add', value: null, condition: null, spellIds: [id], spellcastingAbility: ability, ...(from ? { spellcastingAbilityFrom: from } : {}) });
const abilityChoice = (raceId: string, fallback: Ability): ChoiceDefinition => spellAbilityChoice({
  choiceId: `${RACE_CHOICE_PREFIX}${raceId}_spell_ability`, from: `${raceId}_spell_ability`, source: { kind: 'race', refId: raceId }, what: 'your lineage spells', fallback,
});

const pbPool = (id: string, name: string, recharge: 'long_rest' | 'short_rest' = 'long_rest'): ResourceGrant =>
  ({ resourceId: id, name, maximum: 2, recharge, perProficiencyBonus: true });
const onePool = (id: string, name: string): ResourceGrant => ({ resourceId: id, name, maximum: 1, recharge: 'long_rest' });

const nameOf = (id: string) => id.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');

/** A level-gated "cast this spell once per Long Rest" trait (the lineage spells at levels 3 and 5). */
function lineageSpell(raceId: string, tag: string, level: 3 | 5, spellId: string, ability: Ability): Feature {
  return feature({
    id: `${raceId}_${tag}_${spellId}`, name: `${nameOf(spellId)} (level ${level})`, level,
    description: `At character level ${level} you learn ${nameOf(spellId)}: you always have it prepared. You can cast it once without a spell slot and regain that use when you finish a Long Rest, and you can also cast it with any spell slots you have. The spellcasting ability you chose for your lineage spells is your spellcasting ability for it.`,
    source: { kind: 'race', refId: raceId },
    effects: [{ ...spell(spellId, ability, `${raceId}_spell_ability`), minLevel: level }],
    activation: activation('action', { resource: `${raceId}_lineage_${level}`, range: 'varies', target: 'single' }),
    abilityEffects: [{ type: 'cast_spell', spellId }],
  });
}

const lineagePools = (raceId: string): ResourceGrant[] => [
  onePool(`${raceId}_lineage_3`, 'Lineage spell (level 3)'),
  onePool(`${raceId}_lineage_5`, 'Lineage spell (level 5)'),
];

const sizeSubraces = (raceId: string): Subrace[] => (['Medium', 'Small'] as const).map(size => ({
  id: `${raceId}_${size.toLowerCase()}`, name: `${size}`, parentId: raceId, size,
  features: [feature({ id: `${raceId}_size_${size.toLowerCase()}`, name: `Size: ${size}`, description: `You are ${size}.`, source: { kind: 'race', refId: raceId } })],
}));

const keenSensesChoice = (raceId: string): ChoiceDefinition => ({
  id: `${RACE_CHOICE_PREFIX}${raceId}_keen_senses`, prompt: 'Keen Senses: choose Insight, Perception, or Survival proficiency.',
  kind: 'feature_pool', count: 1, grants: [], required: true, resolved: false,
  pool: ['insight', 'perception', 'survival'].map(s => ({
    id: `${raceId}_keen_${s}`, label: nameOf(s),
    value: feature({
      id: `${raceId}_keen_senses_${s}`, name: `Keen Senses: ${nameOf(s)}`, description: `You have proficiency in ${nameOf(s)}.`,
      source: { kind: 'race', refId: raceId },
      effects: [{ type: 'grant_proficiency', target: `skill:${s}`, operation: 'add', value: null, condition: null }],
    }),
  })),
});

// ── Dragonborn ───────────────────────────────────────────────────────────────

const DRAGONS: [string, string][] = [
  ['black', 'acid'], ['blue', 'lightning'], ['brass', 'fire'], ['bronze', 'lightning'], ['copper', 'acid'],
  ['gold', 'fire'], ['green', 'poison'], ['red', 'fire'], ['silver', 'cold'], ['white', 'cold'],
];

const dragonbornAncestry: AncestryOption[] = DRAGONS.map(([dragon, damage]) => ({
  id: dragon, name: `${nameOf(dragon)} (${nameOf(damage)})`,
  blurb: `${nameOf(damage)} Breath Weapon and ${nameOf(damage)} resistance.`,
  feature: feature({
    id: `dragonborn_2024_ancestry_${dragon}`, name: `Draconic Ancestry: ${nameOf(dragon)}`,
    description:
      `Your lineage stems from a ${dragon} dragon. Breath Weapon: when you take the Attack action on your turn, you can replace one of your attacks with an exhalation of magical energy in either a 15-foot Cone or a 30-foot Line that is 5 feet wide (choose the shape each time). Each creature in that area makes a Dexterity saving throw (DC 8 plus your Constitution modifier and Proficiency Bonus), taking 1d10 ${damage} damage on a failed save and half as much on a success. The damage increases by 1d10 at character levels 5 (2d10), 11 (3d10) and 17 (4d10). You can use it a number of times equal to your Proficiency Bonus and regain all uses on a Long Rest. Damage Resistance: you have Resistance to ${damage} damage.`,
    source: { kind: 'race', refId: 'dragonborn_2024' },
    effects: [resist(damage)],
    activation: activation('action', { resource: 'dragonborn_2024_breath', range: '15-foot cone or 30-foot line', target: 'area', requiresSave: { ability: 'dex', dc: { ability: 'con' } } }),
    abilityEffects: [{
      type: 'damage', dice: '1d10', damageType: damage, saveOnSuccess: 'half',
      diceByLevel: [{ level: 5, dice: '2d10' }, { level: 11, dice: '3d10' }, { level: 17, dice: '4d10' }],
    }],
    tags: ['damage', 'aoe', 'save'],
  }),
}));

const D = mk('dragonborn_2024');
export const raceDragonborn2024: Race = {
  id: 'dragonborn_2024', name: 'Dragonborn', rulesetId: RULESET, srd: false, size: 'Medium', languages: ['Common'],
  description: 'Humanoids whose lineage stems from a dragon progenitor. (2024 rules.)',
  resources: [pbPool('dragonborn_2024_breath', 'Breath Weapon'), onePool('dragonborn_2024_flight', 'Draconic Flight')],
  ancestryChoice: { prompt: 'Draconic Ancestry: choose the kind of dragon (it decides your Breath Weapon and Damage Resistance).', options: dragonbornAncestry },
  features: [
    D.trait('darkvision', 'Darkvision', 'You have Darkvision with a range of 60 feet.', { effects: [darkvision(60)] }),
    D.trait('flight', 'Draconic Flight', 'When you reach character level 5, you can channel draconic magic to give yourself temporary flight. As a Bonus Action, you sprout spectral wings that last for 10 minutes or until you retract them (no action required) or have the Incapacitated condition. During that time you have a Fly Speed equal to your Speed. Once you use this trait you can\'t use it again until you finish a Long Rest.',
      { level: 5, activation: activation('bonus_action', { resource: 'dragonborn_2024_flight' }), tags: ['movement', 'buff'] }),
  ],
};

// ── Dwarf ────────────────────────────────────────────────────────────────────

const DW = mk('dwarf_2024');
export const raceDwarf2024: Race = {
  id: 'dwarf_2024', name: 'Dwarf', rulesetId: RULESET, srd: false, size: 'Medium', languages: ['Common'],
  description: 'Stout folk of stone and forge. (2024 rules.)',
  resources: [pbPool('dwarf_2024_stonecunning', 'Stonecunning')],
  features: [
    DW.trait('darkvision', 'Darkvision', 'You have Darkvision with a range of 120 feet.', { effects: [darkvision(120)] }),
    DW.trait('resilience', 'Dwarven Resilience', 'You have Resistance to Poison damage. You also have Advantage on saving throws you make to avoid or end the Poisoned condition.',
      { effects: [resist('poison'), adv('saving throws to avoid or end the Poisoned condition')] }),
    DW.trait('toughness', 'Dwarven Toughness', 'Your Hit Point maximum increases by 1, and it increases by 1 again whenever you gain a level.',
      { effects: [{ type: 'stat_modifier', target: 'max_hp', operation: 'add', value: 0, addPerLevel: 1, condition: null }] }),
    DW.trait('stonecunning', 'Stonecunning', 'As a Bonus Action, you gain Tremorsense with a range of 60 feet for 10 minutes. You must be on a stone surface or touching a stone surface to use this Tremorsense; the stone can be natural or worked. You can use this Bonus Action a number of times equal to your Proficiency Bonus, and regain all uses on a Long Rest.',
      { activation: activation('bonus_action', { resource: 'dwarf_2024_stonecunning' }), tags: ['utility'] }),
  ],
};

// ── Elf ──────────────────────────────────────────────────────────────────────

const E = mk('elf_2024');
const ELF_AB: Ability = 'wis';
const elfLineage = (id: string, name: string, blurb: string, desc: string, extra: Effect[], s3: string, s5: string): AncestryOption => ({
  id, name, blurb,
  feature: E.trait(`lineage_${id}`, `Elven Lineage: ${name}`,
    `${desc} At character levels 3 and 5 you learn a higher-level spell (see the level 3 and level 5 traits). The spellcasting ability you choose (Intelligence, Wisdom, or Charisma) is your spellcasting ability for these spells.`,
    { effects: extra }),
});
const elfLineageSpells: Feature[] = [
  ['drow', 'faerie_fire', 'darkness'], ['high_elf', 'detect_magic', 'misty_step'], ['wood_elf', 'longstrider', 'pass_without_trace'],
].flatMap(([lin, a, b]) => [lineageSpell('elf_2024', lin, 3, a, ELF_AB), lineageSpell('elf_2024', lin, 5, b, ELF_AB)]);

export const raceElf2024: Race = {
  id: 'elf_2024', name: 'Elf', rulesetId: RULESET, srd: false, size: 'Medium', languages: ['Common'],
  description: 'Graceful, long-lived folk of fey descent. (2024 rules.)',
  resources: lineagePools('elf_2024'),
  pendingChoices: [keenSensesChoice('elf_2024'), abilityChoice('elf_2024', ELF_AB)],
  ancestryChoice: {
    prompt: 'Elven Lineage: choose a lineage.',
    options: [
      elfLineage('drow', 'Drow', 'Darkvision 120 ft., Dancing Lights, Faerie Fire (3), Darkness (5).', 'The range of your Darkvision increases to 120 feet. You also know the Dancing Lights cantrip.', [darkvision(120), cantrip('dancing_lights', ELF_AB, 'elf_2024_spell_ability')], 'faerie_fire', 'darkness'),
      elfLineage('high_elf', 'High Elf', 'Prestidigitation, Detect Magic (3), Misty Step (5).', 'You know the Prestidigitation cantrip. Whenever you finish a Long Rest you can replace that cantrip with a different cantrip from the Wizard spell list.', [cantrip('prestidigitation', ELF_AB, 'elf_2024_spell_ability')], 'detect_magic', 'misty_step'),
      elfLineage('wood_elf', 'Wood Elf', 'Speed 35 ft., Druidcraft, Longstrider (3), Pass without Trace (5).', 'Your Speed increases to 35 feet. You also know the Druidcraft cantrip.', [speed(35), cantrip('druidcraft', ELF_AB, 'elf_2024_spell_ability')], 'longstrider', 'pass_without_trace'),
    ],
  },
  features: [
    E.trait('darkvision', 'Darkvision', 'You have Darkvision with a range of 60 feet.', { effects: [darkvision(60)] }),
    E.trait('fey_ancestry', 'Fey Ancestry', 'You have Advantage on saving throws you make to avoid or end the Charmed condition.', { effects: [adv('saving throws to avoid or end the Charmed condition')] }),
    E.trait('trance', 'Trance', 'You don\'t need to sleep, and magic can\'t put you to sleep. You can finish a Long Rest in 4 hours if you spend those hours in a trancelike meditation, during which you retain consciousness.'),
    ...elfLineageSpells,
  ],
};

// ── Gnome ────────────────────────────────────────────────────────────────────

const G = mk('gnome_2024');
const GN_AB: Ability = 'int';
export const raceGnome2024: Race = {
  id: 'gnome_2024', name: 'Gnome', rulesetId: RULESET, srd: false, size: 'Small', languages: ['Common'],
  description: 'Small, curious inventors and illusionists. (2024 rules.)',
  resources: [pbPool('gnome_2024_speak', 'Speak with Animals')],
  pendingChoices: [abilityChoice('gnome_2024', GN_AB)],
  ancestryChoice: {
    prompt: 'Gnomish Lineage: choose Forest Gnome or Rock Gnome (you also choose its spellcasting ability).',
    options: [
      {
        id: 'forest', name: 'Forest Gnome', blurb: 'Minor Illusion; Speak with Animals (Proficiency Bonus times per Long Rest).',
        feature: G.trait('lineage_forest', 'Gnomish Lineage: Forest Gnome',
          'You know the Minor Illusion cantrip. You also always have the Speak with Animals spell prepared. You can cast it without a spell slot a number of times equal to your Proficiency Bonus, regaining all uses on a Long Rest, and you can also cast it with any spell slots you have. Intelligence is your spellcasting ability for these spells.',
          { effects: [cantrip('minor_illusion', GN_AB, 'gnome_2024_spell_ability'), spell('speak_with_animals', GN_AB, 'gnome_2024_spell_ability')],
            activation: activation('action', { resource: 'gnome_2024_speak', range: '30 feet', target: 'single' }),
            abilityEffects: [{ type: 'cast_spell', spellId: 'speak_with_animals' }] }),
      },
      {
        id: 'rock', name: 'Rock Gnome', blurb: 'Mending, Prestidigitation, and Tiny clockwork devices.',
        feature: G.trait('lineage_rock', 'Gnomish Lineage: Rock Gnome',
          'You know the Mending and Prestidigitation cantrips. In addition, you can spend 10 minutes casting Prestidigitation to create a Tiny clockwork device (AC 5, 1 HP), such as a toy, fire starter, or music box. When you create it you choose one effect from Prestidigitation; the device produces that effect whenever you or another creature takes a Bonus Action to activate it with a touch. You can have three such devices at a time; each falls apart 8 hours after creation or when you dismantle it with a touch as a Utilize action. Intelligence is your spellcasting ability for these spells.',
          { effects: [cantrip('mending', GN_AB, 'gnome_2024_spell_ability'), cantrip('prestidigitation', GN_AB, 'gnome_2024_spell_ability')] }),
      },
    ],
  },
  features: [
    G.trait('darkvision', 'Darkvision', 'You have Darkvision with a range of 60 feet.', { effects: [darkvision(60)] }),
    G.trait('cunning', 'Gnomish Cunning', 'You have Advantage on Intelligence, Wisdom, and Charisma saving throws.',
      { effects: [adv('Intelligence, Wisdom, and Charisma saving throws')] }),
  ],
};

// ── Goliath ──────────────────────────────────────────────────────────────────

const GO = mk('goliath_2024');
const giant = (id: string, name: string, blurb: string, desc: string, act: Parameters<typeof activation>[0], ae?: Feature['abilityEffects'], trigger?: string): AncestryOption => ({
  id, name, blurb,
  feature: GO.trait(`ancestry_${id}`, `Giant Ancestry: ${name}`, `${desc} You can use this benefit a number of times equal to your Proficiency Bonus, regaining all uses on a Long Rest.`,
    { activation: activation(act, { resource: 'goliath_2024_giant' }), abilityEffects: ae, trigger, tags: ['utility'] }),
});
export const raceGoliath2024: Race = {
  id: 'goliath_2024', name: 'Goliath', rulesetId: RULESET, srd: false, size: 'Medium', languages: ['Common'],
  description: 'Towering folk descended from giants. (2024 rules.)',
  resources: [pbPool('goliath_2024_giant', 'Giant Ancestry'), onePool('goliath_2024_large', 'Large Form')],
  ancestryChoice: {
    prompt: 'Giant Ancestry: choose one supernatural boon from your giant ancestry.',
    options: [
      giant('cloud', "Cloud's Jaunt (Cloud Giant)", 'Teleport 30 ft. as a Bonus Action.', 'As a Bonus Action, you magically teleport up to 30 feet to an unoccupied space you can see.', 'bonus_action'),
      giant('fire', "Fire's Burn (Fire Giant)", '+1d10 Fire damage on a hit.', 'When you hit a target with an attack roll and deal damage to it, you can also deal 1d10 Fire damage to that target.', 'free', [{ type: 'damage', dice: '1d10', damageType: 'fire' }], 'You hit a target with an attack roll and deal damage to it.'),
      giant('frost', "Frost's Chill (Frost Giant)", '+1d6 Cold damage and -10 ft. Speed.', 'When you hit a target with an attack roll and deal damage to it, you can also deal 1d6 Cold damage to that target and reduce its Speed by 10 feet until the start of your next turn.', 'free', [{ type: 'damage', dice: '1d6', damageType: 'cold' }], 'You hit a target with an attack roll and deal damage to it.'),
      giant('hill', "Hill's Tumble (Hill Giant)", 'Knock a Large or smaller target Prone.', 'When you hit a Large or smaller creature with an attack roll and deal damage to it, you can give that target the Prone condition.', 'free', undefined, 'You hit a Large or smaller creature with an attack roll and deal damage to it.'),
      giant('stone', "Stone's Endurance (Stone Giant)", 'Reaction: reduce damage by 1d12 + Constitution modifier.', 'When you take damage, you can take a Reaction to roll 1d12. Add your Constitution modifier to the number rolled and reduce the damage by that total.', 'reaction', undefined, 'You take damage.'),
      giant('storm', "Storm's Thunder (Storm Giant)", 'Reaction: 1d8 Thunder damage to an attacker within 60 ft.', 'When you take damage from a creature within 60 feet of you, you can take a Reaction to deal 1d8 Thunder damage to that creature.', 'reaction', [{ type: 'damage', dice: '1d8', damageType: 'thunder' }], 'You take damage from a creature within 60 feet.'),
    ],
  },
  features: [
    GO.trait('large_form', 'Large Form', 'Starting at character level 5, you can change your size to Large as a Bonus Action if you\'re in a big enough space. This lasts for 10 minutes or until you end it (no action required). For that duration you have Advantage on Strength checks and your Speed increases by 10 feet. Once you use this trait you can\'t use it again until you finish a Long Rest.',
      { level: 5, activation: activation('bonus_action', { resource: 'goliath_2024_large' }), tags: ['buff', 'transformation'] }),
    GO.trait('powerful_build', 'Powerful Build', 'You have Advantage on any ability check you make to end the Grappled condition. You also count as one size larger when determining your carrying capacity.',
      { effects: [adv('ability checks to end the Grappled condition')] }),
    GO.trait('speed', 'Speed', 'Your Speed is 35 feet.', { effects: [speed(35)] }),
  ],
};

// ── Halfling ─────────────────────────────────────────────────────────────────

const H = mk('halfling_2024');
export const raceHalfling2024: Race = {
  id: 'halfling_2024', name: 'Halfling', rulesetId: RULESET, srd: false, size: 'Small', languages: ['Common'],
  description: 'Small, cheerful folk who are surprisingly brave. (2024 rules.)',
  features: [
    H.trait('brave', 'Brave', 'You have Advantage on saving throws you make to avoid or end the Frightened condition.', { effects: [adv('saving throws to avoid or end the Frightened condition')] }),
    H.trait('nimbleness', 'Halfling Nimbleness', 'You can move through the space of any creature that is a size larger than you, but you can\'t stop in the same space.'),
    H.trait('luck', 'Luck', 'When you roll a 1 on the d20 of a D20 Test, you can reroll the die, and you must use the new roll.', { trigger: 'You roll a 1 on the d20 of a D20 Test.' }),
    H.trait('stealthy', 'Naturally Stealthy', 'You can take the Hide action even when you are obscured only by a creature that is at least one size larger than you.'),
  ],
};

// ── Orc ──────────────────────────────────────────────────────────────────────

const O = mk('orc_2024');
export const raceOrc2024: Race = {
  id: 'orc_2024', name: 'Orc', rulesetId: RULESET, srd: false, size: 'Medium', languages: ['Common'],
  description: 'Powerful, enduring folk of the wilds. (2024 rules.)',
  resources: [pbPool('orc_2024_rush', 'Adrenaline Rush', 'short_rest'), onePool('orc_2024_endurance', 'Relentless Endurance')],
  features: [
    O.trait('rush', 'Adrenaline Rush', 'You can take the Dash action as a Bonus Action. When you do so, you gain a number of Temporary Hit Points equal to your Proficiency Bonus. You can use this trait a number of times equal to your Proficiency Bonus, regaining all uses when you finish a Short or Long Rest.',
      { activation: activation('bonus_action', { resource: 'orc_2024_rush' }), tags: ['movement', 'buff'] }),
    O.trait('darkvision', 'Darkvision', 'You have Darkvision with a range of 120 feet.', { effects: [darkvision(120)] }),
    O.trait('endurance', 'Relentless Endurance', 'When you are reduced to 0 Hit Points but not killed outright, you can drop to 1 Hit Point instead. Once you use this trait, you can\'t do so again until you finish a Long Rest.',
      { trigger: 'You are reduced to 0 Hit Points but not killed outright.', activation: activation('free', { resource: 'orc_2024_endurance' }), tags: ['healing'] }),
  ],
};

// ── Tiefling ─────────────────────────────────────────────────────────────────

const T = mk('tiefling_2024');
const TF_AB: Ability = 'cha';
const legacy = (id: string, name: string, damage: string, cantripId: string, s3: string, s5: string): AncestryOption => ({
  id, name, blurb: `${nameOf(damage)} resistance, ${nameOf(cantripId)}, ${nameOf(s3)} (3), ${nameOf(s5)} (5).`,
  feature: T.trait(`legacy_${id}`, `Fiendish Legacy: ${name}`,
    `You have Resistance to ${nameOf(damage)} damage and you know the ${nameOf(cantripId)} cantrip. At character levels 3 and 5 you learn a higher-level spell (see the level 3 and level 5 traits). The spellcasting ability you choose (Intelligence, Wisdom, or Charisma) is your spellcasting ability for these spells.`,
    { effects: [resist(damage), cantrip(cantripId, TF_AB, 'tiefling_2024_spell_ability')] }),
});
const tieflingSpells: Feature[] = [
  ['abyssal', 'ray_of_sickness', 'hold_person'], ['chthonic', 'false_life', 'ray_of_enfeeblement'], ['infernal', 'hellish_rebuke', 'darkness'],
].flatMap(([lin, a, b]) => [lineageSpell('tiefling_2024', lin, 3, a, TF_AB), lineageSpell('tiefling_2024', lin, 5, b, TF_AB)]);

export const raceTiefling2024: Race = {
  id: 'tiefling_2024', name: 'Tiefling', rulesetId: RULESET, srd: false, size: 'Medium', languages: ['Common'],
  description: 'Heirs of a fiendish legacy. (2024 rules.)',
  subraces: sizeSubraces('tiefling_2024'),
  resources: lineagePools('tiefling_2024'),
  pendingChoices: [abilityChoice('tiefling_2024', TF_AB)],
  ancestryChoice: {
    prompt: 'Fiendish Legacy: choose a legacy.',
    options: [
      legacy('abyssal', 'Abyssal', 'poison', 'poison_spray', 'ray_of_sickness', 'hold_person'),
      legacy('chthonic', 'Chthonic', 'necrotic', 'chill_touch', 'false_life', 'ray_of_enfeeblement'),
      legacy('infernal', 'Infernal', 'fire', 'fire_bolt', 'hellish_rebuke', 'darkness'),
    ],
  },
  features: [
    T.trait('darkvision', 'Darkvision', 'You have Darkvision with a range of 60 feet.', { effects: [darkvision(60)] }),
    T.trait('presence', 'Otherworldly Presence', 'You know the Thaumaturgy cantrip. When you cast it with this trait, the spell uses the same spellcasting ability you use for your Fiendish Legacy trait.',
      { effects: [cantrip('thaumaturgy', TF_AB, 'tiefling_2024_spell_ability')] }),
    ...tieflingSpells,
  ],
};

export const RACES_2024: Race[] = [
  raceDragonborn2024, raceDwarf2024, raceElf2024, raceGnome2024, raceGoliath2024, raceHalfling2024, raceOrc2024, raceTiefling2024,
];
