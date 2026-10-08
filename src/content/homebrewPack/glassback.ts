// ============================================================================
// FILE: src/content/homebrewPack/glassback.ts
// Glassback (docs/homebrew/GLASSBACK.md): CR 7 Large aberration, a non-carbon extremophile.
//
// Automated through real engine primitives:
//   - Pressure is a 0-3 resource ('glassback_pressure'); its penalty tiers are effects gated on the
//     pool's CURRENT value (`resource:glassback_pressure==1` / `==0`, see pipeline.ts's
//     effectConditionActive), so AC/speed/roll penalties switch on and off as Pressure moves.
//   - Ceramic Shell's "-2 from each slashing hit" is a flat `damage_reduction:slashing` effect that
//     applyDamage honours; the "fractured" state is a custom condition the DM applies/removes.
//   - Compress restores 1 Pressure and applies a custom speed-0 / physical-resistance condition.
//   - Abrasive Jet carries "Recharge 5-6." so the monster factory synthesizes its recharge pool.
//   - Pressure Collapse is a free-use area save the DM triggers at 0 HP.
// Table-resolved (per the spec): whether an environment counts as high-pressure, mineral targeting,
// the end-of-turn Pressure loss, difficult terrain from the jet, retreat behavior.
// ============================================================================
import { Condition, Effect } from '../../engine/types';
import type { MonsterTemplate } from '../monsters/types';
import { stat, adv, gated, feature, activation } from './helpers';

const ID = 'glassback';
const source = { kind: 'race' as const, refId: ID };
const PRESSURE = 'glassback_pressure';

const BPS = ['bludgeoning', 'piercing', 'slashing'];

export const glassbackFracturedCondition: Condition = {
  id: 'glassback_shell_fractured',
  name: 'Shell Fractured',
  description:
    'One shell plate has fractured until the end of the Glassback\'s next turn: its AC is reduced by 1, and a creature ' +
    'that hits it with a melee attack takes 3 (1d6) slashing damage from razor-edged shell fragments. Only one fracture can be active at a time.',
  features: [
    feature({
      id: 'glassback_shell_fractured_effects', name: 'Shell Fractured',
      description: 'AC -1; melee attackers take 1d6 slashing from the fragments.',
      source: { kind: 'condition', refId: 'glassback_shell_fractured' },
      effects: [stat('ac', 'add', -1)],
    }),
  ],
};

export const glassbackCompressedCondition: Condition = {
  id: 'glassback_compressed',
  name: 'Compressed',
  description: 'Until the start of its next turn the Glassback\'s speed is 0 and it has resistance to bludgeoning, piercing, and slashing damage.',
  features: [
    feature({
      id: 'glassback_compressed_effects', name: 'Compressed',
      description: 'Speed 0; resistance to bludgeoning, piercing, and slashing damage.',
      source: { kind: 'condition', refId: 'glassback_compressed' },
      effects: [
        stat('speed', 'set', 0),
        ...BPS.map((t): Effect => ({ type: 'grant_resistance', target: t, operation: 'resistance', value: null, condition: null })),
      ],
    }),
  ],
};

const p = (n: number) => `resource:${PRESSURE}==${n}`;

export const monsterGlassback: MonsterTemplate = {
  id: ID,
  name: 'Glassback',
  cr: 7,
  size: 'large',
  type: 'aberration',
  alignment: 'unaligned',
  stats: { str: 19, dex: 10, con: 17, int: 7, wis: 14, cha: 3 },
  hp: { dice: '14d10+42', average: 119 },
  ac: { value: 17, source: 'ceramic shell' },
  speed: 30,
  savingThrows: ['str', 'con', 'wis'],
  skills: { perception: 5, survival: 5 },
  senses: ['blindsight 10 ft', 'tremorsense 60 ft', 'passive Perception 15'],
  languages: [],
  resources: [{ resourceId: PRESSURE, name: 'Pressure (0-3)', maximum: 3, recharge: 'never' }],
  features: [
    feature({
      id: 'glassback_defenses', name: 'Resistances and Immunities', source,
      description: 'Damage resistances: acid, poison. Condition immunities: poisoned. Burrow speed 20 ft.',
      effects: [
        { type: 'grant_resistance', target: 'acid', operation: 'resistance', value: null, condition: null },
        { type: 'grant_resistance', target: 'poison', operation: 'resistance', value: null, condition: null },
        { type: 'condition_immunity', target: 'poisoned', operation: 'immunity', value: null, condition: null },
        { type: 'grant_movement', target: 'movement', operation: 'add', value: null, condition: null, movementType: 'burrow', movementRange: 20 },
      ],
    }),
    feature({
      id: 'glassback_alien_metabolism', name: 'Alien Metabolism', source,
      description:
        'The Glassback does not breathe. It does not require conventional food, but must periodically consume mineral-rich ' +
        'material such as ore, salts, crystal, or metal-bearing rock. It cannot see normally; its blindsight and tremorsense ' +
        'represent vibration, pressure, thermal-gradient, and chemical sensing.',
    }),
    feature({
      id: 'glassback_mineral_appetite', name: 'Mineral Appetite', source,
      description:
        'The Glassback can detect significant exposed concentrations of metal, salt, crystal, or ore within 60 feet, provided they are ' +
        'not completely sealed behind a substantial barrier. When choosing targets it usually prioritizes the richest nearby mineral ' +
        'source unless another creature presents an immediate threat. This is a behavioral tendency, not magical compulsion.',
    }),
    feature({
      id: 'glassback_ceramic_shell', name: 'Ceramic Shell', source,
      description:
        'The Glassback reduces slashing damage it takes by 2 from each hit. If it takes 10 or more bludgeoning or thunder damage from a ' +
        'single source, one shell plate fractures until the end of its next turn (apply the Shell Fractured condition): its AC is reduced ' +
        'by 1 and a creature that hits it with a melee attack takes 3 (1d6) slashing damage. Only one fracture can be active at a time. ' +
        'Pressure penalties stack with this AC reduction.',
      effects: [stat('damage_reduction:slashing', 'add', 2)],
      trigger: 'It takes 10 or more bludgeoning or thunder damage from a single source.',
    }),
    feature({
      id: 'glassback_pressure_state', name: 'Pressure State', source,
      description:
        'Pressure runs 0 to 3 (3 in its native high-pressure environment, normally 2 at ordinary surface pressure). At the end of each of its ' +
        'turns outside a high-pressure environment it loses 1 Pressure, to a minimum of 0 (adjust the Pressure pool). ' +
        '3 Native and 2 Stable: no penalty. 1 Strained: AC -1 and all speeds -10 ft. 0 Depressurized: all speeds halved, it cannot use ' +
        'Abrasive Jet, and it has disadvantage on Strength and Dexterity checks and saving throws.',
      effects: [
        gated(stat('ac', 'add', -1), p(1)),
        gated(stat('speed', 'add', -10), p(1)),
        gated(stat('speed', 'scale', 0.5), p(0)),
        gated(adv('Strength and Dexterity ability checks', 'disadvantage'), p(0)),
        gated(adv('Strength and Dexterity saving throws', 'disadvantage'), p(0)),
      ],
    }),
    feature({
      id: 'glassback_compress', name: 'Compress', source,
      description:
        'As an action, the Glassback seals and compresses its body. It regains 1 Pressure, to a maximum of 3. Until the start of its ' +
        'next turn its speed becomes 0 and it has resistance to bludgeoning, piercing, and slashing damage.',
      activation: activation('action'),
      abilityEffects: [
        { type: 'restore_resource', resourceId: PRESSURE, amount: 1 },
        { type: 'apply_condition', conditionId: 'glassback_compressed', duration: { unit: 'rounds', remaining: 1 } },
      ],
      tags: ['utility', 'buff'],
    }),
    feature({
      id: 'glassback_multiattack', name: 'Multiattack', source,
      description: 'The Glassback makes two attacks, choosing from Grinding Mandibles and Forelimb Crush.',
    }),
    feature({
      id: 'glassback_grinding_mandibles', name: 'Grinding Mandibles', source,
      description:
        'Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 15 (2d10 + 4) piercing damage. Against an object made primarily of ' +
        'metal, stone, crystal, or another mineral material, the attack deals an additional 7 (2d6) damage.',
      activation: activation('action', { range: '5 feet', target: 'single' }),
      abilityEffects: [{ type: 'damage', dice: '2d10+4', damageType: 'piercing' }],
      tags: ['attack', 'damage'],
    }),
    feature({
      id: 'glassback_forelimb_crush', name: 'Forelimb Crush', source,
      description:
        'Melee Weapon Attack: +7 to hit, reach 10 ft., one target. Hit: 13 (2d8 + 4) bludgeoning damage. If the target is Medium or ' +
        'smaller, it must succeed on a DC 15 Strength saving throw or be pushed 5 feet and knocked prone.',
      activation: activation('action', { range: '10 feet', target: 'single' }),
      abilityEffects: [{ type: 'damage', dice: '2d8+4', damageType: 'bludgeoning' }],
      tags: ['attack', 'damage'],
    }),
    feature({
      id: 'glassback_abrasive_jet', name: 'Abrasive Jet (Recharge 5-6)', source,
      description:
        'Recharge 5-6. The Glassback expels a high-pressure stream of mineral slurry in a 30-foot-long, 5-foot-wide line. Each creature in ' +
        'the line makes a DC 15 Dexterity saving throw. On a failure it takes 18 (4d8) slashing damage and 7 (2d6) acid damage and its speed is ' +
        'reduced by 10 feet until the end of its next turn; on a success it takes half as much and suffers no speed reduction. The slurry ' +
        'crystallizes: the line is difficult terrain until the end of the Glassback\'s next turn. It cannot use Abrasive Jet at 0 Pressure.',
      activation: activation('action', { range: '30 feet line', target: 'area', requiresSave: { ability: 'dex', dc: 15 } }),
      abilityEffects: [
        { type: 'damage', dice: '4d8', damageType: 'slashing', saveOnSuccess: 'half' },
        { type: 'damage', dice: '2d6', damageType: 'acid', saveOnSuccess: 'half' },
      ],
      tags: ['damage', 'aoe', 'save'],
    }),
    feature({
      id: 'glassback_pressure_collapse', name: 'Pressure Collapse', source,
      description:
        'When the Glassback is reduced to 0 hit points, its internal pressure catastrophically equalizes. Each creature within 10 feet makes a ' +
        'DC 15 Dexterity saving throw; on a failure it takes 9 (2d8) slashing damage and is pushed 5 feet away, on a success half damage and ' +
        'it is not pushed. Afterward the body becomes a hollow mass of brittle ceramic plates, crystallized mineral fluid, and dense deposits.',
      trigger: 'The Glassback is reduced to 0 hit points.',
      activation: activation('free', { range: '10 feet', target: 'area', requiresSave: { ability: 'dex', dc: 15 } }),
      abilityEffects: [{ type: 'damage', dice: '2d8', damageType: 'slashing', saveOnSuccess: 'half' }],
      tags: ['damage', 'aoe', 'save'],
    }),
    feature({
      id: 'glassback_combat_behavior', name: 'Combat Behavior', source,
      description:
        '1) Seek exposed metal, salt, crystal, or ore. 2) Attack heavily equipped creatures before lightly equipped ones if the threat is otherwise ' +
        'similar. 3) Use Abrasive Jet when multiple targets or mineral-bearing objects line up. 4) Use Forelimb Crush to create space when ' +
        'surrounded. 5) At low Pressure, Compress or retreat toward denser terrain. 6) When badly injured, burrow toward deeper, higher-pressure ' +
        'ground rather than fight to the death. It may ignore a motionless, lightly equipped creature if a richer mineral source is nearby.',
    }),
  ],
};
