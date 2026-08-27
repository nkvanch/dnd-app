// ============================================================================
// FILE: src/content/subclasses/monk.ts
// Monk subclasses: Way of the Open Hand, Way of Shadow, Way of Mercy,
// Way of the Ascendant Dragon, Way of the Astral Self, Way of the Drunken
// Master, Way of the Four Elements, Way of the Kensei, Way of the Long
// Death, Way of the Sun Soul
// ============================================================================
import { ChoiceOption, ClassProgression, Feature } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

export const openHandProgression: SubclassProgression = {
  classId: 'monk', name: 'Way of the Open Hand', srd: true,
  entries: [
    { level: 3, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'open_hand_technique', name: 'Open Hand Technique', description: 'When you hit a creature with a Flurry of Blows, impose one effect: prone on DEX save, pushed up to 15 feet on STR save, or unable to take reactions until end of your next turn. Which effect and its save are chosen per-use — no rider is auto-applied, resolve manually.', source: { kind: 'subclass', refId: 'open_hand' }, level: 3, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'free', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [],
    } }] },
    { level: 6, hpDie: 8, choices: [], grants: [
      { kind: 'feature', value: { id: 'wholeness_of_body', name: 'Wholeness of Body', description: 'Regain HP equal to three times your monk level as an action. No level-scaling dice-string generator exists in the engine, so the amount is stated here rather than rolled — track it at the table.', source: { kind: 'subclass', refId: 'open_hand' }, level: 6, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'action', resourceCost: { resourceId: 'open_hand_recovery_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
        abilityEffects: [],
      } },
      { kind: 'resource', value: { resourceId: 'open_hand_recovery_pool', name: 'Wholeness of Body', maximum: 1, recharge: 'long_rest' } },
    ] },
    { level: 11, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'tranquility', name: 'Tranquility', description: 'Gain the effect of a Sanctuary spell at the end of each long rest (until you attack or cast a spell). Persistent buff-until-attacked with no tracking system in the engine — resolve manually.', source: { kind: 'subclass', refId: 'open_hand' }, level: 11, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 17, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'quivering_palm', name: 'Quivering Palm', description: 'When you hit with an unarmed strike, spend 3 ki to set up lethal vibrations. Within 30 days, use your action to reduce the creature to 0 HP or deal 10d10 necrotic (CON save for half). The delayed activate-later step has no trigger system — this card only tracks the ki cost of setting it up.', source: { kind: 'subclass', refId: 'open_hand' }, level: 17, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: { resourceId: 'ki_pool', quantity: 3 }, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [],
    } }] },
  ],
};

export const shadowProgression: SubclassProgression = {
  classId: 'monk', name: 'Way of Shadow', srd: false,
  entries: [
    { level: 3, hpDie: 8, choices: [], grants: [
      { kind: 'feature', value: { id: 'shadow_arts_darkness', name: 'Shadow Arts: Darkness', description: 'Spend 2 ki to cast Darkness without providing material components.', source: { kind: 'subclass', refId: 'shadow' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'action', resourceCost: { resourceId: 'ki_pool', quantity: 2 }, range: 'self', target: 'self', requiresSave: null },
        abilityEffects: [{ type: 'cast_spell', spellId: 'darkness' }],
      } },
      { kind: 'feature', value: { id: 'shadow_arts_pass_without_trace', name: 'Shadow Arts: Pass Without Trace', description: 'Spend 2 ki to cast Pass without Trace without providing material components.', source: { kind: 'subclass', refId: 'shadow' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'action', resourceCost: { resourceId: 'ki_pool', quantity: 2 }, range: 'self', target: 'self', requiresSave: null },
        abilityEffects: [{ type: 'cast_spell', spellId: 'pass_without_trace' }],
      } },
      { kind: 'feature', value: { id: 'shadow_arts_silence', name: 'Shadow Arts: Silence', description: 'Spend 2 ki to cast Silence without providing material components.', source: { kind: 'subclass', refId: 'shadow' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'action', resourceCost: { resourceId: 'ki_pool', quantity: 2 }, range: 'self', target: 'self', requiresSave: null },
        abilityEffects: [{ type: 'cast_spell', spellId: 'silence' }],
      } },
      { kind: 'feature', value: { id: 'shadow_arts_darkvision', name: 'Shadow Arts: Darkvision', description: 'Spend 2 ki to cast Darkvision on yourself without providing material components. Darkvision isn\'t in the spell content pack — stays description-only, track the ki spend manually.', source: { kind: 'subclass', refId: 'shadow' }, level: 3, effects: [], actions: [], choices: [], passive: false } },
    ] },
    { level: 6, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'shadow_step', name: 'Shadow Step', description: 'While in dim light or darkness, teleport to an unoccupied space within 60 feet that is also dim light or darkness as a bonus action. Advantage on first melee attack after teleport — the advantage isn\'t auto-applied, note it for your next attack roll.', source: { kind: 'subclass', refId: 'shadow' }, level: 6, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'bonus_action', resourceCost: null, range: '60 feet', target: 'self', requiresSave: null },
      abilityEffects: [],
    } }] },
    { level: 11, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'cloak_of_shadows', name: 'Cloak of Shadows', description: 'When in dim light or darkness, spend an action to become invisible until you attack, cast a spell, or enter bright light.', source: { kind: 'subclass', refId: 'shadow' }, level: 11, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
      abilityEffects: [{ type: 'apply_condition', conditionId: 'invisible', duration: { unit: 'until_rest', remaining: 1 } }],
    } }] },
    { level: 17, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'opportunist', name: 'Opportunist', description: 'When a creature within 5 feet is hit by an attack made by someone other than you, use your reaction to make a melee attack against that creature.', source: { kind: 'subclass', refId: 'shadow' }, level: 17, effects: [], actions: [], choices: [], passive: false } }] },
  ],
};

// ── Way of Mercy ──────────────────────────────────────────────────────────────
export const mercyProgression: SubclassProgression = {
  classId: 'monk', name: 'Way of Mercy', srd: false,
  entries: [
    { level: 3, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'implements_of_mercy', name: 'Implements of Mercy', description: 'Gain proficiency in Insight and Medicine, and with the herbalism kit. You also carry a mask you wear while using this tradition\'s features.', source: { kind: 'subclass', refId: 'mercy' }, level: 3, effects: [
          { type: 'grant_proficiency', target: 'skill:insight', operation: 'add', value: null, condition: null },
          { type: 'grant_proficiency', target: 'skill:medicine', operation: 'add', value: null, condition: null },
          { type: 'grant_proficiency', target: 'tool:herbalism_kit', operation: 'add', value: null, condition: null },
        ], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'hands_of_healing', name: 'Hands of Healing', description: 'As an action, spend 1 ki point and touch a creature to restore hit points equal to a roll of your Martial Arts die plus your Wisdom modifier. You can substitute one Flurry of Blows strike with this feature at no extra ki cost.', source: { kind: 'subclass', refId: 'mercy' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'ki_pool', quantity: 1 }, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'heal', dice: '1d4', bonusMod: 'wis' }] } },
        { kind: 'feature', value: { id: 'hands_of_harm', name: 'Hands of Harm', description: 'Once per turn when you hit with an unarmed strike, spend 1 ki point to deal extra necrotic damage equal to a roll of your Martial Arts die plus your Wisdom modifier.', source: { kind: 'subclass', refId: 'mercy' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: { resourceId: 'ki_pool', quantity: 1 }, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d4', damageType: 'necrotic' }] } },
      ] },
    { level: 6, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'physicians_touch', name: "Physician's Touch", description: 'Hands of Healing can also end one disease or the blinded, deafened, paralyzed, poisoned, or stunned condition. Hands of Harm can instead inflict the poisoned condition until the end of your next turn.', source: { kind: 'subclass', refId: 'mercy' }, level: 6, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 11, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'flurry_of_healing_and_harm', name: 'Flurry of Healing and Harm', description: 'Every strike of a Flurry of Blows can be replaced with Hands of Healing at no ki cost, and one strike in the flurry can also trigger Hands of Harm without spending its ki point (Hands of Harm is still limited to once per turn).', source: { kind: 'subclass', refId: 'mercy' }, level: 11, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 17, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'hand_of_ultimate_mercy_pool', name: 'Hand of Ultimate Mercy', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'hand_of_ultimate_mercy', name: 'Hand of Ultimate Mercy', description: 'As an action, touch the corpse of a creature that died within the last 24 hours and spend 5 ki points to return it to life with 4d10 plus your Wisdom modifier hit points, removing the blinded, deafened, paralyzed, poisoned, and stunned conditions it died with. Usable once per long rest.', source: { kind: 'subclass', refId: 'mercy' }, level: 17, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'hand_of_ultimate_mercy_pool', quantity: 1 }, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'heal', dice: '4d10', bonusMod: 'wis' }] } },
      ] },
  ],
};

// ── Way of the Ascendant Dragon ──────────────────────────────────────────────
export const ascendantDragonProgression: SubclassProgression = {
  classId: 'monk', name: 'Way of the Ascendant Dragon', srd: false,
  entries: [
    { level: 3, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'draconic_disciple', name: 'Draconic Disciple', description: 'Gain three benefits: once per long rest, reroll a failed Charisma (Intimidation) or (Persuasion) check as a reaction; change the damage type of your unarmed strikes to acid, cold, fire, lightning, or poison; and learn to speak, read, and write Draconic or another language.', source: { kind: 'subclass', refId: 'ascendant_dragon' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'resource', value: { resourceId: 'breath_of_dragon_pool', name: 'Breath of the Dragon (scales with proficiency bonus)', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'breath_of_the_dragon', name: 'Breath of the Dragon', description: 'Replace one attack of the Attack action with a 20-foot cone or 30-foot line of draconic energy (acid, cold, fire, lightning, or poison, your choice). Each creature in the area makes a Dexterity save against your ki save DC, taking 2 rolls of your Martial Arts die of that damage type on a failure (3 rolls at level 11), half on a success. Usable a number of times equal to your proficiency bonus per long rest — tracked here as a single-use pool; increase its maximum to match. Also usable by spending 2 ki points once uses run out.', source: { kind: 'subclass', refId: 'ascendant_dragon' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: { resourceId: 'breath_of_dragon_pool', quantity: 1 }, range: '30 feet', target: 'multiple', requiresSave: { ability: 'dex', dc: 'spell_save_dc' } },
          abilityEffects: [{ type: 'damage', dice: '2d10', damageType: 'acid', saveOnSuccess: 'half' }] } },
      ] },
    { level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'wings_unfurled_pool', name: 'Wings Unfurled (scales with proficiency bonus)', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'wings_unfurled', name: 'Wings Unfurled', description: 'When you use Step of the Wind, spectral draconic wings unfurl, granting a flying speed equal to your walking speed until the end of the turn. Usable a number of times equal to your proficiency bonus per long rest — tracked here as a single-use pool; increase its maximum to match.', source: { kind: 'subclass', refId: 'ascendant_dragon' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'wings_unfurled_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [{ type: 'grant_speed', speedType: 'fly', amount: 30, duration: { unit: 'rounds', remaining: 1 } }] } },
      ] },
    { level: 11, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'aspect_of_wyrm_pool', name: 'Aspect of the Wyrm', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'aspect_of_the_wyrm', name: 'Aspect of the Wyrm', description: 'As a bonus action, radiate a 10-foot draconic aura for 1 minute, choosing Frightful Presence (as a bonus action, a creature in the aura makes a Wisdom save against your ki save DC or is frightened of you for 1 minute, repeatable each turn) or Resistance (you and allies in the aura resist a chosen damage type: acid, cold, fire, lightning, or poison). Usable once per long rest, or again by spending 3 ki points.', source: { kind: 'subclass', refId: 'ascendant_dragon' }, level: 11, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'aspect_of_wyrm_pool', quantity: 1 }, range: '10 feet', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 17, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'ascendant_aspect', name: 'Ascendant Aspect', description: 'Gain blindsight out to 10 feet; spend 1 ki point when using Breath of the Dragon to expand it to a 60-foot cone or 90-foot line dealing 4 rolls of your Martial Arts die; and when you activate Aspect of the Wyrm, creatures you choose in the aura make a Dexterity save against your ki save DC or take 3d10 damage of a type you choose from acid, cold, fire, lightning, or poison.', source: { kind: 'subclass', refId: 'ascendant_dragon' }, level: 17, effects: [
      { type: 'grant_sense', target: 'senses', operation: 'add', value: null, condition: null, senseType: 'blindsight', senseRange: 10 },
    ], actions: [], choices: [], passive: true } }] },
  ],
};

// ── Way of the Astral Self ───────────────────────────────────────────────────
export const astralSelfProgression: SubclassProgression = {
  classId: 'monk', name: 'Way of the Astral Self', srd: false,
  entries: [
    { level: 3, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'arms_of_the_astral_self', name: 'Arms of the Astral Self', description: 'As a bonus action, spend 1 ki point to summon spectral astral arms for 10 minutes (ending early if you\'re incapacitated or die). Each creature you choose within 10 feet must succeed on a Dexterity save or take force damage equal to 2 rolls of your Martial Arts die. While the arms persist, use Wisdom in place of Strength for checks and saves, make unarmed strikes with them at 5 feet greater reach using Wisdom for the attack and damage rolls, dealing force damage.', source: { kind: 'subclass', refId: 'astral_self' }, level: 3, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'ki_pool', quantity: 1 }, range: '10 feet', target: 'multiple', requiresSave: { ability: 'dex', dc: 'spell_save_dc' } },
      abilityEffects: [{ type: 'damage', dice: '2d8', damageType: 'force' }] } }] },
    { level: 6, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'visage_of_the_astral_self', name: 'Visage of the Astral Self', description: 'As a bonus action (or as part of the one used for Arms of the Astral Self), spend 1 ki point to summon a spectral visage for 10 minutes. While it persists you see through magical and nonmagical darkness to 120 feet, have advantage on Wisdom (Insight) and Charisma (Intimidation) checks, and can direct your speech to be heard only by a chosen creature within 60 feet or amplify it to be heard within 600 feet. The 10-minute buff and its perception/advantage riders have no duration-tracked hook — apply and remove manually.', source: { kind: 'subclass', refId: 'astral_self' }, level: 6, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'ki_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 11, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'body_of_the_astral_self', name: 'Body of the Astral Self', description: 'While both your astral arms and visage are summoned, a spectral body also appears (no action required), granting Empowered Arms (once per turn on a hit with the astral arms, deal extra damage equal to your Martial Arts die).', source: { kind: 'subclass', refId: 'astral_self' }, level: 11, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'deflect_energy', name: 'Deflect Energy', description: 'When you take acid, cold, fire, force, lightning, or thunder damage while your astral body is present, use your reaction to reduce it by 1d10 plus your Wisdom modifier (minimum 1).', source: { kind: 'subclass', refId: 'astral_self' }, level: 11, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 17, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'awakened_astral_self_pool', name: 'Awakened Astral Self', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'awakened_astral_self', name: 'Awakened Astral Self', description: 'As a bonus action, spend 5 ki points to summon your arms, visage, and body at once and awaken your astral self for 10 minutes, gaining a +2 bonus to AC and, when using Extra Attack to attack twice, the option to instead make three attacks with your astral arms.', source: { kind: 'subclass', refId: 'astral_self' }, level: 17, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'awakened_astral_self_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
  ],
};

// ── Way of the Drunken Master ────────────────────────────────────────────────
export const drunkenMasterProgression: SubclassProgression = {
  classId: 'monk', name: 'Way of the Drunken Master', srd: false,
  entries: [
    { level: 3, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'bonus_proficiencies_drunken', name: 'Bonus Proficiencies', description: 'Gain proficiency in Performance and with brewer\'s supplies, if you don\'t already have them.', source: { kind: 'subclass', refId: 'drunken_master' }, level: 3, effects: [
          { type: 'grant_proficiency', target: 'skill:performance', operation: 'add', value: null, condition: null },
          { type: 'grant_proficiency', target: 'tool:brewers_supplies', operation: 'add', value: null, condition: null },
        ], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'drunken_technique', name: 'Drunken Technique', description: 'Whenever you use Flurry of Blows, gain the benefit of the Disengage action and increase your walking speed by 10 feet until the end of the turn.', source: { kind: 'subclass', refId: 'drunken_master' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
      ] },
    { level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'leap_to_your_feet', name: 'Leap to Your Feet', description: 'Stand up from prone by spending only 5 feet of movement instead of half your speed.', source: { kind: 'subclass', refId: 'drunken_master' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'redirect_attack', name: 'Redirect Attack', description: 'When a creature misses you with a melee attack, spend 1 ki point as a reaction to redirect that attack to hit a different creature of your choice within 5 feet of you.', source: { kind: 'subclass', refId: 'drunken_master' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: { resourceId: 'ki_pool', quantity: 1 }, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 11, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'drunkards_luck', name: "Drunkard's Luck", description: 'When you have disadvantage on an ability check, attack roll, or saving throw, spend 2 ki points to cancel the disadvantage for that roll.', source: { kind: 'subclass', refId: 'drunken_master' }, level: 11, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'free', resourceCost: { resourceId: 'ki_pool', quantity: 2 }, range: 'self', target: 'self', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 17, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'intoxicated_frenzy', name: 'Intoxicated Frenzy', description: 'When you use Flurry of Blows, you can make up to three additional attacks with it (up to five total), provided each attack targets a different creature.', source: { kind: 'subclass', refId: 'drunken_master' }, level: 17, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

// ── Way of the Four Elements ─────────────────────────────────────────────────
// Sixteen elemental disciplines (plus the always-known Elemental Attunement)
// share a single pool, learned one at a time at levels 3/6/11/17 via
// feature_pool, matching the Rune Knight/Arcane Archer precedent. Every
// discipline that replicates a real spell in this codebase's spell library
// gets a real cast_spell hook; Rush of the Gale Spirits (Gust of Wind) and
// Wave of Rolling Earth (Wall of Stone) reference spells that aren't in the
// content pack yet, so they stay description-only.
function discipline(
  id: string, name: string, description: string, kiCost: number,
  actionType: 'action' | 'free' | 'bonus_action', range: string,
  abilityEffects: Feature['abilityEffects'] = [],
  requiresSave: { ability: import('../../engine/types').Ability; dc: 'spell_save_dc' | number } | null = null,
  target: 'self' | 'single' | 'area' | 'multiple' = 'single',
): Feature {
  return {
    id, name, description,
    source: { kind: 'subclass', refId: 'four_elements' },
    level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType, resourceCost: { resourceId: 'ki_pool', quantity: kiCost }, range, target, requiresSave },
    abilityEffects,
  };
}
const ELEMENTAL_DISCIPLINE_POOL: ChoiceOption[] = [
  { id: 'fangs_of_the_fire_snake', label: 'Fangs of the Fire Snake', value: discipline('disc_fangs_fire_snake', 'Fangs of the Fire Snake', 'As part of the Attack action, spend 1 ki point: your unarmed strikes gain 10 feet of reach and deal fire damage instead of bludgeoning; spend 1 more ki point on a hit to deal extra fire damage.', 1, 'free', '15 feet', [{ type: 'damage', dice: '1d10', damageType: 'fire' }]) },
  { id: 'fist_of_unbroken_air', label: 'Fist of Unbroken Air', value: discipline('disc_fist_unbroken_air', 'Fist of Unbroken Air', 'As an action, spend 2 ki points and choose a creature within 30 feet; it makes a Strength save against your ki save DC, taking 3d10 bludgeoning damage (plus 1d10 per additional ki point spent) and being pushed 20 feet and knocked prone on a failure, half damage and no push/prone on a success.', 2, 'action', '30 feet', [{ type: 'damage', dice: '3d10', damageType: 'bludgeoning', saveOnSuccess: 'half' }], { ability: 'str', dc: 'spell_save_dc' }) },
  { id: 'fist_of_four_thunders', label: 'Fist of Four Thunders', value: discipline('disc_fist_four_thunders', 'Fist of Four Thunders', 'Spend 2 ki points to cast Thunderwave without material components.', 2, 'action', 'self', [{ type: 'cast_spell', spellId: 'thunderwave' }]) },
  { id: 'rush_of_gale_spirits', label: 'Rush of the Gale Spirits', value: { id: 'disc_rush_gale_spirits', name: 'Rush of the Gale Spirits', description: 'Spend 2 ki points to cast Gust of Wind without material components. Gust of Wind isn\'t in this codebase\'s spell library yet — no cast_spell hook until it\'s added.', source: { kind: 'subclass', refId: 'four_elements' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: { resourceId: 'ki_pool', quantity: 2 }, range: 'self', target: 'self', requiresSave: null }, abilityEffects: [] } as Feature },
  { id: 'shape_the_flowing_river', label: 'Shape the Flowing River', value: discipline('disc_shape_flowing_river', 'Shape the Flowing River', 'As an action, spend 1 ki point to freeze, melt, or reshape up to a 30-foot cube of ice or water within 120 feet.', 1, 'action', '120 feet') },
  { id: 'sweeping_cinder_strike', label: 'Sweeping Cinder Strike', value: discipline('disc_sweeping_cinder_strike', 'Sweeping Cinder Strike', 'Spend 2 ki points to cast Burning Hands without material components.', 2, 'action', 'self', [{ type: 'cast_spell', spellId: 'burning_hands' }]) },
  { id: 'water_whip', label: 'Water Whip', value: discipline('disc_water_whip', 'Water Whip', 'As an action, spend 2 ki points and choose a creature within 30 feet; it makes a Dexterity save against your ki save DC, taking 3d10 bludgeoning damage (plus 1d10 per additional ki point spent) and being knocked prone or pulled 25 feet closer on a failure, half damage and no prone/pull on a success.', 2, 'action', '30 feet', [{ type: 'damage', dice: '3d10', damageType: 'bludgeoning', saveOnSuccess: 'half' }], { ability: 'dex', dc: 'spell_save_dc' }) },
  { id: 'clench_of_the_north_wind', label: 'Clench of the North Wind (level 6+)', value: discipline('disc_clench_north_wind', 'Clench of the North Wind', 'Requires level 6. Spend 3 ki points to cast Hold Person without material components.', 3, 'action', 'self', [{ type: 'cast_spell', spellId: 'hold_person' }]) },
  { id: 'gong_of_the_summit', label: 'Gong of the Summit (level 6+)', value: discipline('disc_gong_summit', 'Gong of the Summit', 'Requires level 6. Spend 3 ki points to cast Shatter without material components.', 3, 'action', 'self', [{ type: 'cast_spell', spellId: 'shatter' }]) },
  { id: 'flames_of_the_phoenix', label: 'Flames of the Phoenix (level 11+)', value: discipline('disc_flames_phoenix', 'Flames of the Phoenix', 'Requires level 11. Spend 4 ki points to cast Fireball without material components.', 4, 'action', 'self', [{ type: 'cast_spell', spellId: 'fireball' }]) },
  { id: 'mist_stance', label: 'Mist Stance (level 11+)', value: discipline('disc_mist_stance', 'Mist Stance', 'Requires level 11. Spend 4 ki points to cast Gaseous Form on yourself without material components.', 4, 'action', 'self', [{ type: 'cast_spell', spellId: 'gaseous_form' }]) },
  { id: 'ride_the_wind', label: 'Ride the Wind (level 11+)', value: discipline('disc_ride_wind', 'Ride the Wind', 'Requires level 11. Spend 4 ki points to cast Fly on yourself without material components.', 4, 'action', 'self', [{ type: 'cast_spell', spellId: 'fly' }]) },
  { id: 'breath_of_winter', label: 'Breath of Winter (level 17+)', value: discipline('disc_breath_winter', 'Breath of Winter', 'Requires level 17. Spend 6 ki points to cast Cone of Cold without material components.', 6, 'action', 'self', [{ type: 'cast_spell', spellId: 'cone_of_cold' }]) },
  { id: 'eternal_mountain_defense', label: 'Eternal Mountain Defense (level 17+)', value: discipline('disc_eternal_mountain_defense', 'Eternal Mountain Defense', 'Requires level 17. Spend 5 ki points to cast Stoneskin on yourself without material components.', 5, 'action', 'self', [{ type: 'cast_spell', spellId: 'stoneskin' }]) },
  { id: 'river_of_hungry_flame', label: 'River of Hungry Flame (level 17+)', value: discipline('disc_river_hungry_flame', 'River of Hungry Flame', 'Requires level 17. Spend 5 ki points to cast Wall of Fire without material components.', 5, 'action', 'self', [{ type: 'cast_spell', spellId: 'wall_of_fire' }]) },
  { id: 'wave_of_rolling_earth', label: 'Wave of Rolling Earth (level 17+)', value: { id: 'disc_wave_rolling_earth', name: 'Wave of Rolling Earth', description: 'Requires level 17. Spend 6 ki points to cast Wall of Stone without material components. Wall of Stone isn\'t in this codebase\'s spell library yet — no cast_spell hook until it\'s added.', source: { kind: 'subclass', refId: 'four_elements' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: { resourceId: 'ki_pool', quantity: 6 }, range: 'self', target: 'self', requiresSave: null }, abilityEffects: [] } as Feature },
];
export const fourElementsProgression: SubclassProgression = {
  classId: 'monk', name: 'Way of the Four Elements', srd: false,
  entries: [
    { level: 3, hpDie: 8,
      choices: [{ id: 'four_elements_disciplines_3', prompt: 'Choose 1 elemental discipline (you also know Elemental Attunement for free).', kind: 'feature_pool', count: 1, pool: ELEMENTAL_DISCIPLINE_POOL, grants: [], required: true, resolved: false }],
      grants: [{ kind: 'feature', value: { id: 'elemental_attunement', name: 'Elemental Attunement', description: 'As an action, control elemental forces within 30 feet for a minor, harmless effect: create a sensory effect tied to air, earth, fire, or water; light or snuff a small flame; warm or chill up to 1 pound of material; or briefly shape a 1-foot cube of earth, fire, water, or mist.', source: { kind: 'subclass', refId: 'four_elements' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'action', resourceCost: null, range: '30 feet', target: 'self', requiresSave: null }, abilityEffects: [] } }] },
    { level: 6, hpDie: 8, choices: [{ id: 'four_elements_disciplines_6', prompt: 'Choose 1 more elemental discipline.', kind: 'feature_pool', count: 1, pool: ELEMENTAL_DISCIPLINE_POOL, grants: [], required: true, resolved: false }], grants: [] },
    { level: 11, hpDie: 8, choices: [{ id: 'four_elements_disciplines_11', prompt: 'Choose 1 more elemental discipline.', kind: 'feature_pool', count: 1, pool: ELEMENTAL_DISCIPLINE_POOL, grants: [], required: true, resolved: false }], grants: [] },
    { level: 17, hpDie: 8, choices: [{ id: 'four_elements_disciplines_17', prompt: 'Choose 1 more elemental discipline.', kind: 'feature_pool', count: 1, pool: ELEMENTAL_DISCIPLINE_POOL, grants: [], required: true, resolved: false }], grants: [] },
  ],
};

// ── Way of the Kensei ────────────────────────────────────────────────────────
// Kensei Weapons has no matching choice kind (the 'equipment' kind's value
// shape is item-ID arrays for starting gear, not a weapon-type designation) —
// left as a description-only pick rather than misusing that shape.
export const kenseiProgression: SubclassProgression = {
  classId: 'monk', name: 'Way of the Kensei', srd: false,
  entries: [
    { level: 3, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'path_of_the_kensei', name: 'Path of the Kensei', description: 'Choose one melee and one ranged weapon type (any simple or martial weapon without the heavy or special property; the longbow also qualifies) as your kensei weapons — they count as monk weapons for you. Choose another kensei weapon type at levels 6, 11, and 17. Also gain proficiency with calligrapher\'s or painter\'s supplies.', source: { kind: 'subclass', refId: 'kensei' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'agile_parry', name: 'Agile Parry', description: 'If you make an unarmed strike as part of the Attack action while holding a melee kensei weapon, use it to defend yourself: gain a +2 bonus to AC until the start of your next turn while you hold it and aren\'t incapacitated.', source: { kind: 'subclass', refId: 'kensei' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'kenseis_shot', name: "Kensei's Shot", description: 'As a bonus action, empower your ranged kensei weapon attacks: any target you hit with one before the end of the turn takes an extra 1d4 damage of the weapon\'s type.', source: { kind: 'subclass', refId: 'kensei' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: null, range: 'self', target: 'self', requiresSave: null }, abilityEffects: [] } },
      ] },
    { level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'one_with_the_blade_magic', name: 'Magic Kensei Weapons', description: 'Your attacks with kensei weapons count as magical for overcoming resistance and immunity to nonmagical attacks and damage.', source: { kind: 'subclass', refId: 'kensei' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'deft_strike', name: 'Deft Strike', description: 'Once per turn when you hit with a kensei weapon, spend 1 ki point to deal extra damage equal to your Martial Arts die.', source: { kind: 'subclass', refId: 'kensei' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: { resourceId: 'ki_pool', quantity: 1 }, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d4', damageType: 'slashing' }] } },
      ] },
    { level: 11, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'sharpen_the_blade', name: 'Sharpen the Blade', description: 'As a bonus action, spend up to 3 ki points to grant a kensei weapon you touch a bonus to attack and damage rolls equal to the ki spent, for 1 minute or until you use this again. No effect on a weapon that already has a magic bonus.', source: { kind: 'subclass', refId: 'kensei' }, level: 11, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'ki_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 17, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'unerring_accuracy', name: 'Unerring Accuracy', description: 'Once per turn, reroll a missed attack roll made with a monk weapon.', source: { kind: 'subclass', refId: 'kensei' }, level: 17, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

// ── Way of the Long Death ────────────────────────────────────────────────────
export const longDeathProgression: SubclassProgression = {
  classId: 'monk', name: 'Way of the Long Death', srd: false,
  entries: [
    { level: 3, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'touch_of_death', name: 'Touch of Death', description: 'When you reduce a creature within 5 feet to 0 hit points, gain temporary hit points equal to your Wisdom modifier plus your monk level (minimum 1). No on-kill trigger exists in the engine — apply the temporary hit points manually.', source: { kind: 'subclass', refId: 'long_death' }, level: 3, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 6, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'hour_of_reaping', name: 'Hour of Reaping', description: 'As an action, each creature within 30 feet that can see you makes a Wisdom save or is frightened of you until the end of your next turn.', source: { kind: 'subclass', refId: 'long_death' }, level: 6, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '30 feet', target: 'multiple', requiresSave: { ability: 'wis', dc: 'spell_save_dc' } },
      abilityEffects: [{ type: 'apply_condition', conditionId: 'frightened', duration: { unit: 'rounds', remaining: 1 } }] } }] },
    { level: 11, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'mastery_of_death', name: 'Mastery of Death', description: 'When reduced to 0 hit points, spend 1 ki point (no action required) to drop to 1 hit point instead.', source: { kind: 'subclass', refId: 'long_death' }, level: 11, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'free', resourceCost: { resourceId: 'ki_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 17, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'touch_of_the_long_death', name: 'Touch of the Long Death', description: 'As an action, touch a creature within 5 feet and expend 1 to 10 ki points; it makes a Constitution save, taking 2d10 necrotic damage per ki point spent on a failure, half as much on a success. This card tracks the 1-ki-point baseline — increase the resource cost and damage dice to match a larger spend.', source: { kind: 'subclass', refId: 'long_death' }, level: 17, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: { resourceId: 'ki_pool', quantity: 1 }, range: '5 feet', target: 'single', requiresSave: { ability: 'con', dc: 'spell_save_dc' } },
      abilityEffects: [{ type: 'damage', dice: '2d10', damageType: 'necrotic', saveOnSuccess: 'half' }] } }] },
  ],
};

// ── Way of the Sun Soul ──────────────────────────────────────────────────────
export const sunSoulProgression: SubclassProgression = {
  classId: 'monk', name: 'Way of the Sun Soul', srd: false,
  entries: [
    { level: 3, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'radiant_sun_bolt', name: 'Radiant Sun Bolt', description: 'Gain a ranged spell attack (30 feet, DEX-based, radiant damage using your Martial Arts die) usable as part of the Attack action; once you gain Extra Attack, any of those attacks can be a sun bolt instead.', source: { kind: 'subclass', refId: 'sun_soul' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'radiant_sun_bolt_rapid', name: 'Radiant Sun Bolt: Rapid Bolts', description: 'When you use the Attack action, spend 1 ki point to make your Radiant Sun Bolt attack twice as a bonus action instead.', source: { kind: 'subclass', refId: 'sun_soul' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'ki_pool', quantity: 1 }, range: '30 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d4', damageType: 'radiant' }] } },
      ] },
    { level: 6, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'searing_arc_strike', name: 'Searing Arc Strike', description: 'Immediately after taking the Attack action, spend 2 ki points to cast Burning Hands as a bonus action without material components. Spend additional ki points (up to half your monk level total) to cast it as a higher-level spell.', source: { kind: 'subclass', refId: 'sun_soul' }, level: 6, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'ki_pool', quantity: 2 }, range: 'self', target: 'self', requiresSave: null },
      abilityEffects: [{ type: 'cast_spell', spellId: 'burning_hands' }] } }] },
    { level: 11, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'searing_sunburst', name: 'Searing Sunburst', description: 'As an action, hurl an orb of light to a point within 150 feet that erupts into a 20-foot-radius sphere. Each creature in the sphere (unless behind total cover) makes a Constitution save or takes 2d6 radiant damage; spend up to 3 ki points to add 2d6 damage per point spent.', source: { kind: 'subclass', refId: 'sun_soul' }, level: 11, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '150 feet', target: 'multiple', requiresSave: { ability: 'con', dc: 'spell_save_dc' } },
      abilityEffects: [{ type: 'damage', dice: '2d6', damageType: 'radiant' }] } }] },
    { level: 17, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'sun_shield_aura', name: 'Sun Shield', description: 'As a bonus action, toggle a luminous aura shedding bright light 30 feet and dim light 30 feet beyond that.', source: { kind: 'subclass', refId: 'sun_soul' }, level: 17, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: null, range: 'self', target: 'self', requiresSave: null }, abilityEffects: [] } },
        { kind: 'feature', value: { id: 'sun_shield_reflection', name: 'Sun Shield: Reflection', description: 'While your Sun Shield light is active, use your reaction when a creature hits you with a melee attack to deal it radiant damage equal to 5 plus your Wisdom modifier.', source: { kind: 'subclass', refId: 'sun_soul' }, level: 17, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d4', damageType: 'radiant' }] } },
      ] },
  ],
};

export const MONK_SUBCLASSES: SubclassProgression[] = [
  openHandProgression, shadowProgression, mercyProgression, ascendantDragonProgression,
  astralSelfProgression, drunkenMasterProgression, fourElementsProgression,
  kenseiProgression, longDeathProgression, sunSoulProgression,
];
