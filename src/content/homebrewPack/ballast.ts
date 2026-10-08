// ============================================================================
// FILE: src/content/homebrewPack/ballast.ts
// Ballast (docs/homebrew/BALLAST.md) in BOTH versions the spec defines, as two separate races so a
// table can pick either: "Ballast" (Original joke version) and "Ballast (Lesser)" (the Demo
// version). They share Size choice, flexible +2/+1 ASI, speed 15, Catastrophically Dense, Negative
// Buoyancy and the language list; they differ in "No." and in the forced-movement trait.
//
//   Original: "No." costs no Reaction and has no use limit; cannot be moved against your will.
//   Lesser:   "No." is a Reaction, 1/Long Rest; advantage against being moved/shoved/knocked prone.
//
// Catastrophically Dense is the 'hit_die_tier' effect (engine/hitDieTier.ts): the class Hit Die is
// one size larger, and a die already at d12 grants +3 max HP per level in that class instead —
// resolved per class, retroactive, and picked up automatically by future levels.
// ============================================================================
import { Race, Subrace, Feature, Effect, RACE_CHOICE_PREFIX } from '../../engine/types';
import { stat, adv, feature, activation } from './helpers';

const FORCED_MOVE =
  'ability checks and saving throws to resist being shoved, knocked prone, dragged, pushed, pulled, or otherwise moved against your will';

const PROMPT = 'Increase one ability score by 2 and a different ability score by 1.';

function sharedFeatures(raceId: string): Feature[] {
  const source = { kind: 'race' as const, refId: raceId };
  return [
    feature({
      id: `${raceId}_typical_mass`, name: 'Typical Mass', source,
      description:
        'A Ballast commonly weighs roughly 500-1,000 kg. For effects involving another creature attempting to lift, ' +
        'drag, carry, throw, or otherwise physically relocate you, use your actual weight. Your body mass does not ' +
        'increase your carrying capacity, which is still set by your Strength.',
    }),
    feature({
      id: `${raceId}_reluctant_locomotion`, name: 'Reluctant Locomotion', source,
      description: 'Your walking speed is 15 feet. There is no deeper explanation. Physics is doing its best.',
      effects: [stat('speed', 'set', 15)],
    }),
    feature({
      id: `${raceId}_catastrophically_dense`, name: 'Catastrophically Dense', source,
      description:
        'Your class Hit Die increases by one die size (d6 to d8, d8 to d10, d10 to d12). If a class already uses a d12 ' +
        'Hit Die, it stays a d12 and your hit point maximum instead increases by 3 for each level you have in that ' +
        'class. This is retroactive and resolved separately for each class. It affects both the Hit Dice you spend on ' +
        'a rest and your hit point maximum.',
      effects: [stat('hit_die_tier', 'add', 1)],
    }),
    feature({
      id: `${raceId}_negative_buoyancy`, name: 'Negative Buoyancy', source,
      description:
        'You do not naturally float. Unless supported by another creature, object, or magical effect, you sink in water. ' +
        'If you reach a solid surface underwater, you can move along it using your walking speed, subject to whatever ' +
        'environmental rules the table uses. (Table-resolved.) Swimming is what happens when something fails to sink correctly.',
    }),
    feature({
      id: `${raceId}_languages`, name: 'Languages', source,
      description: 'You can speak, read, and write Common and one language of your choice.',
    }),
  ];
}

function sizeSubraces(raceId: string): Subrace[] {
  return (['Medium', 'Large'] as const).map(size => ({
    id: `${raceId}_${size.toLowerCase()}`,
    name: `${size} Ballast`,
    parentId: raceId,
    size,
    features: [
      feature({
        id: `${raceId}_size_${size.toLowerCase()}`,
        name: `Size: ${size}`,
        source: { kind: 'race', refId: raceId },
        description: size === 'Large'
          ? 'You are Large. You use the normal consequences of being a Large creature the rules already support; this grants no extra reach, larger weapon dice, or other invented benefits.'
          : 'You are Medium.',
      }),
    ],
  }));
}

const LANGUAGE_CHOICE = (raceId: string) => ({
  id: `${RACE_CHOICE_PREFIX}${raceId}_extra_language`,
  prompt: 'Choose one extra language.',
  kind: 'language' as const, count: 1, pool: 'all' as const,
  grants: [], required: true, resolved: false,
});

const FLAVOR =
  'Ballasts are a triumph of mass over mobility: broad, squat, thick-limbed, and astonishingly dense. They move slowly, ' +
  'are nearly impossible to push, drag, or knock over, and sink in water with confidence until the environment provides a ' +
  'floor. Every maritime civilization eventually discovers they are spectacularly useful around ships.';

function noOriginal(raceId: string): Feature {
  return feature({
    id: `${raceId}_no`, name: 'No.', source: { kind: 'race', refId: raceId },
    description:
      "When an attack hits you, it bounces away from you instead: the attack has no effect on you and continues in a random " +
      'direction. This does NOT use your Reaction and has no use limit. "Attack" means attack: sword, arrow, spell attack. ' +
      'The new direction cannot pass through your space toward your back, because that would be phasing, which Ballasts ' +
      'consider an entirely different and deeply suspicious phenomenon. (Ricochet direction and consequences are table-resolved.)',
    trigger: 'An attack hits you.',
  });
}

function noLesser(raceId: string): Feature {
  return feature({
    id: `${raceId}_no`, name: 'No.', source: { kind: 'race', refId: raceId },
    description:
      'When an attack hits you, you can use your Reaction to cause the attack to bounce away from you instead. The attack ' +
      'has no effect on you and continues in a random direction (never back through your space toward your back). Once ' +
      'you use this trait, you cannot use it again until you finish a Long Rest. (Ricochet direction and consequences are table-resolved.)',
    trigger: 'An attack hits you.',
    activation: activation('reaction', { resource: `${raceId}_no`, range: 'self', target: 'self' }),
    tags: ['utility'],
  });
}

const immovable = (raceId: string): Feature => feature({
  id: `${raceId}_ballast`, name: 'Ballast', source: { kind: 'race', refId: raceId },
  description:
    'You cannot be moved against your will. No size comparison. No contested roll. No discussion. The moving force has ' +
    'made a tactical error. (Applied as a table ruling: the app does not model forced movement, so it never rolls against it.)',
  trigger: 'A creature or effect tries to move you against your will.',
});

const resistant = (raceId: string): Feature => feature({
  id: `${raceId}_ballast`, name: 'Ballast', source: { kind: 'race', refId: raceId },
  description:
    'You have advantage on ability checks and saving throws made to resist being shoved, knocked prone, dragged, pushed, ' +
    'pulled, or otherwise moved against your will.',
  effects: [adv(FORCED_MOVE) as Effect],
});

export const raceBallast: Race = {
  id: 'ballast',
  name: 'Ballast',
  srd: false,
  description: FLAVOR + ' (Original version.)',
  size: 'Medium',
  age: 'Unknown. Moving the gravestone is too difficult.',
  languages: ['Common'],
  flexibleAsi: { prompt: PROMPT, mode: { kind: 'two_and_one' } },
  pendingChoices: [LANGUAGE_CHOICE('ballast')],
  subraces: sizeSubraces('ballast'),
  features: [...sharedFeatures('ballast'), noOriginal('ballast'), immovable('ballast')],
};

export const raceBallastLesser: Race = {
  id: 'ballast_lesser',
  name: 'Ballast (Lesser)',
  srd: false,
  description: FLAVOR + ' (Lesser / demo version: "No." costs a Reaction and recharges on a Long Rest, and forced movement is resisted with advantage rather than ignored.)',
  size: 'Medium',
  age: 'Unknown. Moving the gravestone is too difficult.',
  languages: ['Common'],
  flexibleAsi: { prompt: PROMPT, mode: { kind: 'two_and_one' } },
  pendingChoices: [LANGUAGE_CHOICE('ballast_lesser')],
  subraces: sizeSubraces('ballast_lesser'),
  resources: [{ resourceId: 'ballast_lesser_no', name: 'No. (bounce an attack)', maximum: 1, recharge: 'long_rest' }],
  features: [...sharedFeatures('ballast_lesser'), noLesser('ballast_lesser'), resistant('ballast_lesser')],
};
