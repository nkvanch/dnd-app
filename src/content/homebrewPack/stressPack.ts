// ============================================================================
// FILE: src/content/homebrewPack/stressPack.ts
// The Grimoire Creator Stress-Test Pack (docs/homebrew/*.md), minus Ballast, Glassback and the
// Emperor Warlock which live in their own files. Everything here is authored as ordinary
// homebrew content — a Feat, Condition, Spell, Item and tiered reward Features — and seeded
// through BUILTIN_HOMEBREW exactly like Abyss Knight.
//
// What is automated vs left to the table follows each spec's own "Grimoire Representation"
// section. Positional facts (who stands within 5/10/15 ft of whom) are not modelled by the engine,
// so aura benefits an ALLY receives are table-resolved; the effect is authored onto the bearer's
// sheet behind a situational toggle where the bearer can plausibly be inside their own aura.
// ============================================================================
import { Condition, Feat, Item, Spell, Feature } from '../../engine/types';
import { stat, adv, gated, situational, feature, activation } from './helpers';

const PACK = 'Grimoire Creator Stress-Test Pack';

const FORCED_MOVE_CHECKS =
  'ability checks and saving throws to resist being shoved, dragged, pushed, pulled, or otherwise moved against your will';

// ── Braced (custom condition) ────────────────────────────────────────────────

export const bracedCondition: Condition = {
  id: 'braced',
  name: 'Braced',
  description:
    'The creature has committed to holding its position rather than moving freely. Speed -10 ft., ' +
    '+1 AC, advantage on ability checks and saving throws to resist being shoved, dragged, pushed, ' +
    'pulled, knocked prone or otherwise moved against its will, and it cannot take the Dash action. ' +
    'Ends if the applying source ends it, the creature becomes incapacitated, or a feature says so.',
  features: [
    feature({
      id: 'braced_effects',
      name: 'Braced',
      description: 'Speed -10 ft., +1 AC, advantage against forced movement and being knocked prone, and no Dash action.',
      source: { kind: 'condition', refId: 'braced' },
      effects: [
        stat('speed', 'add', -10),
        stat('ac', 'add', 1),
        adv(FORCED_MOVE_CHECKS),
        adv('ability checks and saving throws to resist being knocked prone'),
        stat('disable_action:dash', 'set', 1),
      ],
    }),
  ],
};

// ── Held Fast (Anchor of Command's self-state) ───────────────────────────────

export const heldFastCondition: Condition = {
  id: 'held_fast',
  name: 'Held Fast',
  description:
    'You planted yourself with Hold Fast until the start of your next turn: your speed is 0 and you ' +
    'cannot be moved against your will. Allies of your choice within 10 feet gained temporary hit ' +
    'points equal to your proficiency bonus + Charisma modifier, and allies within 10 feet have +1 AC ' +
    'until this ends.',
  features: [
    feature({
      id: 'held_fast_effects',
      name: 'Held Fast',
      description: 'Speed 0; cannot be moved against your will.',
      source: { kind: 'condition', refId: 'held_fast' },
      effects: [stat('speed', 'set', 0), adv(FORCED_MOVE_CHECKS)],
    }),
  ],
};

// ── Anchor of Command (feat) ─────────────────────────────────────────────────

const anchorFeature: Feature = feature({
  id: 'feat_anchor_of_command',
  name: 'Anchor of Command',
  description:
    'Increase your Constitution or Charisma by 1, to a maximum of 20.\n\n' +
    'While you are not incapacitated you have advantage on ability checks and saving throws made to ' +
    'resist being shoved, dragged, pushed, pulled, or otherwise moved against your will, and allies ' +
    'within 5 feet of you gain +1 AC against attacks from creatures you can see.\n\n' +
    'Hold Fast (1/Long Rest, Bonus Action): you plant yourself until the start of your next turn. Your ' +
    'speed becomes 0 and you cannot be moved against your will. Allies of your choice within 10 feet ' +
    'gain temporary hit points equal to your proficiency bonus + Charisma modifier, and allies within ' +
    '10 feet gain +1 AC until it ends.',
  source: { kind: 'feat', refId: 'anchor_of_command' },
  effects: [
    adv(FORCED_MOVE_CHECKS),
    situational(stat('ac', 'add', 1), 'anchor_adjacent_ally',
      'Are you within 5 feet of a creature with Anchor of Command, and can that ally see your attacker?'),
  ],
  activation: activation('bonus_action', { resource: 'anchor_hold_fast' }),
  abilityEffects: [
    { type: 'apply_condition', conditionId: 'held_fast', duration: { unit: 'rounds', remaining: 1 } },
  ],
  tags: ['buff', 'utility'],
});

export const anchorOfCommand: Feat = {
  id: 'anchor_of_command',
  name: 'Anchor of Command',
  prerequisite: null,
  description: anchorFeature.description,
  source: PACK,
  feature: anchorFeature,
  abilityChoice: { options: ['con', 'cha'], amount: 1 },
  resources: [{ resourceId: 'anchor_hold_fast', name: 'Hold Fast', maximum: 1, recharge: 'long_rest' }],
};

// ── Take a Brace (demo source of Braced) ─────────────────────────────────────

const takeABraceFeature: Feature = feature({
  id: 'feat_take_a_brace',
  name: 'Take a Brace',
  description: 'As a Bonus Action, you become Braced until the start of your next turn. (A demo/test source for the Braced condition.)',
  source: { kind: 'feat', refId: 'take_a_brace' },
  activation: activation('bonus_action'),
  abilityEffects: [
    { type: 'apply_condition', conditionId: 'braced', duration: { unit: 'rounds', remaining: 1 } },
  ],
  tags: ['buff'],
});

export const takeABrace: Feat = {
  id: 'take_a_brace',
  name: 'Take a Brace (Braced demo)',
  prerequisite: null,
  description: takeABraceFeature.description,
  source: PACK,
  feature: takeABraceFeature,
};

// ── Command the Field (spell) ────────────────────────────────────────────────

export const commandTheField: Spell = {
  id: 'command_the_field',
  name: 'Command the Field',
  level: 3,
  school: 'Enchantment',
  castingTime: '1 action',
  range: '60 feet',
  components: ['V', 'S'],
  duration: 'Concentration, up to 1 minute',
  description:
    'Choose up to three willing creatures you can see within range. When you cast the spell, and again ' +
    "at the start of each affected creature's turn while the spell lasts, that creature chooses one of " +
    "the following benefits, which lasts until the start of that creature's next turn:\n\n" +
    '- Advance. Its speed increases by 10 feet.\n' +
    '- Brace. It gains +1 AC.\n' +
    '- Press. The first weapon attack it hits with before the start of its next turn deals an extra 1d6 damage.\n' +
    '- Withdraw. Its movement does not provoke opportunity attacks.\n\n' +
    'A creature can benefit from only one option at a time.',
  upcast: 'When cast using a spell slot of 4th level or higher, you can target one additional creature for each slot level above 3rd.',
  ritual: false,
  concentration: true,
  classes: ['emperor_warlock', 'bard', 'cleric', 'paladin', 'warlock'],
  spellType: ['buff', 'control'],
};

// ── Standard of the Unyielding Line (item) ───────────────────────────────────

const STANDARD_ID = 'standard_of_the_unyielding_line';
const standardSource = { kind: 'item' as const, refId: STANDARD_ID };

export const standardOfTheUnyieldingLine: Item = {
  id: STANDARD_ID,
  name: 'Standard of the Unyielding Line',
  weight: 20,
  cost: '-',
  properties: ['wondrous item', 'magic item', 'rare', 'requires attunement'],
  resources: [{ resourceId: 'standard_charges', name: 'Standard charges', maximum: 3, recharge: 'dawn:1d3' }],
  features: [
    feature({
      id: 'standard_carried',
      name: 'Standard of the Unyielding Line',
      description:
        'A heavy military standard reinforced with an unreasonable amount of metal. While attuned and ' +
        'carrying it you have advantage on saving throws against being frightened, and allies within 10 ' +
        'feet of you gain +1 to saving throws while they can see the standard.',
      source: standardSource,
      effects: [
        adv('saving throws against being frightened'),
        situational(stat('savingThrows', 'add', 1), 'standard_ally_aura',
          'Are you within 10 feet of the standard and able to see it?'),
      ],
    }),
    feature({
      id: 'standard_plant',
      name: 'Plant the Standard',
      description:
        'As an action, plant the standard in an unoccupied space within 5 feet. It is a fixed object while ' +
        'planted; allies within 15 feet gain +1 AC and advantage on checks and saving throws to resist being ' +
        'moved against their will, and you no longer need to hold it. It stays planted until you use an action ' +
        'to retrieve it or it is removed.',
      source: standardSource,
      activation: activation('action', { range: '5 feet', target: 'area' }),
      abilityEffects: [{ type: 'set_flag', flag: 'standard_planted', value: true }],
      tags: ['buff', 'aoe'],
    }),
    feature({
      id: 'standard_retrieve',
      name: 'Retrieve the Standard',
      description: 'Use an action to pull the planted standard back up.',
      source: standardSource,
      activation: activation('action', { range: '5 feet' }),
      abilityEffects: [{ type: 'set_flag', flag: 'standard_planted', value: false }],
      tags: ['utility'],
    }),
    feature({
      id: 'standard_planted_aura',
      name: 'Planted Standard',
      description: 'While the standard is planted: allies within 15 feet gain +1 AC and advantage on checks and saves against being moved against their will.',
      source: standardSource,
      effects: [
        situational(gated(stat('ac', 'add', 1), 'standard_planted'), 'standard_planted_aura',
          'Are you within 15 feet of the planted standard?'),
        situational(gated(adv(FORCED_MOVE_CHECKS), 'standard_planted'), 'standard_planted_aura',
          'Are you within 15 feet of the planted standard?'),
      ],
    }),
    feature({
      id: 'standard_last_line',
      name: 'Last Line',
      description:
        'When a creature within 15 feet of the planted standard would be reduced to 0 hit points, use your ' +
        'Reaction and expend 1 charge to cause it to drop to 1 hit point instead. The standard regains 1d3 ' +
        'expended charges at dawn.',
      source: standardSource,
      trigger: 'A creature within 15 feet of the planted standard would be reduced to 0 hit points.',
      activation: activation('reaction', { resource: 'standard_charges', range: '15 feet', target: 'single' }),
      tags: ['healing', 'utility'],
    }),
  ],
};

// ── Weight of Authority (three-tier reward) ──────────────────────────────────

const WOA = { trackId: 'weight_of_authority', trackName: 'Weight of Authority' } as const;
const woaSource = { kind: 'campaign' as const, refId: 'weight_of_authority' };

function woaMain(tier: 1 | 2 | 3): Feature {
  const t = {
    1: { name: 'Recognized Presence', hp: 5,  init: 1, uses: 1, range: 10, times: 'Once' },
    2: { name: 'Proven Commander',    hp: 10, init: 2, uses: 2, range: 20, times: 'Twice' },
    3: { name: 'Weight of Command',   hp: 15, init: 3, uses: 3, range: 30, times: 'Three times' },
  }[tier];
  const extra =
    tier === 1 ? '' :
    '\n\nWhen initiative is rolled, choose yourself or one ally within ' + t.range + ' feet who can see or hear you. ' +
    'That creature gains temporary hit points equal to your proficiency bonus + your Charisma modifier.' +
    (tier === 2 ? ' (If Charisma is not appropriate for the character, the DM may allow Constitution or Wisdom when the reward is granted.)' : '');
  return feature({
    id: `weight_of_authority_t${tier}`,
    name: `Weight of Authority, Tier ${'I'.repeat(tier)}: ${t.name}`,
    description:
      `+${t.hp} maximum HP and +${t.init} to initiative. ${t.times} per Long Rest, when you or an ally within ${t.range} feet ` +
      'fails a saving throw against being frightened or being moved against their will, you can allow that creature ' +
      'to reroll the saving throw. The new roll must be used. ' +
      `(This tier replaces the previous one: ${t.hp} maximum HP in total, never stacked.)` + extra,
    source: woaSource,
    effects: [stat('max_hp', 'add', t.hp), stat('initiative', 'add', t.init)],
    trigger: 'You or an ally within range fails a saving throw against being frightened or being moved against their will.',
    activation: activation('free', { resource: 'weight_of_authority_reroll', range: `${t.range} feet`, target: 'single' }),
    resources: [{ resourceId: 'weight_of_authority_reroll', name: 'Authority reroll', maximum: t.uses, recharge: 'long_rest' }],
    rewardTrack: { ...WOA, tier },
    tags: ['utility'],
  });
}

const standWithMe: Feature = feature({
  id: 'weight_of_authority_stand_with_me',
  name: 'Stand With Me',
  description:
    'Once per Long Rest, when you or an ally within 30 feet would be reduced to 0 hit points, use your Reaction ' +
    'to cause that creature to drop to 1 hit point instead. Afterward, allies of your choice within 10 feet of ' +
    'that creature gain temporary hit points equal to your proficiency bonus.',
  source: woaSource,
  trigger: 'You or an ally within 30 feet would be reduced to 0 hit points.',
  activation: activation('reaction', { resource: 'weight_of_authority_stand', range: '30 feet', target: 'single' }),
  resources: [{ resourceId: 'weight_of_authority_stand', name: 'Stand With Me', maximum: 1, recharge: 'long_rest' }],
  rewardTrack: { ...WOA, tier: 3 },
  tags: ['healing', 'utility'],
});

/** Weight of Authority's three tiers, as the Features a DM grants (tier 3 is two features). */
export const weightOfAuthorityTiers: Feature[] = [woaMain(1), woaMain(2), woaMain(3), standWithMe];
