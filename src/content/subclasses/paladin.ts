// ============================================================================
// FILE: src/content/subclasses/paladin.ts
// Paladin subclasses: Oath of Devotion, Oath of the Ancients, Oath of
// Conquest, Oath of Glory, Oath of Redemption, Oath of Vengeance, Oath of
// the Crown, Oath of the Watchers, Oathbreaker
//
// Oath spells: like the pre-existing Devotion/Ancients, none of the new
// subclasses below grant oath spells via a known_spells Grant (the
// Cleric/Druid domainSpells()/circleSpells() pattern). About a third of the
// real oath spell lists (Armor of Agathys, Sanctuary, Guiding Bolt, Sleep,
// Alarm, Commune, and others) aren't in this codebase's spell library yet,
// so wiring the ones that ARE present would produce a subclass-by-subclass
// patchwork of some oath levels granting spells and others silently not.
// Staying consistent with the two subclasses that already shipped without
// oath spells was judged better than a half-wired addition — flagging this
// as a real, disclosed, pre-existing gap across ALL Paladin subclasses.
// ============================================================================
import { ClassProgression } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

export const devotionProgression: SubclassProgression = {
  classId: 'paladin', name: 'Oath of Devotion', srd: true,
  entries: [
    { level: 3, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'sacred_weapon', name: 'Channel Divinity: Sacred Weapon', description: 'As an action, imbue one weapon with positive energy. For 1 minute, add your CHA modifier to attack rolls. The weapon emits bright light in a 20-foot radius. The CHA-to-attack bonus isn\'t auto-calculated — the engine has no attack-roll-bonus formula hook — apply manually.', source: { kind: 'subclass', refId: 'devotion' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'action', resourceCost: { resourceId: 'channel_divinity_paladin', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
        abilityEffects: [],
      } },
      { kind: 'feature', value: { id: 'turn_the_unholy', name: 'Channel Divinity: Turn the Unholy', description: 'As an action, present your holy symbol. Fiends and undead within 30 feet must make a WIS save or be turned for 1 minute. Turning isn\'t a tracked status — the engine has no "turned" condition — resolve manually.', source: { kind: 'subclass', refId: 'devotion' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'action', resourceCost: { resourceId: 'channel_divinity_paladin', quantity: 1 }, range: '30 feet', target: 'area', requiresSave: null },
        abilityEffects: [],
      } },
    ] },
    { level: 7, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'aura_of_devotion', name: 'Aura of Devotion', description: 'You and friendly creatures within 10 feet (30 feet at L18) can\'t be charmed while you are conscious.', source: { kind: 'subclass', refId: 'devotion' }, level: 7, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 15, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'purity_of_spirit', name: 'Purity of Spirit', description: 'You are always under the effects of a Protection from Evil and Good spell.', source: { kind: 'subclass', refId: 'devotion' }, level: 15, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 20, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'holy_nimbus', name: 'Holy Nimbus', description: 'As an action, emanate an aura of sunlight for 1 minute. Bright light in a 30-foot radius. Enemies in the light take 10 radiant per turn. CHA bonus to saves against fiend/undead spells. Once per long rest.', source: { kind: 'subclass', refId: 'devotion' }, level: 20, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'action', resourceCost: { resourceId: 'holy_nimbus_pool', quantity: 1 }, range: '30 feet', target: 'area', requiresSave: null } } }, { kind: 'resource', value: { resourceId: 'holy_nimbus_pool', name: 'Holy Nimbus', maximum: 1, recharge: 'long_rest' } }] },
  ],
};

export const ancientsProgression: SubclassProgression = {
  classId: 'paladin', name: 'Oath of the Ancients', srd: false,
  entries: [
    { level: 3, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'natures_wrath', name: "Channel Divinity: Nature's Wrath", description: 'Use your action to conjure vines. A creature within 10 feet must succeed on a STR or DEX save or be restrained until the vines are destroyed (AC 10, 10 HP). Modeled as a STR save (the app has one saving-throw-ability slot per requiresSave, not "STR or DEX, target\'s choice" — note this simplification at the table).', source: { kind: 'subclass', refId: 'ancients' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'action', resourceCost: { resourceId: 'channel_divinity_paladin', quantity: 1 }, range: '10 feet', target: 'single', requiresSave: { ability: 'str', dc: 'spell_save_dc' } },
        abilityEffects: [{ type: 'apply_condition', conditionId: 'restrained', duration: { unit: 'rounds', remaining: 1 } }],
      } },
      { kind: 'feature', value: { id: 'turn_the_faithless', name: 'Channel Divinity: Turn the Faithless', description: 'Fey and fiends within 30 feet must succeed on a WIS save or be turned for 1 minute. Turning isn\'t a tracked status — the engine has no "turned" condition — resolve manually.', source: { kind: 'subclass', refId: 'ancients' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'action', resourceCost: { resourceId: 'channel_divinity_paladin', quantity: 1 }, range: '30 feet', target: 'area', requiresSave: null },
        abilityEffects: [],
      } },
    ] },
    { level: 7, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'aura_of_warding', name: 'Aura of Warding', description: 'Resistance to spell damage for you and friendly creatures within 10 feet while conscious.', source: { kind: 'subclass', refId: 'ancients' }, level: 7, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 15, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'undying_sentinel', name: 'Undying Sentinel', description: 'When you are reduced to 0 HP and are not killed outright, drop to 1 HP instead (once per long rest). Additionally, you suffer no ill effects from old age. Triggers automatically — the card here is just a tracker for whether this long rest\'s use is spent.', source: { kind: 'subclass', refId: 'ancients' }, level: 15, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'free', resourceCost: { resourceId: 'undying_sentinel_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null } } }, { kind: 'resource', value: { resourceId: 'undying_sentinel_pool', name: 'Undying Sentinel', maximum: 1, recharge: 'long_rest' } }] },
    { level: 20, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'elder_champion', name: 'Elder Champion', description: 'Transform into an avatar of nature for 1 minute. Regain 10 HP each turn. Spells cast against you by fiends/fey require double the spell slots. Bonus action to cause a creature within 10 feet to make a CON save or be magically aged.', source: { kind: 'subclass', refId: 'ancients' }, level: 20, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'elder_champion_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null } } }, { kind: 'resource', value: { resourceId: 'elder_champion_pool', name: 'Elder Champion', maximum: 1, recharge: 'long_rest' } }] },
  ],
};

// ── Oath of Conquest ─────────────────────────────────────────────────────────
export const conquestProgression: SubclassProgression = {
  classId: 'paladin', name: 'Oath of Conquest', srd: false,
  entries: [
    { level: 3, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'conquering_presence', name: 'Channel Divinity: Conquering Presence', description: 'As an action, force each creature you choose within 30 feet to make a Wisdom save or be frightened of you for 1 minute, repeatable at the end of each of its turns.', source: { kind: 'subclass', refId: 'conquest' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'action', resourceCost: { resourceId: 'channel_divinity_paladin', quantity: 1 }, range: '30 feet', target: 'multiple', requiresSave: { ability: 'wis', dc: 'spell_save_dc' } },
        abilityEffects: [{ type: 'apply_condition', conditionId: 'frightened', duration: { unit: 'minutes', remaining: 1 } }] } },
      { kind: 'feature', value: { id: 'guided_strike', name: 'Channel Divinity: Guided Strike', description: 'After you see an attack roll but before the hit or miss is announced, use your Channel Divinity to gain a +10 bonus to that roll. No hook applies the bonus after the fact — add it manually.', source: { kind: 'subclass', refId: 'conquest' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'free', resourceCost: { resourceId: 'channel_divinity_paladin', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
        abilityEffects: [] } },
    ] },
    { level: 7, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'aura_of_conquest', name: 'Aura of Conquest', description: 'While not incapacitated, creatures frightened of you have their speed reduced to 0 within 10 feet of you (30 feet at level 18), and take psychic damage equal to half your paladin level if they start their turn there.', source: { kind: 'subclass', refId: 'conquest' }, level: 7, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 15, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'scornful_rebuke', name: 'Scornful Rebuke', description: 'Whenever a creature hits you with an attack while you\'re not incapacitated, it takes psychic damage equal to your Charisma modifier (minimum 1). Flat ability-modifier damage with no attached die and no on-hit trigger — apply manually.', source: { kind: 'subclass', refId: 'conquest' }, level: 15, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 20, hpDie: 10, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'invincible_conqueror_pool', name: 'Invincible Conqueror', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'invincible_conqueror', name: 'Invincible Conqueror', description: 'As an action, become an avatar of conquest for 1 minute: resistance to all damage, one additional attack when you take the Attack action, and melee weapon attacks critically hit on 19-20. Usable once per long rest.', source: { kind: 'subclass', refId: 'conquest' }, level: 20, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'invincible_conqueror_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
  ],
};

// ── Oath of Glory ────────────────────────────────────────────────────────────
export const gloryProgression: SubclassProgression = {
  classId: 'paladin', name: 'Oath of Glory', srd: false,
  entries: [
    { level: 3, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'peerless_athlete', name: 'Channel Divinity: Peerless Athlete', description: 'As a bonus action, gain advantage on Strength (Athletics) and Dexterity (Acrobatics) checks, double carrying/pushing/dragging/lifting capacity, and 10 extra feet on long and high jumps, for 10 minutes.', source: { kind: 'subclass', refId: 'glory' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'channel_divinity_paladin', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
        abilityEffects: [] } },
      { kind: 'feature', value: { id: 'inspiring_smite', name: 'Channel Divinity: Inspiring Smite', description: 'Immediately after dealing damage with Divine Smite, use a bonus action to distribute 2d8 plus your paladin level in temporary hit points among creatures you choose within 30 feet (yourself included).', source: { kind: 'subclass', refId: 'glory' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'channel_divinity_paladin', quantity: 1 }, range: '30 feet', target: 'multiple', requiresSave: null },
        abilityEffects: [] } },
    ] },
    { level: 7, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'aura_of_alacrity', name: 'Aura of Alacrity', description: 'Your walking speed increases by 10 feet. While you\'re not incapacitated, an ally who starts their turn within 5 feet of you (10 feet at level 18) also gains 10 feet of walking speed until the end of that turn.', source: { kind: 'subclass', refId: 'glory' }, level: 7, effects: [
      { type: 'stat_modifier', target: 'speed', operation: 'add', value: 10, condition: null },
    ], actions: [], choices: [], passive: true } }] },
    { level: 15, hpDie: 10, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'glorious_defense_pool', name: 'Glorious Defense (scales with Charisma modifier)', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'glorious_defense', name: 'Glorious Defense', description: 'When you or a creature within 10 feet is hit by an attack, use your reaction to grant a bonus to its AC equal to your Charisma modifier (minimum 1), potentially causing a miss; if it misses, you can make one weapon attack against the attacker if in range. Usable a number of times equal to your Charisma modifier (minimum once) per long rest — tracked here as a single-use pool; increase its maximum to match.', source: { kind: 'subclass', refId: 'glory' }, level: 15, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: { resourceId: 'glorious_defense_pool', quantity: 1 }, range: '10 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 20, hpDie: 10, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'living_legend_pool', name: 'Living Legend', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'living_legend', name: 'Living Legend', description: 'As a bonus action, gain the following for 1 minute: advantage on all Charisma checks; once per turn, turn a missed weapon attack into a hit; and reaction-reroll a failed saving throw (must keep the new result). Usable once per long rest, or again by spending a 5th-level spell slot.', source: { kind: 'subclass', refId: 'glory' }, level: 20, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'living_legend_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
  ],
};

// ── Oath of Redemption ───────────────────────────────────────────────────────
export const redemptionProgression: SubclassProgression = {
  classId: 'paladin', name: 'Oath of Redemption', srd: false,
  entries: [
    { level: 3, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'emissary_of_peace', name: 'Channel Divinity: Emissary of Peace', description: 'As a bonus action, gain a +5 bonus to Charisma (Persuasion) checks for the next 10 minutes.', source: { kind: 'subclass', refId: 'redemption' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'channel_divinity_paladin', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
        abilityEffects: [] } },
      { kind: 'feature', value: { id: 'rebuke_the_violent', name: 'Channel Divinity: Rebuke the Violent', description: 'Immediately after an attacker within 30 feet damages a creature other than you, use your reaction to force a Wisdom save; on a failure it takes radiant damage equal to the damage it just dealt, half on a success. The rebuke damage mirrors whatever the attacker just rolled — no fixed die to attach here, so it stays untracked.', source: { kind: 'subclass', refId: 'redemption' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'reaction', resourceCost: { resourceId: 'channel_divinity_paladin', quantity: 1 }, range: '30 feet', target: 'single', requiresSave: { ability: 'wis', dc: 'spell_save_dc' } },
        abilityEffects: [] } },
    ] },
    { level: 7, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'aura_of_the_guardian', name: 'Aura of the Guardian', description: 'When a creature within 10 feet (30 feet at level 18) takes damage, use your reaction to take that damage yourself instead; it can\'t be reduced in any way and no other effects transfer.', source: { kind: 'subclass', refId: 'redemption' }, level: 7, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'reaction', resourceCost: null, range: '10 feet', target: 'single', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 15, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'protective_spirit', name: 'Protective Spirit', description: 'If you end your turn in combat below half your hit point maximum and aren\'t incapacitated, regain 1d6 plus half your paladin level in hit points.', source: { kind: 'subclass', refId: 'redemption' }, level: 15, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 20, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'emissary_of_redemption', name: 'Emissary of Redemption', description: 'You have resistance to all damage from other creatures, and whenever a creature hits you with an attack, it takes radiant damage equal to half the damage you took. Both benefits switch off against a creature you attack, damage, or target with a spell, until you finish a long rest.', source: { kind: 'subclass', refId: 'redemption' }, level: 20, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

// ── Oath of Vengeance ────────────────────────────────────────────────────────
export const vengeanceProgression: SubclassProgression = {
  classId: 'paladin', name: 'Oath of Vengeance', srd: false,
  entries: [
    { level: 3, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'abjure_enemy', name: 'Channel Divinity: Abjure Enemy', description: 'As an action, target a creature within 60 feet with a Wisdom save (fiends and undead have disadvantage on it). On a failure it\'s frightened for 1 minute or until it takes damage, with speed 0 and no speed bonuses; on a success its speed is halved for 1 minute or until it takes damage.', source: { kind: 'subclass', refId: 'vengeance' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'action', resourceCost: { resourceId: 'channel_divinity_paladin', quantity: 1 }, range: '60 feet', target: 'single', requiresSave: { ability: 'wis', dc: 'spell_save_dc' } },
        abilityEffects: [{ type: 'apply_condition', conditionId: 'frightened', duration: { unit: 'minutes', remaining: 1 } }] } },
      { kind: 'feature', value: { id: 'vow_of_enmity', name: 'Channel Divinity: Vow of Enmity', description: 'As a bonus action, utter a vow against a creature within 10 feet: gain advantage on attack rolls against it for 1 minute or until it drops to 0 HP or falls unconscious.', source: { kind: 'subclass', refId: 'vengeance' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'channel_divinity_paladin', quantity: 1 }, range: '10 feet', target: 'single', requiresSave: null },
        abilityEffects: [] } },
    ] },
    { level: 7, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'relentless_avenger', name: 'Relentless Avenger', description: 'When you hit with an opportunity attack, immediately move up to half your speed as part of the same reaction, without provoking opportunity attacks.', source: { kind: 'subclass', refId: 'vengeance' }, level: 7, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 15, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'soul_of_vengeance', name: 'Soul of Vengeance', description: 'When a creature under your Vow of Enmity makes an attack, use your reaction to make a melee weapon attack against it if it\'s in range.', source: { kind: 'subclass', refId: 'vengeance' }, level: 15, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'reaction', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 20, hpDie: 10, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'avenging_angel_pool', name: 'Avenging Angel', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'avenging_angel', name: 'Avenging Angel', description: 'As an action, sprout wings for 1 hour, gaining a 60-foot flying speed and a 30-foot menacing aura: the first time an enemy enters it or starts its turn there in a battle, it makes a Wisdom save or is frightened of you for 1 minute or until damaged (attacks against it have advantage while frightened). Usable once per long rest.', source: { kind: 'subclass', refId: 'vengeance' }, level: 20, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'avenging_angel_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [{ type: 'grant_speed', speedType: 'fly', amount: 60, duration: { unit: 'hours', remaining: 1 } }] } },
      ] },
  ],
};

// ── Oath of the Crown ────────────────────────────────────────────────────────
export const crownProgression: SubclassProgression = {
  classId: 'paladin', name: 'Oath of the Crown', srd: false,
  entries: [
    { level: 3, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'champion_challenge', name: 'Channel Divinity: Champion Challenge', description: 'As a bonus action, force each creature you choose within 30 feet to make a Wisdom save; on a failure it can\'t willingly move more than 30 feet from you until you\'re incapacitated, die, or it ends up more than 30 feet away.', source: { kind: 'subclass', refId: 'crown' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'channel_divinity_paladin', quantity: 1 }, range: '30 feet', target: 'multiple', requiresSave: { ability: 'wis', dc: 'spell_save_dc' } },
        abilityEffects: [] } },
      { kind: 'feature', value: { id: 'turn_the_tide', name: 'Channel Divinity: Turn the Tide', description: 'As a bonus action, creatures you choose within 30 feet who can hear you and are at or below half their hit points each regain 1d6 plus your Charisma modifier (minimum 1) hit points.', source: { kind: 'subclass', refId: 'crown' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'channel_divinity_paladin', quantity: 1 }, range: '30 feet', target: 'multiple', requiresSave: null },
        abilityEffects: [{ type: 'heal', dice: '1d6', bonusMod: 'cha' }] } },
    ] },
    { level: 7, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'divine_allegiance', name: 'Divine Allegiance', description: 'When a creature within 5 feet takes damage, use your reaction to take that damage instead; it can\'t be reduced or prevented in any way.', source: { kind: 'subclass', refId: 'crown' }, level: 7, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'reaction', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 15, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'unyielding_saint', name: 'Unyielding Saint', description: 'You have advantage on saving throws against being paralyzed or stunned.', source: { kind: 'subclass', refId: 'crown' }, level: 15, effects: [
      { type: 'stat_modifier', target: 'saving throws against being paralyzed or stunned', operation: 'advantage', value: null, condition: null },
    ], actions: [], choices: [], passive: true } }] },
    { level: 20, hpDie: 10, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'exalted_champion_pool', name: 'Exalted Champion', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'exalted_champion', name: 'Exalted Champion', description: 'As an action, gain the following for 1 hour: resistance to nonmagical bludgeoning, piercing, and slashing damage; allies within 30 feet have advantage on death saving throws; and you and allies within 30 feet have advantage on Wisdom saves. Ends early if you\'re incapacitated or die. Usable once per long rest.', source: { kind: 'subclass', refId: 'crown' }, level: 20, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'exalted_champion_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
  ],
};

// ── Oath of the Watchers ─────────────────────────────────────────────────────
export const watchersProgression: SubclassProgression = {
  classId: 'paladin', name: 'Oath of the Watchers', srd: false,
  entries: [
    { level: 3, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'watchers_will', name: "Channel Divinity: Watcher's Will", description: 'As an action, grant yourself and creatures you choose within 30 feet, up to your Charisma modifier (minimum one), advantage on Intelligence, Wisdom, and Charisma saving throws for 1 minute.', source: { kind: 'subclass', refId: 'watchers' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'action', resourceCost: { resourceId: 'channel_divinity_paladin', quantity: 1 }, range: '30 feet', target: 'multiple', requiresSave: null },
        abilityEffects: [] } },
      { kind: 'feature', value: { id: 'abjure_the_extraplanar', name: 'Channel Divinity: Abjure the Extraplanar', description: 'As an action, present your holy symbol; each aberration, celestial, elemental, fey, or fiend within 30 feet that can hear you makes a Wisdom save or is turned for 1 minute or until it takes damage, forced to flee from you and unable to end its move within 30 feet of you. Turning isn\'t a tracked status — the engine has no "turned" condition — resolve manually.', source: { kind: 'subclass', refId: 'watchers' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'action', resourceCost: { resourceId: 'channel_divinity_paladin', quantity: 1 }, range: '30 feet', target: 'area', requiresSave: null },
        abilityEffects: [] } },
    ] },
    { level: 7, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'aura_of_the_sentinel', name: 'Aura of the Sentinel', description: 'While not incapacitated, you and creatures you choose within 10 feet (30 feet at level 18) gain a bonus to initiative equal to your proficiency bonus when rolling it. No formula slot exists for a proficiency-bonus-scaled stat_modifier — apply manually.', source: { kind: 'subclass', refId: 'watchers' }, level: 7, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 15, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'vigilant_rebuke', name: 'Vigilant Rebuke', description: 'When you or a creature you can see within 30 feet succeeds on an Intelligence, Wisdom, or Charisma save, use your reaction to deal 2d8 plus your Charisma modifier force damage to whoever forced the save.', source: { kind: 'subclass', refId: 'watchers' }, level: 15, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'reaction', resourceCost: null, range: '30 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '2d8', damageType: 'force' }] } }] },
    { level: 20, hpDie: 10, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'mortal_bulwark_pool', name: 'Mortal Bulwark', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'mortal_bulwark', name: 'Mortal Bulwark', description: 'As a bonus action, gain truesight to 120 feet and advantage on attack rolls against aberrations, celestials, elementals, fey, and fiends for 1 minute. When you hit and damage such a creature, it makes a Charisma save against your spell save DC or is banished to its native plane for 24 hours (success grants 24 hours of immunity to this banishment from you). Usable once per long rest, or again by spending a 5th-level spell slot.', source: { kind: 'subclass', refId: 'watchers' }, level: 20, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'mortal_bulwark_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
  ],
};

// ── Oathbreaker ──────────────────────────────────────────────────────────────
export const oathbreakerProgression: SubclassProgression = {
  classId: 'paladin', name: 'Oathbreaker', srd: false,
  entries: [
    { level: 3, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'control_undead', name: 'Channel Divinity: Control Undead', description: 'As an action, target one undead creature within 30 feet with a Wisdom save; on a failure it obeys your commands for 24 hours or until you use this again. Immune if its challenge rating is at or above your paladin level.', source: { kind: 'subclass', refId: 'oathbreaker' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'action', resourceCost: { resourceId: 'channel_divinity_paladin', quantity: 1 }, range: '30 feet', target: 'single', requiresSave: { ability: 'wis', dc: 'spell_save_dc' } },
        abilityEffects: [] } },
      { kind: 'feature', value: { id: 'dreadful_aspect', name: 'Channel Divinity: Dreadful Aspect', description: 'As an action, each creature you choose within 30 feet that can see you makes a Wisdom save or is frightened of you for 1 minute, with another save allowed if it ends its turn more than 30 feet away.', source: { kind: 'subclass', refId: 'oathbreaker' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'action', resourceCost: { resourceId: 'channel_divinity_paladin', quantity: 1 }, range: '30 feet', target: 'multiple', requiresSave: { ability: 'wis', dc: 'spell_save_dc' } },
        abilityEffects: [{ type: 'apply_condition', conditionId: 'frightened', duration: { unit: 'minutes', remaining: 1 } }] } },
    ] },
    { level: 7, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'aura_of_hate', name: 'Aura of Hate', description: 'You, and fiends and undead within 10 feet (30 feet at level 18), gain a bonus to melee weapon damage rolls equal to your Charisma modifier (minimum +1). A creature benefits from only one paladin\'s aura at a time.', source: { kind: 'subclass', refId: 'oathbreaker' }, level: 7, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 15, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'supernatural_resistance', name: 'Supernatural Resistance', description: 'You have resistance to bludgeoning, piercing, and slashing damage from nonmagical attacks.', source: { kind: 'subclass', refId: 'oathbreaker' }, level: 15, effects: [
      { type: 'grant_resistance', target: 'bludgeoning', operation: 'resistance', value: null, condition: null },
      { type: 'grant_resistance', target: 'piercing', operation: 'resistance', value: null, condition: null },
      { type: 'grant_resistance', target: 'slashing', operation: 'resistance', value: null, condition: null },
    ], actions: [], choices: [], passive: true } }] },
    { level: 20, hpDie: 10, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'dread_lord_pool', name: 'Dread Lord', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'dread_lord', name: 'Dread Lord', description: 'As an action, surround yourself with a 30-foot gloom aura for 1 minute that dims bright light to dim; frightened enemies who start their turn in it take 4d10 psychic damage, and creatures you choose there are draped in deeper shadow (disadvantage against them for attackers relying on sight). Usable once per long rest.', source: { kind: 'subclass', refId: 'oathbreaker' }, level: 20, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'dread_lord_pool', quantity: 1 }, range: '30 feet', target: 'self', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '4d10', damageType: 'psychic' }] } },
        { kind: 'feature', value: { id: 'dread_lord_shadow_strike', name: 'Dread Lord: Shadow Strike', description: 'While your Dread Lord aura is active, use a bonus action to make a melee spell attack against a creature in the aura; on a hit it takes 3d10 plus your Charisma modifier necrotic damage.', source: { kind: 'subclass', refId: 'oathbreaker' }, level: 20, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: null, range: '30 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '3d10', damageType: 'necrotic' }] } },
      ] },
  ],
};

export const PALADIN_SUBCLASSES: SubclassProgression[] = [
  devotionProgression, ancientsProgression, conquestProgression, gloryProgression,
  redemptionProgression, vengeanceProgression, crownProgression, watchersProgression,
  oathbreakerProgression,
];
