// ============================================================================
// FILE: src/content/classes/emperorWarlock/spirits.ts
// The twelve Bound Spirits (docs/homebrew/EMPEROR_WARLOCK.md and EMPEROR_WARLOCK_DEMO.md). Each is a
// HomebrewSubclass of an Emperor Warlock class with entries at levels 1, 5, 10, 15 and 20 (plus the
// two bonus spells it grants at 1/5/10 and one each at 15/20 as known-spell grants). The same twelve
// are built for BOTH versions of the class:
//   - Demo (emperor_warlock_demo): the spirit is picked once, at level 1, like a subclass.
//   - True (emperor_warlock): the spirit is replaced every in-game month through a Mode Group
//     (engine/modes.ts), each spirit remembering its own spent resources.
//
// Automated where the engine supports it (proficiencies, expertise-if-proficient, ability-score
// floors, timed states as conditions, once-per-rest and PB-per-rest pools, save/damage cards,
// bonus spells). Left as text, per the spec's own "Keep Manual" list: campaign-scale projects, the
// monthly calendar, history/political inference, terrain judgment, forced-movement paths, and
// aura benefits that land on allies.
// ============================================================================
import {
  Ability, ActionCardTag, AbilityEffect, ChoiceDefinition, Condition, Effect, FeatureActivation,
  Grant, HomebrewSubclass, LevelEntry, ResourceGrant, asSubclassId,
} from '../../../engine/types';
import { feature, adv, stat, activation } from '../../homebrewPack/helpers';
import { SPIRIT_SPELLS, SpiritSpells } from './spellData';

type Level = 1 | 5 | 10 | 15 | 20;

interface FDef {
  id: string;
  name: string;
  desc: string;
  effects?: Effect[];
  act?: FeatureActivation;
  ae?: AbilityEffect[];
  res?: ResourceGrant;
  trigger?: string;
  tags?: ActionCardTag[];
  upgradeOf?: string;
  choices?: ChoiceDefinition[];
}
interface SpiritDef { key: string; name: string; levels: Record<Level, FDef[]> }

// ── tiny constructors ────────────────────────────────────────────────────────

const A = (type: FeatureActivation['actionType'], o: Parameters<typeof activation>[1] = {}) => activation(type, o);
const pbPool = (id: string, name: string): ResourceGrant => ({ resourceId: id, name, maximum: 2, recharge: 'long_rest', perProficiencyBonus: true });
const onePool = (id: string, name: string): ResourceGrant => ({ resourceId: id, name, maximum: 1, recharge: 'long_rest' });
const manualPool = (id: string, name: string, when: string): ResourceGrant => ({ resourceId: id, name, maximum: 1, recharge: `${when} (mark available yourself)` });

const prof = (skill: string, how: 'add' | 'expert' | 'if_expert' = 'add'): Effect => ({
  type: 'grant_proficiency', target: `skill:${skill}`,
  operation: how === 'expert' ? 'multiply' : 'add',
  value: how === 'if_expert' ? 'expertise_if_proficient' : null, condition: null,
});
const weapon = (name: string): Effect => ({ type: 'grant_proficiency', target: `weapon:${name}`, operation: 'add', value: null, condition: null });
const floor = (ab: Ability, n: number): Effect => ({ type: 'stat_modifier', target: ab, operation: 'set', value: n, atLeast: true, condition: null });
const cond = (id: string, rounds: number): AbilityEffect => ({ type: 'apply_condition', conditionId: id, duration: { unit: 'rounds', remaining: rounds } });
const SPELL_DC = 'spell_save_dc' as const;

/** "Pick one" of several skills, as a feature_pool whose options each grant one skill effect. */
function skillPick(spiritId: string, id: string, prompt: string, skills: string[], how: 'add' | 'expert' | 'if_expert'): ChoiceDefinition {
  return {
    id, prompt, kind: 'feature_pool', count: 1, grants: [], required: true, resolved: false,
    pool: skills.map(s => ({
      id: `${id}_${s}`,
      label: s.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()),
      value: feature({
        id: `${spiritId}_${id}_${s}`, name: `${s.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())} (${how === 'add' ? 'proficiency' : 'expertise'})`,
        description: how === 'add' ? 'Proficiency from your Bound Spirit.' : how === 'expert' ? 'Expertise from your Bound Spirit.' : 'Proficiency, or expertise if you were already proficient, from your Bound Spirit.',
        source: { kind: 'subclass', refId: spiritId }, effects: [prof(s, how)],
      }),
    })),
  };
}

// ── timed states (conditions applied by the spirits' activations) ────────────

const stateCondition = (id: string, name: string, description: string, effects: Effect[]): Condition => ({
  id, name, description,
  features: [feature({ id: `${id}_effects`, name, description, source: { kind: 'condition', refId: id }, effects })],
});

export const EMPEROR_CONDITIONS: Condition[] = [
  stateCondition('emperor_battle_on_enemy_ground', 'Battle on Enemy Ground',
    'For 1 minute in hostile territory: +10 ft. speed, +2 AC, advantage against being frightened, and advantage on your first weapon attack each turn. (Allies within 60 feet gain the same; that part is table-resolved.)',
    [stat('speed', 'add', 10), stat('ac', 'add', 2), adv('saving throws against being frightened'), adv('the first weapon attack roll you make each turn')]),
  stateCondition('emperor_conquerors_tempo', "Conqueror's Tempo",
    'For 1 minute: +20 ft. speed, your weapon ranges double, and you make one extra weapon attack whenever you take the Attack action.',
    [stat('speed', 'add', 20), stat('extra_attack', 'add', 1)]),
  stateCondition('emperor_avatar_of_tenochtitlan', 'Avatar of Tenochtitlan',
    'For 1 minute your ability scores rise to at least Strength 22, Dexterity 24, Constitution 22 and Charisma 24 (Intelligence is unaffected if already below 8). They revert afterward.',
    [floor('str', 22), floor('dex', 24), floor('con', 22), floor('cha', 24)]),
  stateCondition('emperor_raise_the_standard', 'Raise the Standard',
    'A spectral standard stands for 1 minute. While you are within 30 feet of it you gain +1 AC and advantage on saving throws against being frightened. (Chosen allies within 30 feet gain the same, and temporary hit points equal to your Charisma modifier on its appearance; those are table-resolved.)',
    [stat('ac', 'add', 1), adv('saving throws against being frightened')]),
  stateCondition('emperor_banner_of_orleans', 'Banner of Orléans',
    'A legendary standard flies for 1 minute. Chosen allies within 60 feet (including you) are immune to being frightened, gain +2 AC and +10 ft. speed, and have advantage on death saving throws. On appearance each may move up to half speed without provoking opportunity attacks; at the start of an affected ally’s turn, if it is below half HP it gains temporary hit points equal to your Charisma modifier.',
    [stat('ac', 'add', 2), stat('speed', 'add', 10), { type: 'condition_immunity', target: 'frightened', operation: 'immunity', value: null, condition: null }, adv('death saving throws')]),
  stateCondition('emperor_didgori', 'Didgori',
    'Round 1 after being outnumbered when initiative was rolled: +2 to attack rolls and saving throws for you and allies within 30 feet.',
    [stat('savingThrows', 'add', 2), stat('attack_rolls', 'add', 2)]),
  stateCondition('emperor_royal_panoply_ward', 'Royal Panoply',
    'AC 17 (+ shield, if you carry one) for the day, plus a 50-point ward that absorbs damage before your hit points (tracked as the Royal Panoply ward pool).',
    []),
];

// ── the twelve spirits ───────────────────────────────────────────────────────

const SPIRITS: SpiritDef[] = [
  {
    key: 'genghis_khan', name: 'Genghis Khan',
    levels: {
      1: [{ id: 'steppe_archer', name: 'Steppe Archer', desc: 'Gain proficiency with the shortbow and longbow, and Animal Handling proficiency. While mounted: you have no disadvantage on ranged attack rolls solely because an enemy is adjacent, your bow range increases by 50%, and mounting or dismounting costs only 5 feet of movement.',
        effects: [weapon('shortbow'), weapon('longbow'), prof('animal_handling')] }],
      5: [{ id: 'born_in_the_saddle', name: 'Born in the Saddle', desc: 'Your mount gains +10 feet of speed. You have advantage on ability checks and saving throws to avoid falling from it, and you can take a Short Rest while traveling mounted.',
        effects: [adv('ability checks and saving throws to avoid falling off your mount')] }],
      10: [{ id: 'eyes_of_the_khan', name: 'Eyes of the Khan', desc: 'Once per Long Rest, summon spectral eagles for 10 minutes to scout a 1-mile outdoor radius. As an action, see through one eagle. They reveal visible creatures, camps, fires, roads, and large structures, but not through cover or magical concealment.',
        act: A('action', { resource: 'khan_eagles' }), res: onePool('khan_eagles', 'Eyes of the Khan'), tags: ['utility'] }],
      15: [{ id: 'appoint_a_noyan', name: 'Appoint a Noyan', desc: 'Once per in-game month, a willing NPC of CR 1/2 or lower gains six Sidekick levels for the duration of the current binding. (Lost when Genghis Khan leaves.) Mark it available again yourself at the start of a new month.',
        act: A('action', { resource: 'khan_noyan', range: 'touch', target: 'single' }), res: manualPool('khan_noyan', 'Appoint a Noyan', 'Once per in-game month'), tags: ['utility'] }],
      20: [{ id: 'reincarnation_of_the_khan', name: 'Reincarnation of the Khan', desc: 'Once per 10 in-game years, spend 24 hours to gain a wholly new appearance and mundane identity. Your soul is unchanged and still detectable by soul-reading magic.',
        act: A('action', { resource: 'khan_reincarnation' }), res: manualPool('khan_reincarnation', 'Reincarnation of the Khan', 'Once per 10 in-game years'), tags: ['utility'] }],
    },
  },
  {
    key: 'stalin', name: 'Stalin',
    levels: {
      1: [{ id: 'firing_squad', name: 'Firing Squad (4d6)', desc: 'Once per Long Rest, choose a target within 60 feet. It makes a Dexterity or Constitution saving throw (its choice) against your Spirit Save DC, taking 4d6 piercing damage on a failure, half on a success. (Twenty riflemen are narrative flavor for one attack.) The damage becomes 6d6 at level 5, 8d6 at 10, 10d6 at 15 and 12d6 at 20.',
        act: A('action', { resource: 'stalin_firing_squad', range: '60 feet', target: 'single', requiresSave: { ability: 'dex', dc: SPELL_DC } }),
        ae: [{ type: 'damage', dice: '4d6', damageType: 'piercing', saveOnSuccess: 'half' }], res: onePool('stalin_firing_squad', 'Firing Squad'), tags: ['damage', 'save'] }],
      5: [
        { id: 'firing_squad', name: 'Firing Squad (6d6)', upgradeOf: 'firing_squad', desc: 'Firing Squad now deals 6d6 piercing damage (target’s choice of Dexterity or Constitution save, half on a success).',
          act: A('action', { resource: 'stalin_firing_squad', range: '60 feet', target: 'single', requiresSave: { ability: 'dex', dc: SPELL_DC } }),
          ae: [{ type: 'damage', dice: '6d6', damageType: 'piercing', saveOnSuccess: 'half' }], tags: ['damage', 'save'] },
        { id: 'open_the_vodka', name: 'Open the Vodka', desc: 'Consume a bottle of alcohol to summon a spectral mob for 1 minute: AC 12, HP 30 + 2 x your Emperor Warlock level, speed 30, occupying a 20-foot square. It attacks with your Spirit Attack modifier for 2d6 + your Charisma modifier bludgeoning, enemies in its space take -2 to ability checks, and it acts immediately after you. (Stat block: Spectral Mob in the monster list.)',
          act: A('action', { range: '30 feet', target: 'area' }), tags: ['utility', 'damage'] },
      ],
      10: [
        { id: 'firing_squad', name: 'Firing Squad (8d6)', upgradeOf: 'firing_squad', desc: 'Firing Squad now deals 8d6 piercing damage.',
          act: A('action', { resource: 'stalin_firing_squad', range: '60 feet', target: 'single', requiresSave: { ability: 'dex', dc: SPELL_DC } }),
          ae: [{ type: 'damage', dice: '8d6', damageType: 'piercing', saveOnSuccess: 'half' }], tags: ['damage', 'save'] },
        { id: 'burn_moscow', name: 'Burn Moscow', desc: 'After spending 10 minutes destroying a defensible structure or base you control, pursuers have disadvantage on tracking, navigation and forced-pursuit checks for 24 hours, and your party has advantage on checks to evade pursuit.' },
      ],
      15: [
        { id: 'firing_squad', name: 'Firing Squad (10d6)', upgradeOf: 'firing_squad', desc: 'Firing Squad now deals 10d6 piercing damage.',
          act: A('action', { resource: 'stalin_firing_squad', range: '60 feet', target: 'single', requiresSave: { ability: 'dex', dc: SPELL_DC } }),
          ae: [{ type: 'damage', dice: '10d6', damageType: 'piercing', saveOnSuccess: 'half' }], tags: ['damage', 'save'] },
        { id: 'comrades_provide', name: 'Comrades Provide', desc: 'Once per 7 Long Rests, in a settlement with supporters, requisition mundane goods and services worth up to 50 gp x your Emperor Warlock level. No magic items and no cash.',
          act: A('action', { resource: 'stalin_comrades' }), res: manualPool('stalin_comrades', 'Comrades Provide', 'Once per 7 long rests'), tags: ['utility'] },
      ],
      20: [
        { id: 'firing_squad', name: 'Firing Squad (12d6)', upgradeOf: 'firing_squad', desc: 'Firing Squad now deals 12d6 piercing damage.',
          act: A('action', { resource: 'stalin_firing_squad', range: '60 feet', target: 'single', requiresSave: { ability: 'dex', dc: SPELL_DC } }),
          ae: [{ type: 'damage', dice: '12d6', damageType: 'piercing', saveOnSuccess: 'half' }], tags: ['damage', 'save'] },
        { id: 'take_the_country', name: 'Take the Country', desc: 'A four-stage campaign project: Popular Control, Local Influence, State Power, Coup. The DM sets the obstacles for each stage. You have advantage (and doubled proficiency where it applies) on Charisma checks that advance it. (Campaign-scale: tracked at the table.)',
          effects: [adv('Charisma checks to advance the Take the Country project')] },
      ],
    },
  },
  {
    key: 'hannibal', name: 'Hannibal',
    levels: {
      1: [{ id: 'enemy_of_empire', name: 'Enemy of Empire', desc: 'Choose one faction. You gain History or Survival proficiency concerning it, and once per turn you deal extra damage equal to your proficiency bonus to its agents. (The faction and the extra damage are tracked at the table.)' }],
      5: [{ id: 'alpine_march', name: 'Alpine March', desc: 'You and companions within 60 feet ignore nonmagical difficult terrain overland, and your pace cannot drop below half due solely to ordinary terrain.' }],
      10: [{ id: 'double_envelopment', name: 'Double Envelopment', desc: 'Reaction, when an ally hits a creature adjacent to you: make one weapon attack against it. You can do this a number of times equal to your proficiency bonus per Long Rest.',
        act: A('reaction', { resource: 'hannibal_envelopment', range: '5 feet', target: 'single' }), res: pbPool('hannibal_envelopment', 'Double Envelopment'), tags: ['attack'] }],
      15: [{ id: 'master_campaigner', name: 'Master Campaigner', desc: 'You automatically succeed on exhaustion saves caused by ordinary heat or cold, and you gain Survival proficiency with expertise.',
        effects: [prof('survival', 'expert')] }],
      20: [{ id: 'battle_on_enemy_ground', name: 'Battle on Enemy Ground', desc: 'Once per Long Rest, for 1 minute in hostile territory: you and allies within 60 feet gain +10 ft. speed, +2 AC and advantage against being frightened, and advantage on your first weapon attack each turn.',
        act: A('action', { resource: 'hannibal_battle', range: '60 feet', target: 'multiple' }), ae: [cond('emperor_battle_on_enemy_ground', 10)], res: onePool('hannibal_battle', 'Battle on Enemy Ground'), tags: ['buff'] }],
    },
  },
  {
    key: 'napoleon', name: 'Napoleon',
    levels: {
      1: [{ id: 'scientific_corps', name: 'Scientific Corps', desc: 'Add half your proficiency bonus (rounded down) to Intelligence checks you are not proficient in, and gain Investigation or History proficiency.' }],
      5: [{ id: 'imperial_presence', name: 'Imperial Presence', desc: 'Your Charisma score increases by 1, to a maximum of 20, and you gain Persuasion proficiency, or expertise if you already have it.',
        effects: [stat('cha', 'add', 1), prof('persuasion', 'if_expert')] }],
      10: [{ id: 'against_the_odds', name: 'Against the Odds', desc: 'Once per Long Rest, when you are outnumbered at the start of combat: allies within 30 feet gain temporary hit points equal to your Emperor Warlock level for 1 minute, and add half your proficiency bonus to their saving throws during round 1.',
        act: A('free', { resource: 'napoleon_odds', range: '30 feet', target: 'multiple' }), res: onePool('napoleon_odds', 'Against the Odds'), trigger: 'You are outnumbered at the start of combat.', tags: ['buff'] }],
      15: [{ id: 'chosen_rival', name: 'Chosen Rival', desc: 'After 1 hour studying a target, you have advantage on Investigation, History and Survival checks about it, and deal an extra 1d8 damage once per turn against it or its agents.',
        act: A('free', { range: 'self', target: 'single' }), ae: [{ type: 'damage', dice: '1d8', damageType: 'extra' }], tags: ['damage'] }],
      20: [{ id: 'grand_battery', name: 'Grand Battery', desc: 'Once per Long Rest, choose a point within 1 mile. Each creature in a 60-foot radius makes a Dexterity saving throw against your Spirit Save DC, taking 10d8 fire plus 10d8 bludgeoning damage on a failure, half on a success. Objects and structures take double damage.',
        act: A('action', { resource: 'napoleon_battery', range: '1 mile', target: 'area', requiresSave: { ability: 'dex', dc: SPELL_DC } }),
        ae: [{ type: 'damage', dice: '10d8', damageType: 'fire', saveOnSuccess: 'half' }, { type: 'damage', dice: '10d8', damageType: 'bludgeoning', saveOnSuccess: 'half' }],
        res: onePool('napoleon_battery', 'Grand Battery'), tags: ['damage', 'aoe', 'save'] }],
    },
  },
  {
    key: 'alexander', name: 'Alexander the Great',
    levels: {
      1: [{ id: 'hammer_and_anvil', name: 'Hammer and Anvil', desc: 'Once per turn, add your proficiency bonus to an attack roll against a creature that is also threatened by an ally, unless two or more enemies are adjacent to you.' }],
      5: [{ id: 'bucephalus', name: 'Bucephalus', desc: 'Once per Long Rest, summon a spectral warhorse for 10 minutes: AC 14, HP 5 x your Emperor Warlock level, speed 120. It vanishes at 0 hit points. (Stat block: Spectral Warhorse in the monster list.)',
        act: A('action', { resource: 'alexander_bucephalus', range: '30 feet', target: 'single' }), res: onePool('alexander_bucephalus', 'Bucephalus'), tags: ['utility'] }],
      10: [{ id: 'war_elephant', name: 'War Elephant', desc: 'Once per Long Rest, summon a spectral war elephant for 10 minutes: AC 15, HP 60, speed 40, with three weapon positions. Up to three creatures can each operate a bow (range 150/600, 1d8 piercing, using the operator’s attack modifier). It acts immediately after you, and your Bonus Action commands it to take any action except Dodge. (Stat block: Spectral War Elephant.)',
        act: A('action', { resource: 'alexander_elephant', range: '30 feet', target: 'single' }), res: onePool('alexander_elephant', 'War Elephant'), tags: ['utility'] }],
      15: [{ id: 'royal_panoply', name: 'Royal Panoply', desc: 'Spend 10 gp and 1 hour: your AC becomes 17 (plus a shield, if you carry one) and you gain a 50-point ward that absorbs damage before your hit points. Refill the ward on a Long Rest, or spend 10 pp on a Short Rest to restore 10 points. Answer "yes" to the Royal Panoply question in Situational Effects once you have prepared it.',
        effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 17, condition: null, situational: { id: 'royal_panoply_ready', question: 'Have you spent 10 gp and 1 hour on Royal Panoply today?' } }],
        res: { resourceId: 'alexander_panoply_ward', name: 'Royal Panoply ward', maximum: 50, recharge: 'long_rest' } }],
      20: [{ id: 'conquerors_tempo', name: "Conqueror's Tempo", desc: 'Once per Long Rest, for 1 minute: +20 ft. speed, your weapon ranges double, and you make one additional weapon attack whenever you take the Attack action.',
        act: A('action', { resource: 'alexander_tempo' }), ae: [cond('emperor_conquerors_tempo', 10)], res: onePool('alexander_tempo', "Conqueror's Tempo"), tags: ['buff'] }],
    },
  },
  {
    key: 'odysseus', name: 'Odysseus',
    levels: {
      1: [{ id: 'cunning', name: 'Cunning', desc: 'Gain proficiency in Insight and Investigation, and expertise in one of them.',
        effects: [prof('insight'), prof('investigation')] }],
      5: [{ id: 'wooden_horse', name: 'Wooden Horse', desc: 'Once per Long Rest, create a Large hidden structure that lasts 8 hours and holds up to eight Medium creatures. Others notice it only with an Investigation or Insight check against your Spirit Save DC.',
        act: A('action', { resource: 'odysseus_horse', range: '30 feet', target: 'area' }), res: onePool('odysseus_horse', 'Wooden Horse'), tags: ['utility'] }],
      10: [{ id: 'silver_tongue', name: 'Silver Tongue', desc: 'Gain proficiency in Animal Handling and Deception, and expertise in one of them. Once per Long Rest, reroll a failed check with either skill.',
        effects: [prof('animal_handling'), prof('deception')],
        act: A('free', { resource: 'odysseus_tongue' }), res: onePool('odysseus_tongue', 'Silver Tongue reroll'), trigger: 'You fail an Animal Handling or Deception check.', tags: ['utility'] }],
      15: [{ id: 'i_will_return_home', name: 'I Will Return Home', desc: 'You always know the direction, distance and plane of one chosen home, cannot become lost while heading there by nonmagical means, and have advantage on saving throws against magic that blocks your return.',
        effects: [adv('saving throws against magic that blocks your return home')] }],
      20: [{ id: 'heroes_of_the_odyssey', name: 'Heroes of the Odyssey', desc: 'Once per Long Rest, summon one hero for 1 minute. Achilles: AC 20, HP 80, two attacks of 2d10 + 6 slashing; he vanishes if hit by a critical poison hit. Prometheus: a 20-foot-radius 10d6 fire burst on arrival (Dexterity save for half), then ranged 3d10 fire attacks. Heracles: Strength 26, advantage on Strength checks and saves, two attacks of 2d12 + 8 bludgeoning, counts as Huge for lifting, pushing and breaking, and will attempt any ordered physical labor. (Stat blocks in the monster list.)',
        act: A('action', { resource: 'odysseus_heroes', range: '30 feet', target: 'single' }), res: onePool('odysseus_heroes', 'Heroes of the Odyssey'), tags: ['utility', 'damage'] }],
    },
  },
  {
    key: 'caesar', name: 'Julius Caesar',
    levels: {
      1: [{ id: 'pilum_doctrine', name: 'Pilum Doctrine', desc: 'Your javelin range is 60/240 feet, and drawing a thrown weapon as part of the attack needs no separate object interaction.' }],
      5: [{ id: 'twenty_three_wounds', name: 'Twenty-Three Wounds', desc: 'Once per Long Rest, when a hit would reduce you to 0 hit points, you are instead left at 1 hit point.',
        trigger: 'A hit would reduce you to 0 hit points.', act: A('free', { resource: 'caesar_wounds' }), res: onePool('caesar_wounds', 'Twenty-Three Wounds'), tags: ['healing'] }],
      10: [{ id: 'forced_march', name: 'Forced March (Caesar)', desc: 'Allies who start their turn within 30 feet of you gain +10 feet of speed until their next turn, and your group can travel one additional hour before forced-march checks. (Allies’ speed is table-resolved.)' }],
      15: [{ id: 'codifier', name: 'Codifier', desc: 'Gain History expertise and expertise in Investigation or Persuasion. After 10 minutes studying a legal or government structure you learn its hierarchy, enforcement, and major procedures.',
        effects: [prof('history', 'expert')] }],
      20: [{ id: 'dictator_perpetuo', name: 'Dictator Perpetuo', desc: 'A campaign-scale project to centralize a republic. You have advantage (and doubled proficiency where it applies) on checks for coalition-building, military loyalty, institutional reform and public persuasion. (Tracked at the table.)',
        effects: [adv('checks for coalition-building, military loyalty, institutional reform, and public persuasion')] }],
    },
  },
  {
    key: 'saladin', name: 'Saladin',
    levels: {
      1: [{ id: 'chivalric_defender', name: 'Chivalric Defender', desc: 'Gain proficiency in Religion and Insight. As a Reaction, a number of times equal to your proficiency bonus per Long Rest, add your proficiency bonus to an adjacent ally’s AC against one attack.',
        effects: [prof('religion'), prof('insight')], act: A('reaction', { resource: 'saladin_defender', range: '5 feet', target: 'single' }), res: pbPool('saladin_defender', 'Chivalric Defender'), tags: ['buff'] }],
      5: [{ id: 'cavalry_commander', name: 'Cavalry Commander', desc: 'You and mounted allies within 30 feet gain +15 feet of speed while mounted.' }],
      10: [{ id: 'decisive_charge', name: 'Decisive Charge', desc: 'Once per turn, after moving at least 20 feet toward a target before a melee hit, deal an extra 3d8 damage.',
        act: A('free', { range: '5 feet', target: 'single' }), ae: [{ type: 'damage', dice: '3d8', damageType: 'extra' }], tags: ['damage'] }],
      15: [{ id: 'siege_master', name: 'Siege Master', desc: 'Deal double damage to structures and objects. You and allies within 30 feet have advantage on saving throws against traps, collapsing fortifications and siege weapons.',
        effects: [adv('saving throws against traps, collapsing fortifications, and siege weapons')] }],
      20: [{ id: 'wisdom_of_the_sultan', name: 'Wisdom of the Sultan', desc: 'While Saladin is your active Bound Spirit your Wisdom becomes 24 if it is lower. You gain Wisdom saving throw proficiency if you lack it. (The saving-throw proficiency is applied through the saving-throw proficiency list; check it on your sheet.)',
        effects: [floor('wis', 24)] }],
    },
  },
  {
    key: 'montezuma', name: 'Montezuma',
    levels: {
      1: [{ id: 'trail_reader', name: 'Trail Reader', desc: 'Gain Survival proficiency, or expertise if you already have it, and advantage on checks to follow physical tracks.',
        effects: [prof('survival', 'if_expert'), adv('Survival checks to follow physical tracks')] }],
      5: [{ id: 'jungle_march', name: 'Jungle March', desc: 'You ignore nonmagical difficult terrain, and your party does not lose overland speed to ordinary vegetation while traveling with you.' }],
      10: [{ id: 'eagle_and_jaguar_host', name: 'Eagle and Jaguar Host', desc: 'Once per Long Rest, summon a warband for 1 minute: AC 14, HP 70, speed 35, occupying a 20-foot square, attacking with your Spirit Attack modifier for 4d8 piercing. It represents roughly one hundred warriors as one creature. (Stat block: Eagle and Jaguar Host in the monster list.)',
        act: A('action', { resource: 'montezuma_host', range: '30 feet', target: 'single' }), res: onePool('montezuma_host', 'Eagle and Jaguar Host'), tags: ['utility', 'damage'] }],
      15: [{ id: 'tribute', name: 'Tribute', desc: 'Every 7 days you receive 10% of legitimate expenditures since the last tribute, up to 25 gp x your Emperor Warlock level. Transfers within the party do not count.',
        act: A('free', { resource: 'montezuma_tribute' }), res: manualPool('montezuma_tribute', 'Tribute', 'Every 7 days'), tags: ['utility'] }],
      20: [{ id: 'avatar_of_tenochtitlan', name: 'Avatar of Tenochtitlan', desc: 'Once per Long Rest, for 1 minute your ability scores rise to at least Strength 22, Dexterity 24, Constitution 22 and Charisma 24 (Intelligence is unaffected if already below 8). They revert afterward.',
        act: A('action', { resource: 'montezuma_avatar' }), ae: [cond('emperor_avatar_of_tenochtitlan', 10)], res: onePool('montezuma_avatar', 'Avatar of Tenochtitlan'), tags: ['buff', 'transformation'] }],
    },
  },
  {
    key: 'david', name: 'David IV the Builder',
    levels: {
      1: [{ id: 'royal_authority', name: 'Royal Authority', desc: 'Gain proficiency in Persuasion and History, and expertise in one of them.',
        effects: [prof('persuasion'), prof('history')] }],
      5: [{ id: 'didgori', name: 'Didgori', desc: 'Once per Long Rest, if you are outnumbered when initiative is rolled: gain temporary hit points equal to your Emperor Warlock level, and during round 1 you and allies within 30 feet gain +2 to attack rolls and saving throws.',
        trigger: 'You are outnumbered when initiative is rolled.', act: A('free', { resource: 'david_didgori', range: '30 feet', target: 'multiple' }), ae: [cond('emperor_didgori', 1)],
        res: onePool('david_didgori', 'Didgori'), tags: ['buff'] }],
      10: [{ id: 'spear_wall', name: 'Spear Wall', desc: 'Once per Long Rest, create a 30-by-5-foot line of spectral spears for 2 rounds. A creature in it makes a Strength saving throw against your Spirit Save DC, taking 5d8 piercing damage and having speed 0 for the turn on a failure, half damage and no speed loss on a success.',
        act: A('action', { resource: 'david_spear_wall', range: '30 feet line', target: 'area', requiresSave: { ability: 'str', dc: SPELL_DC } }),
        ae: [{ type: 'damage', dice: '5d8', damageType: 'piercing', saveOnSuccess: 'half' }], res: onePool('david_spear_wall', 'Spear Wall'), tags: ['damage', 'control', 'aoe', 'save'] }],
      15: [{ id: 'kartvelebi_and_khevsurebi', name: 'Kartvelebi and Khevsurebi', desc: 'Once per Long Rest, for 1 minute summon two units under one command that act immediately after you. Kartvelebi: AC 16, HP 80, speed 30, 4d10 slashing, and once per summoning +3d8 radiant on a hit. Khevsurebi: AC 15, HP 60, speed 35, bow (300 ft.) 3d8 piercing or sword 2d8 slashing, and a Reaction for +2 AC against one attack. (Stat blocks in the monster list.)',
        act: A('action', { resource: 'david_units', range: '30 feet', target: 'multiple' }), res: onePool('david_units', 'Kartvelebi and Khevsurebi'), tags: ['utility', 'damage'] }],
      20: [{ id: 'the_four_builders', name: 'The Four Builders', desc: 'Once per in-game year, at a controlled site, construct a permanent fortified tower or keep over 12 months. If the site is seized, work pauses; recovering it adds 6 months. (Tracked at the table.)',
        act: A('free', { resource: 'david_builders' }), res: manualPool('david_builders', 'The Four Builders', 'Once per in-game year'), tags: ['utility'] }],
    },
  },
  {
    key: 'sun_tzu', name: 'Sun Tzu',
    levels: {
      1: [{ id: 'know_the_ground', name: 'Know the Ground', desc: 'Gain Investigation or Insight proficiency (expertise if you are already proficient in the chosen skill). After 1 minute observing an area, ask the DM one question: the most defensible position, the safest retreat route, the most exploitable visible terrain feature, or the best ambush position.' }],
      5: [{ id: 'withdraw_before_they_know', name: 'Withdraw Before They Know You Were There', desc: 'When you Hide or Disengage, choose one willing ally within 30 feet who can see or hear you. It may immediately move up to half its speed without provoking opportunity attacks. You can do this a number of times equal to your proficiency bonus per Long Rest.',
        act: A('free', { resource: 'suntzu_withdraw', range: '30 feet', target: 'single' }), res: pbPool('suntzu_withdraw', 'Withdraw Before They Know'), tags: ['movement', 'utility'] }],
      10: [{ id: 'know_the_enemy', name: 'Know the Enemy', desc: 'After observing a creature for 1 minute, learn two facts of your choice: its highest ability score, lowest ability score, one resistance, one immunity, one vulnerability, one saving throw proficiency, or whether it is healthy, wounded or badly wounded relative to its maximum HP. Once per creature per Long Rest.' }],
      15: [{ id: 'shape_the_battlefield', name: 'Shape the Battlefield', desc: 'Once per Long Rest, as an action choose a point within 120 feet. For 1 minute a 30-foot-radius prepared battlefield exists there: you and chosen allies ignore nonmagical difficult terrain, gain +10 feet of movement, and cannot be surprised there; enemies treat it as difficult terrain.',
        act: A('action', { resource: 'suntzu_battlefield', range: '120 feet', target: 'area' }), res: onePool('suntzu_battlefield', 'Shape the Battlefield'), tags: ['control', 'aoe'] }],
      20: [
        { id: 'tactical_plan', name: 'Supreme Strategy: Tactical Plan', desc: 'Once per Long Rest, after observing the enemy or battlefield for 1 minute, you and allies within 60 feet cannot be surprised for 1 minute, have advantage on initiative, and gain advantage on the first attack roll each makes during the effect. It ends for a creature that moves more than 60 feet away.',
          act: A('action', { resource: 'suntzu_plan', range: '60 feet', target: 'multiple' }), res: onePool('suntzu_plan', 'Tactical Plan'), tags: ['buff'] },
        { id: 'strategic_analysis', name: 'Supreme Strategy: Strategic Analysis', desc: 'Once per 30 in-game days, after 24 hours studying a known organized enemy, fortification, campaign, or political or military position, the DM reveals one meaningful exploitable weakness in its logistics, defenses, leadership, terrain, supply, morale or strategy, limited to information reasonably knowable.',
          act: A('free', { resource: 'suntzu_analysis' }), res: manualPool('suntzu_analysis', 'Strategic Analysis', 'Once per 30 in-game days'), tags: ['utility'] },
      ],
    },
  },
  {
    key: 'joan', name: 'Joan of Arc',
    levels: {
      1: [{ id: 'voices_of_conviction', name: 'Voices of Conviction', desc: 'Gain proficiency in Religion and Persuasion (expertise in one if you were already proficient). Reaction: when you or an ally within 30 feet fails a saving throw against being frightened, it rerolls it. You can do this a number of times equal to your proficiency bonus per Long Rest.',
        effects: [prof('religion'), prof('persuasion')],
        trigger: 'You or an ally within 30 feet fails a saving throw against being frightened.', act: A('reaction', { resource: 'joan_voices', range: '30 feet', target: 'single' }), res: pbPool('joan_voices', 'Voices of Conviction'), tags: ['utility'] }],
      5: [{ id: 'raise_the_standard', name: 'Raise the Standard', desc: 'Once per Long Rest, as a Bonus Action, raise a spectral standard for 1 minute. On its appearance you and chosen allies within 30 feet gain temporary hit points equal to your Charisma modifier. While within 30 feet of it, affected creatures gain +1 AC and advantage on saving throws against being frightened.',
        act: A('bonus_action', { resource: 'joan_standard', range: '30 feet', target: 'multiple' }), ae: [cond('emperor_raise_the_standard', 10)], res: onePool('joan_standard', 'Raise the Standard'), tags: ['buff'] }],
      10: [{ id: 'rally_the_fallen', name: 'Rally the Fallen', desc: 'Once per Long Rest, as a Reaction when a creature within 60 feet would be reduced to 0 hit points, it instead drops to 1 hit point and may move up to half its speed without provoking opportunity attacks.',
        trigger: 'A creature within 60 feet would be reduced to 0 hit points.', act: A('reaction', { resource: 'joan_rally', range: '60 feet', target: 'single' }), res: onePool('joan_rally', 'Rally the Fallen'), tags: ['healing'] }],
      15: [{ id: 'courage_is_contagious', name: 'Courage Is Contagious', desc: 'When you take damage from a hostile creature, choose one ally within 30 feet. It gains temporary hit points equal to your Charisma modifier + your proficiency bonus. A creature can receive this from the feature only once per round.',
        trigger: 'You take damage from a hostile creature.' }],
      20: [{ id: 'banner_of_orleans', name: 'Banner of Orléans', desc: 'Once per Long Rest, as an action, raise a legendary standard for 1 minute. Chosen allies within 60 feet are immune to being frightened, gain +2 AC and +10 feet of speed, and have advantage on death saving throws. On its appearance each may move up to half its speed without provoking opportunity attacks. At the start of an affected ally’s turn, if it is below half its hit points it gains temporary hit points equal to your Charisma modifier.',
        act: A('action', { resource: 'joan_banner', range: '60 feet', target: 'multiple' }), ae: [cond('emperor_banner_of_orleans', 10)], res: onePool('joan_banner', 'Banner of Orléans'), tags: ['buff'] }],
    },
  },
];

// Skill picks that the spirits offer as a real choice (see skillPick): by spirit key and level.
const PICKS: Record<string, Partial<Record<Level, (spiritId: string) => ChoiceDefinition[]>>> = {
  napoleon: { 1: id => [skillPick(id, 'corps_skill', 'Scientific Corps: choose Investigation or History proficiency.', ['investigation', 'history'], 'add')] },
  odysseus: {
    1: id => [skillPick(id, 'cunning_expertise', 'Cunning: choose Insight or Investigation for expertise.', ['insight', 'investigation'], 'expert')],
    10: id => [skillPick(id, 'tongue_expertise', 'Silver Tongue: choose Animal Handling or Deception for expertise.', ['animal_handling', 'deception'], 'expert')],
  },
  caesar: { 15: id => [skillPick(id, 'codifier_expertise', 'Codifier: choose Investigation or Persuasion for expertise.', ['investigation', 'persuasion'], 'expert')] },
  david: { 1: id => [skillPick(id, 'authority_expertise', 'Royal Authority: choose Persuasion or History for expertise.', ['persuasion', 'history'], 'expert')] },
  sun_tzu: { 1: id => [skillPick(id, 'ground_skill', 'Know the Ground: choose Investigation or Insight (expertise if already proficient).', ['investigation', 'insight'], 'if_expert')] },
  joan: { 1: id => [skillPick(id, 'conviction_expertise', 'Voices of Conviction: choose Religion or Persuasion to gain expertise in (if already proficient).', ['religion', 'persuasion'], 'if_expert')] },
};

const LEVELS: Level[] = [1, 5, 10, 15, 20];

/** The id a spirit gets as a subclass of `classId`. */
export const spiritId = (classId: string, key: string) => `${classId}_spirit_${key}`;

/** Builds the twelve Bound Spirits as subclasses of `classId` (hpDie matches the class's d8). */
export function buildSpirits(classId: string): HomebrewSubclass[] {
  return SPIRITS.map(def => {
    const id = spiritId(classId, def.key);
    const spells: SpiritSpells = SPIRIT_SPELLS[def.key];
    const entries: LevelEntry[] = LEVELS.map(level => {
      const grants: Grant[] = [];
      for (const f of def.levels[level]) {
        grants.push({
          kind: 'feature',
          value: feature({
            id: `${id}_${f.id}`, name: f.name, description: f.desc, level,
            source: { kind: 'subclass', refId: id },
            effects: f.effects, activation: f.act, abilityEffects: f.ae, trigger: f.trigger, tags: f.tags,
            upgradeOf: f.upgradeOf ? `${id}_${f.upgradeOf}` : undefined,
          }),
        });
        if (f.res) grants.push({ kind: 'resource', value: f.res });
      }
      grants.push({ kind: 'known_spells', value: { spellIds: spells[level] } });
      return { level, hpDie: 8, grants, choices: PICKS[def.key]?.[level]?.(id) ?? [] };
    });
    return { id: asSubclassId(id), name: def.name, classId, srd: false, entries } as HomebrewSubclass;
  });
}

/** Spirit option ids for a class, in d12 table order (1 = Genghis Khan ... 12 = Joan of Arc). */
export const SPIRIT_TABLE_ORDER = ['genghis_khan', 'stalin', 'hannibal', 'napoleon', 'alexander', 'odysseus', 'caesar', 'saladin', 'montezuma', 'david', 'sun_tzu', 'joan'];
