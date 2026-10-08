// ============================================================================
// FILE: src/content/subclasses/cleric.ts
// Cleric subclasses: Life, Light, Arcana, Death, Forge, Grave, Knowledge,
// Nature, Order, Peace, Tempest, Trickery, Twilight, War, plus four deferred
// entries: Fate Domain (Unearthed Arcana) and three Amonkhet-setting
// reflavors (Zeal, Solidarity, Strength) built for Magic: The
// Gathering's Amonkhet plane rather than a standard Forgotten Realms-style
// pantheon — non-official either way, srd: false throughout.
// ============================================================================
import { ClassProgression, Grant } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

// Domain spells are always prepared, granted automatically — same
// known_spells Grant Artificer's subclasses already use (3 of 5), not a new
// mechanism. Confirmed the base class's own init_spellcasting grant always
// fires before any subclass grant, so spellcasting is guaranteed
// initialized here.
function domainSpells(spellIds: string[]): Grant {
  return { kind: 'known_spells', value: { spellIds } };
}

// ── Life Domain ───────────────────────────────────────────────────────────────

export const lifeDomainProgression: SubclassProgression = {
  classId: 'cleric',
  name: 'Life Domain',
  srd: true,
  entries: [
    {
      level: 1, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'life_domain_proficiency', name: 'Bonus Proficiency', description: 'Proficiency with heavy armor.', source: { kind: 'subclass', refId: 'life_domain' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'disciple_of_life', name: 'Disciple of Life', description: 'Healing spells are more effective: whenever you use a spell of 1st level or higher to restore HP to a creature, regain additional HP equal to 2 + the spell\'s level.', source: { kind: 'subclass', refId: 'life_domain' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        domainSpells(['bless', 'cure_wounds']),
      ],
    },
    {
      level: 2, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'preserve_life', name: 'Channel Divinity: Preserve Life', description: 'Restore HP to any number of creatures within 30 feet, distributing up to 5× your cleric level in HP. Can\'t bring a creature above half its HP maximum.', source: { kind: 'subclass', refId: 'life_domain' }, level: 2, actions: [], choices: [], passive: false, effects: [],
          activation: { actionType: 'action', resourceCost: { resourceId: 'channel_divinity_pool', quantity: 1 }, range: '30 feet', target: 'area', requiresSave: null },
          abilityEffects: [],
        } },
      ],
    },
    {
      level: 3, hpDie: 8, choices: [], grants: [domainSpells(['lesser_restoration', 'spiritual_weapon'])],
    },
    {
      level: 5, hpDie: 8, choices: [], grants: [domainSpells(['beacon_of_hope', 'revivify'])],
    },
    {
      level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'blessed_healer', name: 'Blessed Healer', description: 'When you cast a healing spell of 1st level or higher on another creature, you regain HP equal to 2 + the spell\'s level.', source: { kind: 'subclass', refId: 'life_domain' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 7, hpDie: 8, choices: [], grants: [domainSpells(['death_ward', 'guardian_of_faith'])],
    },
    {
      level: 8, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'divine_strike_life', name: 'Divine Strike', description: 'Once per turn, deal an extra 1d8 radiant damage to one creature with a weapon attack (2d8 at level 14 — same card, description only for the upgrade).', source: { kind: 'subclass', refId: 'life_domain' }, level: 8, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'radiant' }],
        } },
      ],
    },
    {
      level: 9, hpDie: 8, choices: [], grants: [domainSpells(['mass_cure_wounds', 'raise_dead'])],
    },
    {
      level: 17, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'supreme_healing', name: 'Supreme Healing', description: 'Instead of rolling dice for healing spells, use the maximum result for each die.', source: { kind: 'subclass', refId: 'life_domain' }, level: 17, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

// ── Light Domain ──────────────────────────────────────────────────────────────

export const lightDomainProgression: SubclassProgression = {
  classId: 'cleric',
  name: 'Light Domain',
  srd: false,
  entries: [
    {
      level: 1, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'warding_flare', name: 'Warding Flare', description: 'When a creature attacks you, use your reaction to impose disadvantage on the attack roll (WIS modifier times per long rest, simplified to a flat 1 here — no ability-mod-scaled resource pool exists in the engine; also no cross-entity roll-modification hook, so the disadvantage itself isn\'t applied — resolve manually).', source: { kind: 'subclass', refId: 'light_domain' }, level: 1, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'reaction', resourceCost: { resourceId: 'warding_flare_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null } } },
        { kind: 'resource', value: { resourceId: 'warding_flare_pool', name: 'Warding Flare (scales with Wisdom modifier)', maximum: 1, recharge: 'long_rest' } },
        domainSpells(['burning_hands', 'faerie_fire']),
      ],
    },
    {
      level: 2, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'radiance_of_dawn', name: 'Channel Divinity: Radiance of the Dawn', description: 'Magical darkness within 30 feet is dispelled. Hostile creatures within 30 feet take 2d10 + cleric level radiant damage (CHA save for half).', source: { kind: 'subclass', refId: 'light_domain' }, level: 2, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'channel_divinity_pool', quantity: 1 }, range: '30 feet', target: 'area', requiresSave: { ability: 'cha', dc: 'spell_save_dc' } },
          abilityEffects: [{ type: 'damage', dice: '2d10', damageType: 'radiant', saveOnSuccess: 'half' }],
        } },
      ],
    },
    {
      level: 3, hpDie: 8, choices: [], grants: [domainSpells(['flaming_sphere', 'scorching_ray'])],
    },
    {
      level: 5, hpDie: 8, choices: [], grants: [domainSpells(['daylight', 'fireball'])],
    },
    {
      level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'improved_flare', name: 'Improved Flare', description: 'You can also use Warding Flare when a creature attacks a creature other than you within 30 feet.', source: { kind: 'subclass', refId: 'light_domain' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 7, hpDie: 8, choices: [], grants: [domainSpells(['guardian_of_faith', 'wall_of_fire'])],
    },
    {
      level: 8, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'potent_spellcasting_cleric', name: 'Potent Spellcasting', description: 'Add your WIS modifier to the damage you deal with cleric cantrips.', source: { kind: 'subclass', refId: 'light_domain' }, level: 8, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 9, hpDie: 8, choices: [], grants: [domainSpells(['flame_strike', 'scrying'])],
    },
    {
      level: 17, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'corona_of_light', name: 'Corona of Light', description: 'Activate as an action: shed bright light in a 60-foot radius and dim light for an additional 30 feet. Enemies in bright light have disadvantage on saves against fire or radiant spells. Lasts 1 minute (concentration).', source: { kind: 'subclass', refId: 'light_domain' }, level: 17, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'action', resourceCost: null, range: '60 feet', target: 'area', requiresSave: null } } },
      ],
    },
  ],
};

// ── Arcana Domain ─────────────────────────────────────────────────────────────

export const arcanaDomainProgression: SubclassProgression = {
  classId: 'cleric',
  name: 'Arcana Domain',
  srd: false,
  entries: [
    {
      level: 1, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'arcane_initiate', name: 'Arcane Initiate', description: 'You gain proficiency in Arcana, and you learn two wizard cantrips of your choice. They count as cleric cantrips for you.', source: { kind: 'subclass', refId: 'arcana_domain' }, level: 1, effects: [
          { type: 'grant_proficiency', target: 'skill:arcana', operation: 'add', value: null, condition: null },
        ], actions: [], choices: [], passive: true } },
        domainSpells(['detect_magic', 'magic_missile']),
      ],
    },
    {
      level: 2, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'arcane_abjuration', name: 'Channel Divinity: Arcane Abjuration', description: 'Present your holy symbol to force a celestial, elemental, fey, or fiend within 30 feet to make a WIS save or be turned for 1 minute, fleeing you and unable to take reactions. From 5th level, a creature that fails this save and is below a level-scaling CR threshold is banished for 1 minute instead if it isn\'t on its home plane (resolve the turn/banish effect manually — no automated turn-tracking or banishment hook exists yet).', source: { kind: 'subclass', refId: 'arcana_domain' }, level: 2, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'channel_divinity_pool', quantity: 1 }, range: '30 feet', target: 'single', requiresSave: { ability: 'wis', dc: 'spell_save_dc' } },
          abilityEffects: [],
        } },
      ],
    },
    {
      level: 3, hpDie: 8, choices: [], grants: [domainSpells(['magic_weapon'])],
    },
    {
      level: 5, hpDie: 8, choices: [], grants: [domainSpells(['dispel_magic'])],
    },
    {
      level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'spell_breaker', name: 'Spell Breaker', description: 'When a healing spell of yours restores HP to an ally, you can also end one spell affecting that ally, of a level no higher than the healing spell\'s slot.', source: { kind: 'subclass', refId: 'arcana_domain' }, level: 6, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'free', resourceCost: null, range: 'touch', target: 'single', requiresSave: null } } },
      ],
    },
    {
      level: 7, hpDie: 8, choices: [], grants: [domainSpells(['arcane_eye'])],
    },
    {
      level: 8, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'potent_spellcasting_arcana', name: 'Potent Spellcasting', description: 'Add your WIS modifier to the damage you deal with cleric cantrips.', source: { kind: 'subclass', refId: 'arcana_domain' }, level: 8, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 9, hpDie: 8, choices: [], grants: [domainSpells(['planar_binding', 'teleportation_circle'])],
    },
    {
      level: 17, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'arcane_mastery', name: 'Arcane Mastery', description: 'Choose four wizard spells, one each of 6th, 7th, 8th, and 9th level. They become domain spells for you, always prepared, cast as cleric spells.', source: { kind: 'subclass', refId: 'arcana_domain' }, level: 17, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

// ── Death Domain ──────────────────────────────────────────────────────────────

export const deathDomainProgression: SubclassProgression = {
  classId: 'cleric',
  name: 'Death Domain',
  srd: false,
  entries: [
    {
      level: 1, hpDie: 8, choices: [],
      grants: [
        { kind: 'proficiency', value: { weapons: ['martial'] } },
        { kind: 'feature', value: { id: 'reaper', name: 'Reaper', description: 'You learn one necromancy cantrip from any spell list. A single-target necromancy cantrip you cast can instead strike two creatures within 5 feet of each other.', source: { kind: 'subclass', refId: 'death_domain' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        domainSpells(['false_life', 'ray_of_sickness']),
      ],
    },
    {
      level: 2, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'touch_of_death', name: 'Channel Divinity: Touch of Death', description: 'When you hit with a melee attack, spend Channel Divinity to deal an extra 5 + twice your cleric level necrotic damage.', source: { kind: 'subclass', refId: 'death_domain' }, level: 2, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: { resourceId: 'channel_divinity_pool', quantity: 1 }, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d1', damageType: 'necrotic' }],
        } },
      ],
    },
    {
      level: 3, hpDie: 8, choices: [], grants: [domainSpells(['blindness_deafness', 'ray_of_enfeeblement'])],
    },
    {
      level: 5, hpDie: 8, choices: [], grants: [domainSpells(['animate_dead', 'vampiric_touch'])],
    },
    {
      level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'inescapable_destruction', name: 'Inescapable Destruction', description: 'Necrotic damage from your cleric spells and Channel Divinity ignores resistance to necrotic damage.', source: { kind: 'subclass', refId: 'death_domain' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 7, hpDie: 8, choices: [], grants: [domainSpells(['blight', 'death_ward'])],
    },
    {
      level: 8, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'divine_strike_death', name: 'Divine Strike', description: 'Once per turn, deal an extra 1d8 necrotic damage to one creature with a weapon attack (2d8 at level 14 — same card, description only for the upgrade).', source: { kind: 'subclass', refId: 'death_domain' }, level: 8, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'necrotic' }],
        } },
      ],
    },
    {
      level: 9, hpDie: 8, choices: [], grants: [domainSpells(['antilife_shell', 'cloudkill'])],
    },
    {
      level: 17, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'improved_reaper', name: 'Improved Reaper', description: 'A necromancy spell of 1st-5th level that targets only one creature can instead strike two creatures within 5 feet of each other (providing material components for both, if any).', source: { kind: 'subclass', refId: 'death_domain' }, level: 17, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

// ── Forge Domain ──────────────────────────────────────────────────────────────

export const forgeDomainProgression: SubclassProgression = {
  classId: 'cleric',
  name: 'Forge Domain',
  srd: false,
  entries: [
    {
      level: 1, hpDie: 8, choices: [],
      grants: [
        { kind: 'proficiency', value: { armor: ['heavy'], tools: ['smiths_tools'] } },
        { kind: 'feature', value: { id: 'blessing_of_the_forge', name: 'Blessing of the Forge', description: 'At the end of a long rest, touch one nonmagical weapon or suit of armor to grant it a +1 bonus (to AC if armor, to attack and damage if a weapon) until your next long rest ends or you die. Usable once per long rest.', source: { kind: 'subclass', refId: 'forge_domain' }, level: 1, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: null, range: 'touch', target: 'single', requiresSave: null },
          abilityEffects: [],
        } },
        domainSpells(['identify']),
      ],
    },
    {
      level: 2, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'artisans_blessing', name: "Channel Divinity: Artisan's Blessing", description: 'Spend an hour and metal worth up to 100 gp to magically craft a nonmagical metal item of equal value — a weapon, armor, ammunition, tools, or similar.', source: { kind: 'subclass', refId: 'forge_domain' }, level: 2, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: { resourceId: 'channel_divinity_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [],
        } },
      ],
    },
    {
      level: 3, hpDie: 8, choices: [], grants: [domainSpells(['heat_metal', 'magic_weapon'])],
    },
    {
      level: 5, hpDie: 8, choices: [], grants: [domainSpells(['protection_from_energy'])],
    },
    {
      level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'soul_of_the_forge', name: 'Soul of the Forge', description: 'You gain resistance to fire damage, and your AC gains a +1 bonus while you wear heavy armor.', source: { kind: 'subclass', refId: 'forge_domain' }, level: 6, effects: [
          { type: 'grant_resistance', target: 'fire', operation: 'resistance', value: null, condition: null },
        ], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 7, hpDie: 8, choices: [], grants: [domainSpells(['wall_of_fire'])],
    },
    {
      level: 8, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'divine_strike_forge', name: 'Divine Strike', description: 'Once per turn, deal an extra 1d8 fire damage to one creature with a weapon attack (2d8 at level 14 — same card, description only for the upgrade).', source: { kind: 'subclass', refId: 'forge_domain' }, level: 8, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'fire' }],
        } },
      ],
    },
    {
      level: 9, hpDie: 8, choices: [], grants: [domainSpells(['animate_objects'])],
    },
    {
      level: 17, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'saint_of_forge_and_fire', name: 'Saint of Forge and Fire', description: 'You gain immunity to fire damage. While wearing heavy armor you also gain resistance to nonmagical bludgeoning, piercing, and slashing damage.', source: { kind: 'subclass', refId: 'forge_domain' }, level: 17, effects: [
          { type: 'grant_immunity', target: 'fire', operation: 'immunity', value: null, condition: null },
        ], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

// ── Grave Domain ──────────────────────────────────────────────────────────────

export const graveDomainProgression: SubclassProgression = {
  classId: 'cleric',
  name: 'Grave Domain',
  srd: false,
  entries: [
    {
      level: 1, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'circle_of_mortality', name: 'Circle of Mortality', description: 'A healing spell you cast on a creature at 0 HP restores the maximum possible amount instead of rolling. You also learn Spare the Dying as a bonus cantrip, usable at 30 feet as a bonus action.', source: { kind: 'subclass', refId: 'grave_domain' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'eyes_of_the_grave', name: 'Eyes of the Grave', description: 'As an action, sense the location of any undead within 60 feet (not behind total cover, not protected from divination) until the end of your next turn. Usable a number of times equal to your WIS modifier (min 1) per long rest.', source: { kind: 'subclass', refId: 'grave_domain' }, level: 1, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: null, range: '60 feet', target: 'self', requiresSave: null },
          abilityEffects: [],
        } },
        domainSpells(['bane', 'false_life']),
      ],
    },
    {
      level: 2, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'path_to_the_grave', name: 'Channel Divinity: Path to the Grave', description: 'Curse a creature you can see within 30 feet until the end of your next turn — the next attack against it by you or an ally has vulnerability to that attack\'s damage, then the curse ends.', source: { kind: 'subclass', refId: 'grave_domain' }, level: 2, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'channel_divinity_pool', quantity: 1 }, range: '30 feet', target: 'single', requiresSave: null },
          abilityEffects: [],
        } },
      ],
    },
    {
      level: 3, hpDie: 8, choices: [], grants: [domainSpells(['gentle_repose', 'ray_of_enfeeblement'])],
    },
    {
      level: 5, hpDie: 8, choices: [], grants: [domainSpells(['revivify', 'vampiric_touch'])],
    },
    {
      level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'sentinel_at_deaths_door', name: "Sentinel at Death's Door", description: 'As a reaction when you or an ally within 30 feet suffers a critical hit, turn it into a normal hit instead, canceling any critical-only effects. Usable a number of times equal to your WIS modifier (min 1) per long rest.', source: { kind: 'subclass', refId: 'grave_domain' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: null, range: '30 feet', target: 'single', requiresSave: null },
          abilityEffects: [],
        } },
      ],
    },
    {
      level: 7, hpDie: 8, choices: [], grants: [domainSpells(['blight', 'death_ward'])],
    },
    {
      level: 8, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'potent_spellcasting_grave', name: 'Potent Spellcasting', description: 'Add your WIS modifier to the damage you deal with cleric cantrips.', source: { kind: 'subclass', refId: 'grave_domain' }, level: 8, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 9, hpDie: 8, choices: [], grants: [domainSpells(['antilife_shell'])],
    },
    {
      level: 17, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'keeper_of_souls', name: 'Keeper of Souls', description: 'When an enemy you can see dies within 30 feet of you, you or an ally within 30 feet regains HP equal to that enemy\'s Hit Dice. Usable once, recharging at the start of your next turn (simplified to "other" recharge below — the engine only tracks short/long rest recharge, not per-turn); requires that you aren\'t incapacitated.', source: { kind: 'subclass', refId: 'grave_domain' }, level: 17, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'free', resourceCost: { resourceId: 'keeper_of_souls_pool', quantity: 1 }, range: '30 feet', target: 'single', requiresSave: null } } },
        { kind: 'resource', value: { resourceId: 'keeper_of_souls_pool', name: 'Keeper of Souls (recharges at the start of your next turn)', maximum: 1, recharge: 'other' } },
      ],
    },
  ],
};

// ── Knowledge Domain ──────────────────────────────────────────────────────────

export const knowledgeDomainProgression: SubclassProgression = {
  classId: 'cleric',
  name: 'Knowledge Domain',
  srd: false,
  entries: [
    {
      level: 1, hpDie: 8,
      // CHOICE-EXPANSION-2: "learn two languages of your choice" migrated to
      // a real choice. The "proficiency in two of Arcana/History/Nature/
      // Religion, doubled" half is NOT migrated — it grants proficiency AND
      // doubles it in one move for a skill the character may not already
      // have, which doesn't fit kind:'expertise' (requires prior
      // proficiency) or any other authored kind in this pass; stays
      // flavor-only, same as before.
      choices: [
        { id: 'knowledge_domain_languages_1', prompt: 'Choose two languages.', kind: 'language', count: 2, pool: 'all', grants: [], required: true, resolved: false },
      ],
      grants: [
        { kind: 'feature', value: { id: 'blessings_of_knowledge', name: 'Blessings of Knowledge', description: 'Learn two languages of your choice and gain proficiency in two of Arcana, History, Nature, or Religion. Your proficiency bonus is doubled for checks using either chosen skill.', source: { kind: 'subclass', refId: 'knowledge_domain' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        domainSpells(['command', 'identify']),
      ],
    },
    {
      level: 2, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'knowledge_of_the_ages', name: 'Channel Divinity: Knowledge of the Ages', description: 'Gain proficiency with one skill or tool of your choice for 10 minutes.', source: { kind: 'subclass', refId: 'knowledge_domain' }, level: 2, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'channel_divinity_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [],
        } },
      ],
    },
    {
      level: 3, hpDie: 8, choices: [], grants: [domainSpells(['augury', 'suggestion'])],
    },
    {
      level: 5, hpDie: 8, choices: [], grants: [domainSpells(['nondetection', 'speak_with_dead'])],
    },
    {
      level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'read_thoughts', name: 'Channel Divinity: Read Thoughts', description: 'Force a creature within 60 feet to make a WIS save. On a failure, read its surface thoughts for 1 minute and can spend your action to cast Suggestion on it (no slot spent, automatic save failure) while the effect lasts. On a success it is immune to this feature from you until your next long rest.', source: { kind: 'subclass', refId: 'knowledge_domain' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: null, range: '60 feet', target: 'single', requiresSave: { ability: 'wis', dc: 'spell_save_dc' } },
          abilityEffects: [],
        } },
      ],
    },
    {
      level: 7, hpDie: 8, choices: [], grants: [domainSpells(['arcane_eye', 'confusion'])],
    },
    {
      level: 8, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'potent_spellcasting_knowledge', name: 'Potent Spellcasting', description: 'Add your WIS modifier to the damage you deal with cleric cantrips.', source: { kind: 'subclass', refId: 'knowledge_domain' }, level: 8, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 9, hpDie: 8, choices: [], grants: [domainSpells(['legend_lore', 'scrying'])],
    },
    {
      level: 17, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'visions_of_the_past', name: 'Visions of the Past', description: 'Meditate for a number of minutes up to your WIS score (requiring concentration) to glimpse recent events tied to an object you hold or your surroundings. Usable once per short or long rest.', source: { kind: 'subclass', refId: 'knowledge_domain' }, level: 17, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'other', resourceCost: { resourceId: 'visions_of_the_past_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null } } },
        { kind: 'resource', value: { resourceId: 'visions_of_the_past_pool', name: 'Visions of the Past', maximum: 1, recharge: 'short_rest' } },
      ],
    },
  ],
};

// ── Nature Domain ─────────────────────────────────────────────────────────────

export const natureDomainProgression: SubclassProgression = {
  classId: 'cleric',
  name: 'Nature Domain',
  srd: false,
  entries: [
    {
      level: 1, hpDie: 8, choices: [],
      grants: [
        { kind: 'proficiency', value: { armor: ['heavy'] } },
        { kind: 'feature', value: { id: 'acolyte_of_nature', name: 'Acolyte of Nature', description: 'Learn one druid cantrip (it counts as a cleric cantrip but not against your total known), and gain proficiency in Animal Handling, Nature, or Survival.', source: { kind: 'subclass', refId: 'nature_domain' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        domainSpells(['animal_friendship']),
      ],
    },
    {
      level: 2, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'charm_animals_and_plants', name: 'Channel Divinity: Charm Animals and Plants', description: 'Each beast or plant creature that can see you within 30 feet must make a WIS save or be charmed by you (friendly to you and creatures you designate) for 1 minute or until it takes damage.', source: { kind: 'subclass', refId: 'nature_domain' }, level: 2, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'channel_divinity_pool', quantity: 1 }, range: '30 feet', target: 'area', requiresSave: { ability: 'wis', dc: 'spell_save_dc' } },
          abilityEffects: [],
        } },
      ],
    },
    {
      level: 3, hpDie: 8, choices: [], grants: [domainSpells(['barkskin'])],
    },
    {
      level: 5, hpDie: 8, choices: [], grants: [],
    },
    {
      level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'dampen_elements', name: 'Dampen Elements', description: 'As a reaction when you or a creature within 30 feet takes acid, cold, fire, lightning, or thunder damage, grant that creature resistance against that instance of the damage.', source: { kind: 'subclass', refId: 'nature_domain' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: null, range: '30 feet', target: 'single', requiresSave: null },
          abilityEffects: [],
        } },
      ],
    },
    {
      level: 7, hpDie: 8, choices: [], grants: [],
    },
    {
      level: 8, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'divine_strike_nature', name: 'Divine Strike', description: 'Once per turn, deal an extra 1d8 cold, fire, or lightning damage (your choice each time) to one creature with a weapon attack (2d8 at level 14 — same card, description only for the upgrade).', source: { kind: 'subclass', refId: 'nature_domain' }, level: 8, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'fire' }],
        } },
      ],
    },
    {
      level: 9, hpDie: 8, choices: [], grants: [domainSpells(['insect_plague'])],
    },
    {
      level: 17, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'master_of_nature', name: 'Master of Nature', description: 'While a creature is charmed by your Charm Animals and Plants, you can take a bonus action to verbally command what it does on its next turn.', source: { kind: 'subclass', refId: 'nature_domain' }, level: 17, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

// ── Order Domain ──────────────────────────────────────────────────────────────

export const orderDomainProgression: SubclassProgression = {
  classId: 'cleric',
  name: 'Order Domain',
  srd: false,
  entries: [
    {
      level: 1, hpDie: 8, choices: [],
      grants: [
        { kind: 'proficiency', value: { armor: ['heavy'] } },
        { kind: 'feature', value: { id: 'voice_of_authority', name: 'Voice of Authority', description: 'You gain proficiency in Intimidation or Persuasion (your choice). When you target an ally with a spell of 1st level or higher, that ally can use its reaction immediately after to make one weapon attack against a creature of your choice that you can see.', source: { kind: 'subclass', refId: 'order_domain' }, level: 1, effects: [
          { type: 'grant_proficiency', target: 'skill:intimidation', operation: 'add', value: null, condition: null },
        ], actions: [], choices: [], passive: false, activation: { actionType: 'other', resourceCost: null, range: 'self', target: 'self', requiresSave: null } } },
        domainSpells(['command', 'heroism']),
      ],
    },
    {
      level: 2, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'orders_demand', name: "Channel Divinity: Order's Demand", description: 'Each creature of your choice that can see or hear you within 30 feet must make a WIS save or be charmed until the end of your next turn (or until it takes damage); you can also make charmed creatures drop what they\'re holding.', source: { kind: 'subclass', refId: 'order_domain' }, level: 2, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'channel_divinity_pool', quantity: 1 }, range: '30 feet', target: 'area', requiresSave: { ability: 'wis', dc: 'spell_save_dc' } },
          abilityEffects: [],
        } },
      ],
    },
    {
      level: 3, hpDie: 8, choices: [], grants: [domainSpells(['hold_person'])],
    },
    {
      level: 5, hpDie: 8, choices: [], grants: [],
    },
    {
      level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'embodiment_of_the_law', name: 'Embodiment of the Law', description: 'When you cast an enchantment spell with a slot of 1st level or higher, you can change its casting time to a bonus action (if normally an action). Usable a number of times equal to your WIS modifier (min 1) per long rest.', source: { kind: 'subclass', refId: 'order_domain' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 7, hpDie: 8, choices: [], grants: [domainSpells(['compulsion'])],
    },
    {
      level: 8, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'divine_strike_order', name: 'Divine Strike', description: 'Once per turn, deal an extra 1d8 psychic damage to one creature with a weapon attack (2d8 at level 14 — same card, description only for the upgrade).', source: { kind: 'subclass', refId: 'order_domain' }, level: 8, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'psychic' }],
        } },
      ],
    },
    {
      level: 9, hpDie: 8, choices: [], grants: [domainSpells(['dominate_person'])],
    },
    {
      level: 17, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'orders_wrath', name: "Order's Wrath", description: 'When you deal Divine Strike damage on your turn, you can curse that target until the start of your next turn — the next time an ally hits it, it takes an extra 2d8 psychic damage and the curse ends. Only one creature can be cursed this way per turn.', source: { kind: 'subclass', refId: 'order_domain' }, level: 17, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

// ── Peace Domain ──────────────────────────────────────────────────────────────

export const peaceDomainProgression: SubclassProgression = {
  classId: 'cleric',
  name: 'Peace Domain',
  srd: false,
  entries: [
    {
      level: 1, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'emboldening_bond', name: 'Emboldening Bond', description: 'You gain proficiency in Insight, Performance, or Persuasion (your choice). As an action, bond a number of willing creatures within 30 feet (yourself included) equal to your proficiency bonus for 10 minutes. While bonded creatures are within 30 feet of each other, each can add a rolled d4 to one attack roll, ability check, or save per turn. Usable a number of times equal to your proficiency bonus per long rest.', source: { kind: 'subclass', refId: 'peace_domain' }, level: 1, effects: [
          { type: 'grant_proficiency', target: 'skill:insight', operation: 'add', value: null, condition: null },
        ], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: null, range: '30 feet', target: 'multiple', requiresSave: null },
          abilityEffects: [],
        } },
        domainSpells(['heroism', 'sanctuary']),
      ],
    },
    {
      level: 2, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'balm_of_peace', name: 'Channel Divinity: Balm of Peace', description: 'Move up to your speed without provoking opportunity attacks; each creature you end within 5 feet of during this move regains 2d6 + WIS modifier HP (once per creature per use).', source: { kind: 'subclass', refId: 'peace_domain' }, level: 2, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'channel_divinity_pool', quantity: 1 }, range: '5 feet', target: 'multiple', requiresSave: null },
          abilityEffects: [{ type: 'heal', dice: '2d6', bonusMod: 'wis' }],
        } },
      ],
    },
    {
      level: 3, hpDie: 8, choices: [], grants: [domainSpells(['aid'])],
    },
    {
      level: 5, hpDie: 8, choices: [], grants: [domainSpells(['beacon_of_hope'])],
    },
    {
      level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'protective_bond', name: 'Protective Bond', description: 'When a creature bonded by Emboldening Bond is about to take damage, another bonded creature within 30 feet can use its reaction to teleport adjacent to the first and take that damage instead.', source: { kind: 'subclass', refId: 'peace_domain' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 7, hpDie: 8, choices: [], grants: [],
    },
    {
      level: 8, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'potent_spellcasting_peace', name: 'Potent Spellcasting', description: 'Add your WIS modifier to the damage you deal with cleric cantrips.', source: { kind: 'subclass', refId: 'peace_domain' }, level: 8, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 9, hpDie: 8, choices: [], grants: [domainSpells(['greater_restoration'])],
    },
    {
      level: 17, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'expansive_bond', name: 'Expansive Bond', description: 'Emboldening Bond and Protective Bond now work at 60 feet instead of 30. A creature who takes another\'s damage via Protective Bond also gains resistance to that damage.', source: { kind: 'subclass', refId: 'peace_domain' }, level: 17, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

// ── Tempest Domain ────────────────────────────────────────────────────────────

export const tempestDomainProgression: SubclassProgression = {
  classId: 'cleric',
  name: 'Tempest Domain',
  srd: false,
  entries: [
    {
      level: 1, hpDie: 8, choices: [],
      grants: [
        { kind: 'proficiency', value: { armor: ['heavy'], weapons: ['martial'] } },
        { kind: 'feature', value: { id: 'wrath_of_the_storm', name: 'Wrath of the Storm', description: 'As a reaction when a creature within 5 feet hits you with an attack, force it to make a DEX save, taking 2d8 lightning or thunder damage (your choice) on a failure, half on a success. Usable a number of times equal to your WIS modifier (min 1) per long rest.', source: { kind: 'subclass', refId: 'tempest_domain' }, level: 1, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: null, range: '5 feet', target: 'single', requiresSave: { ability: 'dex', dc: 'spell_save_dc' } },
          abilityEffects: [{ type: 'damage', dice: '2d8', damageType: 'lightning', saveOnSuccess: 'half' }],
        } },
        domainSpells(['fog_cloud', 'thunderwave']),
      ],
    },
    {
      level: 2, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'destructive_wrath', name: 'Channel Divinity: Destructive Wrath', description: 'When you roll lightning or thunder damage, spend Channel Divinity to deal maximum damage instead of rolling.', source: { kind: 'subclass', refId: 'tempest_domain' }, level: 2, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 3, hpDie: 8, choices: [], grants: [domainSpells(['gust_of_wind', 'shatter'])],
    },
    {
      level: 5, hpDie: 8, choices: [], grants: [domainSpells(['call_lightning'])],
    },
    {
      level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'thunderous_strike', name: 'Thunderous Strike', description: 'When you deal lightning damage to a Large or smaller creature, you can also push it up to 10 feet away from you.', source: { kind: 'subclass', refId: 'tempest_domain' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 7, hpDie: 8, choices: [], grants: [domainSpells(['control_water'])],
    },
    {
      level: 8, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'divine_strike_tempest', name: 'Divine Strike', description: 'Once per turn, deal an extra 1d8 thunder damage to one creature with a weapon attack (2d8 at level 14 — same card, description only for the upgrade).', source: { kind: 'subclass', refId: 'tempest_domain' }, level: 8, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'thunder' }],
        } },
      ],
    },
    {
      level: 9, hpDie: 8, choices: [], grants: [domainSpells(['insect_plague'])],
    },
    {
      level: 17, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'stormborn', name: 'Stormborn', description: 'You gain a flying speed equal to your walking speed whenever you are outdoors and above ground (no environmental outdoors/underground state exists in the engine yet — apply and remove this manually as your position changes).', source: { kind: 'subclass', refId: 'tempest_domain' }, level: 17, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

// ── Trickery Domain ───────────────────────────────────────────────────────────

export const trickeryDomainProgression: SubclassProgression = {
  classId: 'cleric',
  name: 'Trickery Domain',
  srd: false,
  entries: [
    {
      level: 1, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'blessing_of_the_trickster', name: 'Blessing of the Trickster', description: 'As an action, touch a willing creature other than yourself to grant it advantage on DEX (Stealth) checks for 1 hour or until you use this feature again.', source: { kind: 'subclass', refId: 'trickery_domain' }, level: 1, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: null, range: 'touch', target: 'single', requiresSave: null },
          abilityEffects: [],
        } },
        domainSpells(['charm_person', 'disguise_self']),
      ],
    },
    {
      level: 2, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'invoke_duplicity', name: 'Channel Divinity: Invoke Duplicity', description: 'Create an illusory duplicate of yourself in an unoccupied space within 30 feet, lasting 1 minute or until you lose concentration. You can cast spells as if standing in the duplicate\'s space (using your own senses), move it up to 30 feet as a bonus action (max 120 feet from you), and gain advantage on attacks against a creature within 5 feet of both you and the duplicate.', source: { kind: 'subclass', refId: 'trickery_domain' }, level: 2, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'channel_divinity_pool', quantity: 1 }, range: '30 feet', target: 'self', requiresSave: null },
          abilityEffects: [],
        } },
      ],
    },
    {
      level: 3, hpDie: 8, choices: [], grants: [domainSpells(['mirror_image'])],
    },
    {
      level: 5, hpDie: 8, choices: [], grants: [domainSpells(['blink', 'dispel_magic'])],
    },
    {
      level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'cloak_of_shadows', name: 'Channel Divinity: Cloak of Shadows', description: 'Become invisible until the end of your next turn, or until you attack or cast a spell.', source: { kind: 'subclass', refId: 'trickery_domain' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'channel_divinity_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [{ type: 'apply_condition', conditionId: 'invisible', duration: { unit: 'rounds', remaining: 1 } }],
        } },
      ],
    },
    {
      level: 7, hpDie: 8, choices: [], grants: [domainSpells(['dimension_door'])],
    },
    {
      level: 8, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'divine_strike_trickery', name: 'Divine Strike', description: 'Once per turn, deal an extra 1d8 poison damage to one creature with a weapon attack (2d8 at level 14 — same card, description only for the upgrade).', source: { kind: 'subclass', refId: 'trickery_domain' }, level: 8, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'poison' }],
        } },
      ],
    },
    {
      level: 9, hpDie: 8, choices: [], grants: [domainSpells(['dominate_person', 'modify_memory'])],
    },
    {
      level: 17, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'improved_duplicity', name: 'Improved Duplicity', description: 'Invoke Duplicity now creates up to four duplicates instead of one, and you can move any number of them up to 30 feet each as a bonus action (still max 120 feet from you).', source: { kind: 'subclass', refId: 'trickery_domain' }, level: 17, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

// ── Twilight Domain ───────────────────────────────────────────────────────────

export const twilightDomainProgression: SubclassProgression = {
  classId: 'cleric',
  name: 'Twilight Domain',
  srd: false,
  entries: [
    {
      level: 1, hpDie: 8, choices: [],
      grants: [
        { kind: 'proficiency', value: { armor: ['heavy'], weapons: ['martial'] } },
        { kind: 'feature', value: { id: 'eyes_of_night', name: 'Eyes of Night', description: 'You gain darkvision out to 300 feet, treating dim light as bright and darkness as dim within that range. As an action, share this darkvision for 1 hour with a number of willing creatures within 10 feet equal to your WIS modifier (min 1); usable again only after a long rest unless you spend a spell slot.', source: { kind: 'subclass', refId: 'twilight_domain' }, level: 1, effects: [
          { type: 'grant_sense', target: 'darkvision', operation: 'set', value: null, condition: null, senseType: 'darkvision', senseRange: 300 },
        ], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'vigilant_blessing', name: 'Vigilant Blessing', description: 'As an action, touch a creature (possibly yourself) to grant it advantage on its next initiative roll, until used or until you use this feature again.', source: { kind: 'subclass', refId: 'twilight_domain' }, level: 1, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: null, range: 'touch', target: 'single', requiresSave: null },
          abilityEffects: [],
        } },
        domainSpells(['faerie_fire', 'sleep']),
      ],
    },
    {
      level: 2, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'twilight_sanctuary', name: 'Channel Divinity: Twilight Sanctuary', description: 'Create a 30-foot dim-light sphere centered on you, lasting 1 minute or until you\'re incapacitated or die. Any creature (including you) that ends its turn inside gains temporary HP equal to 1d6 + your cleric level, or has one charmed/frightened condition ended on it.', source: { kind: 'subclass', refId: 'twilight_domain' }, level: 2, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'channel_divinity_pool', quantity: 1 }, range: '30 feet', target: 'area', requiresSave: null },
          abilityEffects: [],
        } },
      ],
    },
    {
      level: 3, hpDie: 8, choices: [], grants: [domainSpells(['moonbeam'])],
    },
    {
      level: 5, hpDie: 8, choices: [], grants: [],
    },
    {
      level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'steps_of_night', name: 'Steps of Night', description: 'As a bonus action while in dim light or darkness, gain a flying speed equal to your walking speed for 1 minute. Usable a number of times equal to your proficiency bonus per long rest.', source: { kind: 'subclass', refId: 'twilight_domain' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [{ type: 'grant_speed', speedType: 'fly', amount: 30, duration: { unit: 'minutes', remaining: 1 } }],
        } },
      ],
    },
    {
      level: 7, hpDie: 8, choices: [], grants: [domainSpells(['greater_invisibility'])],
    },
    {
      level: 8, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'divine_strike_twilight', name: 'Divine Strike', description: 'Once per turn, deal an extra 1d8 radiant damage to one creature with a weapon attack (2d8 at level 14 — same card, description only for the upgrade).', source: { kind: 'subclass', refId: 'twilight_domain' }, level: 8, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'radiant' }],
        } },
      ],
    },
    {
      level: 9, hpDie: 8, choices: [], grants: [domainSpells(['mislead'])],
    },
    {
      level: 17, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'twilight_shroud', name: 'Twilight Shroud', description: 'You and allies inside your Twilight Sanctuary sphere have half cover while within it.', source: { kind: 'subclass', refId: 'twilight_domain' }, level: 17, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

// ── War Domain ────────────────────────────────────────────────────────────────

export const warDomainProgression: SubclassProgression = {
  classId: 'cleric',
  name: 'War Domain',
  srd: false,
  entries: [
    {
      level: 1, hpDie: 8, choices: [],
      grants: [
        { kind: 'proficiency', value: { armor: ['heavy'], weapons: ['martial'] } },
        { kind: 'feature', value: { id: 'war_priest', name: 'War Priest', description: 'When you take the Attack action, you can make one weapon attack as a bonus action. Usable a number of times equal to your WIS modifier (min 1) per long rest.', source: { kind: 'subclass', refId: 'war_domain' }, level: 1, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [],
        } },
        domainSpells(['divine_favor', 'shield_of_faith']),
      ],
    },
    {
      level: 2, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'guided_strike', name: 'Channel Divinity: Guided Strike', description: 'After seeing an attack roll you make but before the DM says whether it hits, spend Channel Divinity to add +10 to that roll.', source: { kind: 'subclass', refId: 'war_domain' }, level: 2, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: { resourceId: 'channel_divinity_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [],
        } },
      ],
    },
    {
      level: 3, hpDie: 8, choices: [], grants: [domainSpells(['magic_weapon'])],
    },
    {
      level: 5, hpDie: 8, choices: [], grants: [],
    },
    {
      level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'war_gods_blessing', name: "Channel Divinity: War God's Blessing", description: 'As a reaction after seeing an ally\'s attack roll within 30 feet but before the DM says whether it hits, spend Channel Divinity to grant it +10 on that roll.', source: { kind: 'subclass', refId: 'war_domain' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: { resourceId: 'channel_divinity_pool', quantity: 1 }, range: '30 feet', target: 'single', requiresSave: null },
          abilityEffects: [],
        } },
      ],
    },
    {
      level: 7, hpDie: 8, choices: [], grants: [domainSpells(['freedom_of_movement'])],
    },
    {
      level: 8, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'divine_strike_war', name: 'Divine Strike', description: 'Once per turn, deal an extra 1d8 damage of your weapon\'s type to one creature with a weapon attack (2d8 at level 14 — same card, description only for the upgrade).', source: { kind: 'subclass', refId: 'war_domain' }, level: 8, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'slashing' }],
        } },
      ],
    },
    {
      level: 9, hpDie: 8, choices: [], grants: [domainSpells(['flame_strike', 'hold_monster'])],
    },
    {
      level: 17, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'avatar_of_battle', name: 'Avatar of Battle', description: 'You gain resistance to nonmagical bludgeoning, piercing, and slashing damage.', source: { kind: 'subclass', refId: 'war_domain' }, level: 17, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

// ── Fate Domain (Unearthed Arcana) ───────────────────────────────────────────
export const fateDomainUaProgression: SubclassProgression = {
  classId: 'cleric', name: 'Fate Domain (UA)', srd: false,
  entries: [
    { level: 1, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'omens_and_portents_pool', name: 'Omens and Portents', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'omens_and_portents', name: 'Omens and Portents', description: 'Cast Augury without a slot or components once per long rest. Until you finish a long rest, reduce by 25% the chance a divination spell (Augury, Commune, Divination, etc.) gives you no answer or a random reading. Augury isn\'t in this codebase\'s spell library yet — no cast_spell hook until it\'s added.', source: { kind: 'subclass', refId: 'fate_domain_ua' }, level: 1, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'omens_and_portents_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
        { kind: 'feature', value: { id: 'ties_that_bind', name: 'Ties That Bind', description: 'As an action, tie a strand of fate to a touched object or creature for 1 hour or until you use this again (an unwilling creature resists with a Wisdom save against your spell save DC); while bound and on your plane, you sense its direction and whether it\'s moving. Once per turn when you deal damage or healing to it with a spell slot, roll a d6 and add it to that roll. Usable a number of times equal to your proficiency bonus per long rest.', source: { kind: 'subclass', refId: 'fate_domain_ua' }, level: 1, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: null, range: 'touch', target: 'single', requiresSave: { ability: 'wis', dc: 'spell_save_dc' } },
          abilityEffects: [] } },
      ] },
    { level: 2, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'strands_of_fate', name: 'Channel Divinity: Strands of Fate', description: 'As a bonus action, use your Channel Divinity to enter a fate-weaving state for up to 1 minute or until your concentration ends: whenever another creature you can see makes an attack roll or ability check, use a reaction to grant it advantage or disadvantage (your choice).', source: { kind: 'subclass', refId: 'fate_domain_ua' }, level: 2, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'channel_divinity_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 6, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'insightful_striking', name: 'Insightful Striking', description: 'As a bonus action, glimpse a chosen creature\'s defenses within 30 feet: until the end of your next turn, choose to add a rolled d6 to your next attack roll against it, or subtract a rolled d6 from the next save it makes against your spell. Usable a number of times equal to your proficiency bonus per long rest.', source: { kind: 'subclass', refId: 'fate_domain_ua' }, level: 6, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'bonus_action', resourceCost: null, range: '30 feet', target: 'single', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 8, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'potent_spellcasting_fate', name: 'Potent Spellcasting', description: 'Add your Wisdom modifier to the damage you deal with any cleric cantrip. No formula slot exists for this flat WIS-to-cantrip-damage bonus — apply manually.', source: { kind: 'subclass', refId: 'fate_domain_ua' }, level: 8, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 17, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'visions_of_the_future_pool', name: 'Visions of the Future', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'visions_of_the_future', name: 'Visions of the Future', description: 'Cast Foresight once without a spell slot (1-minute duration for this casting). Usable once per long rest.', source: { kind: 'subclass', refId: 'fate_domain_ua' }, level: 17, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'visions_of_the_future_pool', quantity: 1 }, range: 'touch', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'cast_spell', spellId: 'foresight' }] } },
      ] },
  ],
};

// ── Zeal Domain (Amonkhet) ───────────────────────────────────────────────────
export const zealDomainProgression: SubclassProgression = {
  classId: 'cleric', name: 'Zeal Domain (Amonkhet)', srd: false,
  entries: [
    { level: 1, hpDie: 8, choices: [],
      grants: [
        { kind: 'proficiency', value: { armor: ['heavy'], weapons: ['martial'] } },
        { kind: 'resource', value: { resourceId: 'priest_of_zeal_pool', name: 'Priest of Zeal (scales with Wisdom modifier)', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'priest_of_zeal', name: 'Priest of Zeal', description: 'Gain proficiency with martial weapons and heavy armor. When you take the Attack action, make one weapon attack as a bonus action. Usable a number of times equal to your Wisdom modifier (minimum once) per long rest — tracked here as a single-use pool; increase its maximum to match.', source: { kind: 'subclass', refId: 'zeal_domain' }, level: 1, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: { resourceId: 'priest_of_zeal_pool', quantity: 1 }, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 2, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'consuming_fervor', name: 'Channel Divinity: Consuming Fervor', description: 'When you roll fire or thunder damage, use your Channel Divinity to deal maximum damage instead of rolling.', source: { kind: 'subclass', refId: 'zeal_domain' }, level: 2, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'free', resourceCost: { resourceId: 'channel_divinity_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 6, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'resounding_strike', name: 'Resounding Strike', description: 'When you deal thunder damage to a Large or smaller creature, also push it up to 10 feet away from you.', source: { kind: 'subclass', refId: 'zeal_domain' }, level: 6, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 8, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'divine_strike_zeal', name: 'Divine Strike', description: 'Once per turn on a hit with a weapon attack, deal an extra 1d8 damage of the weapon\'s type (2d8 at level 14).', source: { kind: 'subclass', refId: 'zeal_domain' }, level: 8, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'free', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'weapon' }] } }] },
    { level: 17, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'blaze_of_glory_pool', name: 'Blaze of Glory', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'blaze_of_glory', name: 'Blaze of Glory', description: 'When reduced to 0 HP by a visible attacker (even one that would kill you outright), use your reaction to move up to your speed toward it and make one melee weapon attack with advantage; on a hit it takes an extra 5d10 fire damage plus 5d10 of the weapon\'s type. You then fall unconscious and make death saves normally (or die if the original damage would have killed you outright). Usable once per long rest.', source: { kind: 'subclass', refId: 'zeal_domain' }, level: 17, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: { resourceId: 'blaze_of_glory_pool', quantity: 1 }, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '5d10', damageType: 'fire' }] } },
      ] },
  ],
};

// ── Solidarity Domain (Amonkhet) ─────────────────────────────────────────────
export const solidarityDomainProgression: SubclassProgression = {
  classId: 'cleric', name: 'Solidarity Domain (Amonkhet)', srd: false,
  entries: [
    { level: 1, hpDie: 8, choices: [],
      grants: [
        { kind: 'proficiency', value: { armor: ['heavy'] } },
        { kind: 'resource', value: { resourceId: 'solidaritys_action_pool', name: "Solidarity's Action (scales with Wisdom modifier)", maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'solidaritys_action', name: "Solidarity's Action", description: 'Gain proficiency with heavy armor. When you take the Help action to aid an ally\'s attack, make one weapon attack as a bonus action. Usable a number of times equal to your Wisdom modifier (minimum once) per long rest — tracked here as a single-use pool; increase its maximum to match.', source: { kind: 'subclass', refId: 'solidarity_domain' }, level: 1, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: { resourceId: 'solidaritys_action_pool', quantity: 1 }, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 2, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'preserve_life', name: 'Channel Divinity: Preserve Life', description: 'As an action, restore hit points equal to five times your cleric level, divided among creatures you choose within 30 feet (none above half their HP maximum; not usable on undead or constructs). The total pool has no fixed die to attach — apply the healing manually.', source: { kind: 'subclass', refId: 'solidarity_domain' }, level: 2, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: { resourceId: 'channel_divinity_pool', quantity: 1 }, range: '30 feet', target: 'multiple', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 6, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'oketras_blessing', name: "Channel Divinity: Oketra's Blessing", description: 'When a creature within 30 feet makes an attack roll, use your reaction to grant it a +10 bonus after seeing the roll but before the result is known.', source: { kind: 'subclass', refId: 'solidarity_domain' }, level: 6, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'reaction', resourceCost: { resourceId: 'channel_divinity_pool', quantity: 1 }, range: '30 feet', target: 'single', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 8, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'divine_strike_solidarity', name: 'Divine Strike', description: 'Once per turn on a hit with a weapon attack, deal an extra 1d8 damage of the weapon\'s type (2d8 at level 14).', source: { kind: 'subclass', refId: 'solidarity_domain' }, level: 8, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'free', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'weapon' }] } }] },
    { level: 17, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'supreme_healing', name: 'Supreme Healing', description: 'Whenever you roll dice to restore hit points with a spell, use the highest possible number for each die instead of rolling.', source: { kind: 'subclass', refId: 'solidarity_domain' }, level: 17, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

// ── Strength Domain (Amonkhet) ───────────────────────────────────────────────
export const strengthDomainProgression: SubclassProgression = {
  classId: 'cleric', name: 'Strength Domain (Amonkhet)', srd: false,
  entries: [
    { level: 1, hpDie: 8,
      choices: [{ id: 'acolyte_of_strength_skill', prompt: 'Choose a skill: Animal Handling, Athletics, Nature, or Survival.', kind: 'skill', count: 1, pool: [
        { id: 'animal_handling', label: 'Animal Handling', value: 'animal_handling' },
        { id: 'athletics', label: 'Athletics', value: 'athletics' },
        { id: 'nature', label: 'Nature', value: 'nature' },
        { id: 'survival', label: 'Survival', value: 'survival' },
      ], grants: [], required: true, resolved: false }],
      grants: [
        { kind: 'proficiency', value: { armor: ['heavy'] } },
        { kind: 'feature', value: { id: 'acolyte_of_strength', name: 'Acolyte of Strength', description: 'Gain proficiency with heavy armor and learn one druid cantrip of your choice. Druid cantrip choice isn\'t wired — no fixed spellId, it\'s a free pick from another class\'s list.', source: { kind: 'subclass', refId: 'strength_domain' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
      ] },
    { level: 2, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'feat_of_strength', name: 'Channel Divinity: Feat of Strength', description: 'When you make a Strength-based attack roll, ability check, or saving throw, use your Channel Divinity for a +10 bonus after seeing the roll but before the result is known.', source: { kind: 'subclass', refId: 'strength_domain' }, level: 2, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'free', resourceCost: { resourceId: 'channel_divinity_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 6, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'rhonas_blessing', name: "Channel Divinity: Rhonas' Blessing", description: 'When a creature within 30 feet makes a Strength-based attack roll, ability check, or saving throw, use your reaction to grant it a +10 bonus after seeing the roll but before the result is known.', source: { kind: 'subclass', refId: 'strength_domain' }, level: 6, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'reaction', resourceCost: { resourceId: 'channel_divinity_pool', quantity: 1 }, range: '30 feet', target: 'single', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 8, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'divine_strike_strength', name: 'Divine Strike', description: 'Once per turn on a hit with a weapon attack, deal an extra 1d8 damage of the weapon\'s type (2d8 at level 14).', source: { kind: 'subclass', refId: 'strength_domain' }, level: 8, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'free', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'weapon' }] } }] },
    { level: 17, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'avatar_of_battle', name: 'Avatar of Battle', description: 'Gain resistance to bludgeoning, piercing, and slashing damage from nonmagical attacks.', source: { kind: 'subclass', refId: 'strength_domain' }, level: 17, effects: [
      { type: 'grant_resistance', target: 'bludgeoning', operation: 'resistance', value: null, condition: null },
      { type: 'grant_resistance', target: 'piercing', operation: 'resistance', value: null, condition: null },
      { type: 'grant_resistance', target: 'slashing', operation: 'resistance', value: null, condition: null },
    ], actions: [], choices: [], passive: true } }] },
  ],
};

export const CLERIC_SUBCLASSES: SubclassProgression[] = [
  lifeDomainProgression,
  lightDomainProgression,
  arcanaDomainProgression,
  deathDomainProgression,
  forgeDomainProgression,
  graveDomainProgression,
  knowledgeDomainProgression,
  natureDomainProgression,
  orderDomainProgression,
  peaceDomainProgression,
  tempestDomainProgression,
  trickeryDomainProgression,
  twilightDomainProgression,
  warDomainProgression,
  fateDomainUaProgression,
  zealDomainProgression,
  solidarityDomainProgression,
  strengthDomainProgression,
];
