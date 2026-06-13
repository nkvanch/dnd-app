// ============================================================================
// FILE: src/content/conditions/index.ts
// The 15 PHB standard conditions as first-class content.
//
// Each Condition carries Feature(s) with Effects that the engine can apply.
// When applyCondition() fires, it adds these features to entity.features with
// source: { kind: 'condition', refId: conditionId }, making them visible to
// collectAllEffects() and the audit trail.
//
// Automatable in the current pipeline (stat_modifier effects):
//   Grappled, Restrained, Paralyzed, Stunned, Petrified → speed = 0
//
// Not yet automatable (advantage/disadvantage on rolls, auto-fail saves):
//   These keep their hardcoded CONDITION_WARNINGS reminder text in TabCharacter.
//   Moving them to content here makes the architecture correct even before the
//   advantage tracking system exists — they simply have empty features[] for now.
// ============================================================================
import { Condition } from '../../engine/types';

const speedZeroFeature = (conditionId: string, conditionName: string) => ({
  id:          `${conditionId}_speed`,
  name:        conditionName,
  description: 'Speed is reduced to 0.',
  source:      { kind: 'condition' as const, refId: conditionId },
  level:       null,
  effects:     [{
    type:      'stat_modifier' as const,
    target:    'speed',
    operation: 'set' as const,
    value:     0,
    condition: null,
  }],
  actions:  [],
  choices:  [],
  passive:  true,
});

export const ALL_CONDITIONS: Condition[] = [

  {
    id:          'blinded',
    name:        'Blinded',
    description: 'A blinded creature can\'t see and automatically fails any ability check that requires sight. Attack rolls against the creature have advantage, and the creature\'s attack rolls have disadvantage.',
    features:    [],
  },

  {
    id:          'charmed',
    name:        'Charmed',
    description: 'A charmed creature can\'t attack the charmer or target the charmer with harmful abilities or magical effects. The charmer has advantage on any ability check to interact socially with the creature.',
    features:    [],
  },

  {
    id:          'deafened',
    name:        'Deafened',
    description: 'A deafened creature can\'t hear and automatically fails any ability check that requires hearing.',
    features:    [],
  },

  {
    id:          'frightened',
    name:        'Frightened',
    description: 'A frightened creature has disadvantage on ability checks and attack rolls while the source of its fear is within line of sight. The creature can\'t willingly move closer to the source of its fear.',
    features:    [],
  },

  {
    id:          'grappled',
    name:        'Grappled',
    description: 'A grappled creature\'s speed becomes 0, and it can\'t benefit from any bonus to its speed.',
    features:    [speedZeroFeature('grappled', 'Grappled')],
  },

  {
    id:          'incapacitated',
    name:        'Incapacitated',
    description: 'An incapacitated creature can\'t take actions or reactions.',
    features:    [],
  },

  {
    id:          'invisible',
    name:        'Invisible',
    description: 'An invisible creature is impossible to see without the aid of magic or a special sense. Attack rolls against the creature have disadvantage, and the creature\'s attack rolls have advantage.',
    features:    [],
  },

  {
    id:          'paralyzed',
    name:        'Paralyzed',
    description: 'A paralyzed creature is incapacitated and can\'t move or speak. The creature automatically fails Strength and Dexterity saving throws. Attack rolls against the creature have advantage and are critical hits within 5 feet.',
    features:    [speedZeroFeature('paralyzed', 'Paralyzed')],
  },

  {
    id:          'petrified',
    name:        'Petrified',
    description: 'A petrified creature is transformed into a solid inanimate substance. It is incapacitated, can\'t move or speak, and is unaware of its surroundings. It automatically fails STR and DEX saves. Attack rolls against it have advantage. It has resistance to all damage.',
    features:    [speedZeroFeature('petrified', 'Petrified')],
  },

  {
    id:          'poisoned',
    name:        'Poisoned',
    description: 'A poisoned creature has disadvantage on attack rolls and ability checks.',
    features:    [],
  },

  {
    id:          'prone',
    name:        'Prone',
    description: 'A prone creature\'s only movement option is to crawl, unless it stands up. The creature has disadvantage on attack rolls. An attack roll against the creature has advantage if the attacker is within 5 feet, otherwise disadvantage.',
    features:    [],
  },

  {
    id:          'restrained',
    name:        'Restrained',
    description: 'A restrained creature\'s speed becomes 0. Attack rolls against it have advantage, and its attack rolls have disadvantage. It has disadvantage on Dexterity saving throws.',
    features:    [speedZeroFeature('restrained', 'Restrained')],
  },

  {
    id:          'stunned',
    name:        'Stunned',
    description: 'A stunned creature is incapacitated, can\'t move, and can speak only falteringly. It automatically fails STR and DEX saves. Attack rolls against it have advantage.',
    features:    [speedZeroFeature('stunned', 'Stunned')],
  },

  {
    id:          'unconscious',
    name:        'Unconscious',
    description: 'An unconscious creature is incapacitated, can\'t move or speak, and is unaware of its surroundings. It automatically fails STR and DEX saves. Attack rolls against it have advantage and are critical hits within 5 feet.',
    features:    [speedZeroFeature('unconscious', 'Unconscious')],
  },
];

/** Fast lookup by condition id. */
export const CONDITIONS_BY_ID: Record<string, Condition> =
  Object.fromEntries(ALL_CONDITIONS.map(c => [c.id, c]));
