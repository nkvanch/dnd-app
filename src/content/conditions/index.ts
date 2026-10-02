// ============================================================================
// FILE: src/content/conditions/index.ts
// The 15 PHB standard conditions as first-class content.
//
// Each Condition carries Feature(s) with Effects that the engine can apply.
// When applyCondition() fires, it adds these features to entity.features with
// source: { kind: 'condition', refId: conditionId }, making them visible to
// collectAllEffects() and the audit trail.
//
// Automated in the current pipeline:
//   - speed = 0 (stat_modifier/set):
//     Grappled, Restrained, Paralyzed, Stunned, Petrified, Unconscious
//   - self-side advantage/disadvantage on rolls (stat_modifier/advantage
//     or disadvantage, aggregated into DerivedStats.advantageStates and
//     shown as a reminder chip — table-first, never auto-applied to a
//     roll; this app has no attack-roll/save-roll automation anywhere —
//     2014 condition-mechanics closure):
//     Blinded (own attacks), Invisible (own attacks), Poisoned (own attacks
//     + ability checks), Prone (own attacks), Restrained (own attacks +
//     Dexterity saves)
//   - resistance to all damage types (grant_resistance, reuses the existing
//     typed damage pipeline — resolveResistance/applyDamage, unchanged):
//     Petrified
//   - Incapacitated/Paralyzed/Stunned/Petrified/Unconscious all block
//     Actions/Reactions — see isIncapacitated (combat.ts), not represented
//     as a Feature/Effect here at all (it's a hard action-economy gate, not
//     a derived stat).
//
// Deliberately left MANUAL/descriptive (kept in each condition's own
// `description` text and/or TabCharacter.tsx's condition-warning reminder,
// never fabricated as automation — see the 2014 condition-mechanics
// closure's own audit table for the full reasoning per condition):
//   - anything contingent on facts this engine doesn't track: attacker/
//     target distance (Prone/Paralyzed/Stunned/Unconscious crit-within-5ft),
//     line of sight or a fear/charm source's identity (Frightened, Charmed),
//     which creature is attacking whom (every "attacks AGAINST this
//     creature have advantage/disadvantage" target-side fact — Blinded,
//     Invisible, Restrained, Prone, Paralyzed, Stunned, Unconscious,
//     Petrified all have one of these and it stays manual)
//   - "automatically fails" a save/check (Paralyzed/Stunned/Petrified/
//     Unconscious STR+DEX saves; Blinded/Deafened sight/hearing checks) —
//     this app has no saving-throw/check RESOLUTION step to hook an
//     auto-fail into (table-first: the player rolls, the app never grades
//     the roll), so there is no existing primitive this could reuse without
//     building new save-resolution architecture, which is explicitly out of
//     scope for this batch
//   - narrative/flavor consequences with no mechanical number attached
//     (Petrified's material/weight, Stunned "can speak only falteringly")
// ============================================================================
import { Condition, Effect } from '../../engine/types';

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

/**
 * 2014 condition-mechanics closure: a condition's SELF-SIDE roll-modifier
 * consequence — "this creature's OWN attack rolls/ability checks/saving
 * throws have advantage/disadvantage" — reusing the exact same
 * `stat_modifier`/`advantage`|`disadvantage` Effect shape and free-text
 * `target` convention every subclass/feat/race feature in this codebase
 * already authors (see e.g. src/content/subclasses/paladin.ts's "saving
 * throws against being paralyzed or stunned"). This is NOT a new typed
 * primitive — DerivedStats.advantageStates (pipeline.ts) already aggregates
 * every such effect via resolveBinary (resolver.ts), which already gives
 * 2014's exact stacking rule for free: any advantage + any disadvantage on
 * the SAME target string cancels to straight, and multiple sources of the
 * same polarity never stack (a boolean `.some()`, not a count). Using the
 * SAME target string across different conditions (e.g. every self-attack
 * modifier below uses the literal string 'attack rolls') is deliberate —
 * two conditions that both impose disadvantage on attack rolls must be
 * treated as the ONE track 2014 actually has, not two independently-
 * stacking ones. Purely a derived-state/reminder-chip signal
 * (TabCharacter.tsx) — never auto-applied to any roll, matching this app's
 * existing "no attack-roll automation" philosophy everywhere else.
 * NEVER used for a TARGET-side fact ("attacks against this creature") —
 * those require knowing who's attacking, which this engine doesn't track;
 * see this file's own header comment for the full list left manual.
 */
const rollModifierFeature = (
  conditionId: string,
  idSuffix:    string,
  name:        string,
  description: string,
  modifiers:   { target: string; operation: 'advantage' | 'disadvantage' }[],
) => ({
  id:          `${conditionId}_${idSuffix}`,
  name,
  description,
  source:      { kind: 'condition' as const, refId: conditionId },
  level:       null,
  effects:     modifiers.map((m): Effect => ({
    type: 'stat_modifier', target: m.target, operation: m.operation, value: null, condition: null,
  })),
  actions:  [],
  choices:  [],
  passive:  true,
});

/**
 * 2014 condition-mechanics closure (Petrified, Part M): "resistance to all
 * damage" reuses the EXISTING typed damage-defense pipeline
 * (grant_resistance Effects → resolver.ts's resolveResistance →
 * combat.ts's applyDamage) rather than inventing an "all damage types"
 * wildcard — resolveResistance matches by exact `target` string, so this is
 * one grant_resistance effect per canonical damage type (mirrors the fixed
 * 13-type list already shown to players in TabInventory.tsx's item-damage
 * picker). No new architecture: this is exactly the same effect shape
 * Dwarf's poison resistance / Dragonborn's breath-weapon resistance already
 * use, just enumerated across every type instead of one.
 */
const ALL_DAMAGE_TYPES = [
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic',
  'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder',
];
const resistAllDamageFeature = (conditionId: string, conditionName: string) => ({
  id:          `${conditionId}_resist_all`,
  name:        conditionName,
  description: 'Resistance to all damage.',
  source:      { kind: 'condition' as const, refId: conditionId },
  level:       null,
  effects:     ALL_DAMAGE_TYPES.map((damageType): Effect => ({
    type: 'grant_resistance', target: damageType, operation: 'resistance', value: null, condition: null,
  })),
  actions:  [],
  choices:  [],
  passive:  true,
});

export const ALL_CONDITIONS: Condition[] = [

  {
    id:          'blinded',
    name:        'Blinded',
    description: 'A blinded creature can\'t see and automatically fails any ability check that requires sight. Attack rolls against the creature have advantage, and the creature\'s attack rolls have disadvantage.',
    // Self-side only ("the creature's attack rolls have disadvantage") —
    // "attack rolls against the creature have advantage" is a target-side
    // fact (who's attacking whom) this engine doesn't track; stays manual.
    // "automatically fails any ability check that requires sight" has no
    // save/check auto-fail architecture to hook into; stays manual.
    features:    [rollModifierFeature('blinded', 'self_attacks', 'Blinded', 'Your attack rolls have disadvantage.', [
      { target: 'attack rolls', operation: 'disadvantage' },
    ])],
  },

  {
    id:          'charmed',
    name:        'Charmed',
    // Both consequences require knowing WHO the charmer is (a persistent
    // condition-source-actor relationship this engine doesn't record — see
    // this file's header comment and Part I of the closure spec). Fully
    // manual; no fabricated source reference added in this batch.
    description: 'A charmed creature can\'t attack the charmer or target the charmer with harmful abilities or magical effects. The charmer has advantage on any ability check to interact socially with the creature.',
    features:    [],
  },

  {
    id:          'deafened',
    name:        'Deafened',
    // "Automatically fails" has no save/check auto-fail architecture to
    // hook into; stays manual (see header comment).
    description: 'A deafened creature can\'t hear and automatically fails any ability check that requires hearing.',
    features:    [],
  },

  {
    id:          'frightened',
    name:        'Frightened',
    // Both consequences are gated on "source of its fear is within line of
    // sight" — a visibility/source-identity fact this engine doesn't track.
    // Globally imposing disadvantage regardless of visibility would be
    // WRONG, not merely incomplete, so this stays fully manual rather than
    // over-applying (Part J of the closure spec).
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
    // Enforced via isIncapacitated (combat.ts) — a hard action-economy
    // gate, not a derived stat, so it has no Feature/Effect representation
    // here. features:[] is correct as-is.
    description: 'An incapacitated creature can\'t take actions or reactions.',
    features:    [],
  },

  {
    id:          'invisible',
    name:        'Invisible',
    description: 'An invisible creature is impossible to see without the aid of magic or a special sense. Attack rolls against the creature have disadvantage, and the creature\'s attack rolls have advantage.',
    // Self-side only — "attack rolls against the creature have
    // disadvantage" is a target-side fact this engine doesn't track; stays
    // manual (reminder text in TabCharacter.tsx).
    features:    [rollModifierFeature('invisible', 'self_attacks', 'Invisible', 'Your attack rolls have advantage.', [
      { target: 'attack rolls', operation: 'advantage' },
    ])],
  },

  {
    id:          'paralyzed',
    name:        'Paralyzed',
    description: 'A paralyzed creature is incapacitated and can\'t move or speak. The creature automatically fails Strength and Dexterity saving throws. Attack rolls against the creature have advantage and are critical hits within 5 feet.',
    // Incapacitated (blocks Actions/Reactions) is enforced via
    // isIncapacitated (combat.ts), not a Feature/Effect here — see this
    // file's header comment. Speed 0 already covered below. Auto-fail
    // saves, target-side attack advantage, and the within-5ft crit clause
    // all stay manual (see header).
    features:    [speedZeroFeature('paralyzed', 'Paralyzed')],
  },

  {
    id:          'petrified',
    name:        'Petrified',
    description: 'A petrified creature is transformed into a solid inanimate substance. It is incapacitated, can\'t move or speak, and is unaware of its surroundings. It automatically fails STR and DEX saves. Attack rolls against it have advantage. It has resistance to all damage. It is immune to poison and disease, though a poison or disease already in its system is suspended, not neutralized.',
    // Incapacitated (blocks Actions/Reactions) is enforced via
    // isIncapacitated (combat.ts), not a Feature/Effect here — see this
    // file's header comment. Damage-type poison immunity and disease
    // immunity are deliberately left descriptive: this app has no disease
    // system at all, and treating "immune to poison" as also granting
    // condition_immunity to the Poisoned CONDITION (rather than just poison
    // damage) is an ambiguous secondary RAW detail this batch doesn't
    // fabricate an answer for.
    features:    [speedZeroFeature('petrified', 'Petrified'), resistAllDamageFeature('petrified', 'Petrified')],
  },

  {
    id:          'poisoned',
    name:        'Poisoned',
    description: 'A poisoned creature has disadvantage on attack rolls and ability checks.',
    // Both consequences are self-side and context-free — fully automatable.
    features:    [rollModifierFeature('poisoned', 'self', 'Poisoned', 'Your attack rolls and ability checks have disadvantage.', [
      { target: 'attack rolls',   operation: 'disadvantage' },
      { target: 'ability checks', operation: 'disadvantage' },
    ])],
  },

  {
    id:          'prone',
    name:        'Prone',
    description: 'A prone creature\'s only movement option is to crawl, unless it stands up. The creature has disadvantage on attack rolls. An attack roll against the creature has advantage if the attacker is within 5 feet, otherwise disadvantage.',
    // Only "the creature has disadvantage on attack rolls" is self-side and
    // unconditional — automated. The attacker-distance-dependent clause
    // (advantage within 5ft, disadvantage beyond) needs a distance/position
    // fact this engine doesn't track; stays manual. Standing-up movement
    // cost stays manual too (no movement ledger — out of scope).
    features:    [rollModifierFeature('prone', 'self_attacks', 'Prone', 'Your attack rolls have disadvantage.', [
      { target: 'attack rolls', operation: 'disadvantage' },
    ])],
  },

  {
    id:          'restrained',
    name:        'Restrained',
    description: 'A restrained creature\'s speed becomes 0. Attack rolls against it have advantage, and its attack rolls have disadvantage. It has disadvantage on Dexterity saving throws.',
    // Speed 0 (existing) + the two self-side roll modifiers (new) are fully
    // automatable. "Attack rolls against it have advantage" is target-side
    // and stays manual.
    features:    [
      speedZeroFeature('restrained', 'Restrained'),
      rollModifierFeature('restrained', 'self', 'Restrained', 'Your attack rolls and Dexterity saving throws have disadvantage.', [
        { target: 'attack rolls',            operation: 'disadvantage' },
        { target: 'Dexterity saving throws', operation: 'disadvantage' },
      ]),
    ],
  },

  {
    id:          'stunned',
    name:        'Stunned',
    description: 'A stunned creature is incapacitated, can\'t move, and can speak only falteringly. It automatically fails STR and DEX saves. Attack rolls against it have advantage.',
    // Incapacitated (blocks Actions/Reactions) is enforced via
    // isIncapacitated (combat.ts), not a Feature/Effect here — see this
    // file's header comment. Speed 0 already covered below. Auto-fail
    // saves and target-side attack advantage stay manual (see header).
    features:    [speedZeroFeature('stunned', 'Stunned')],
  },

  {
    id:          'unconscious',
    name:        'Unconscious',
    description: 'An unconscious creature is incapacitated, can\'t move or speak, and is unaware of its surroundings. The creature drops whatever it\'s holding and falls prone. It automatically fails STR and DEX saves. Attack rolls against it have advantage and are critical hits within 5 feet.',
    // Incapacitated + speed 0 as above. "Falls prone" is a real,
    // deterministic RAW consequence but automating it would mean applying a
    // SECOND condition as a side effect of this one — no existing primitive
    // chains condition application this way (apply_condition today is only
    // an on-USE AbilityEffect, never a passive consequence of holding
    // another condition), and building that chaining mechanism for one
    // condition is out of scope for this batch. Corrected in the
    // description text above instead of silently omitted.
    features:    [speedZeroFeature('unconscious', 'Unconscious')],
  },
];

/** Fast lookup by condition id. */
export const CONDITIONS_BY_ID: Record<string, Condition> =
  Object.fromEntries(ALL_CONDITIONS.map(c => [c.id, c]));

// ── Homebrew condition lookup ────────────────────────────────────────────────
// The engine (src/engine/*) has no dependency on src/store/*, but an ability that applies a
// condition by id (combat.ts's applyAbilityEffects, preparedEncounter.ts) must find a HOMEBREW
// condition's features too, or it applies the condition with no effects. The homebrew store
// pushes its loaded conditions here; official content always wins on an id clash.
let homebrewConditionsById: Record<string, Condition> = {};

export function registerHomebrewConditions(list: readonly Condition[]): void {
  homebrewConditionsById = Object.fromEntries(list.map(c => [c.id, c]));
}

/** Official condition, else a registered homebrew one. */
export function lookupCondition(id: string): Condition | undefined {
  return CONDITIONS_BY_ID[id] ?? homebrewConditionsById[id];
}
