// ============================================================================
// FILE: src/content/subclasses/druid.ts
// Druid subclasses: Circle of the Land, Circle of the Moon, Dreams, Spores,
// Stars, Wildfire, the Shepherd, plus Circle of the Primeval — a deferred
// Unearthed Arcana entry (dinosaur-spirit companion), srd: false.
// ============================================================================
import { ClassProgression, Grant } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

// Same mechanism as Cleric's domainSpells() — always-prepared circle spells.
function circleSpells(spellIds: string[]): Grant {
  return { kind: 'known_spells', value: { spellIds } };
}

export const circleOfTheLandProgression: SubclassProgression = {
  classId: 'druid', name: 'Circle of the Land', srd: true,
  entries: [
    { level: 2, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'bonus_cantrip', name: 'Bonus Cantrip', description: 'Learn one additional druid cantrip of your choice.', source: { kind: 'subclass', refId: 'circle_land' }, level: 2, effects: [], actions: [], choices: [], passive: true } }, { kind: 'feature', value: { id: 'natural_recovery', name: 'Natural Recovery', description: 'Once between long rests, regain expended spell slots during a short rest. Total levels ≤ half druid level (rounded up). No slots above 5th.', source: { kind: 'subclass', refId: 'circle_land' }, level: 2, effects: [], actions: [], choices: [], passive: false } }] },
    { level: 6, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'lands_stride', name: "Land's Stride", description: 'Moving through nonmagical difficult terrain costs no extra movement. Pass through nonmagical plants without being slowed or damaged. Advantage on saves against plants created by magic.', source: { kind: 'subclass', refId: 'circle_land' }, level: 6, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 10, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'natures_ward', name: "Nature's Ward", description: 'Immune to poison and disease. Immune to charm and fear from elementals and fey.', source: { kind: 'subclass', refId: 'circle_land' }, level: 10, effects: [{ type: 'condition_immunity', target: 'poison', operation: 'immunity', value: null, condition: null }, { type: 'condition_immunity', target: 'disease', operation: 'immunity', value: null, condition: null }], actions: [], choices: [], passive: true } }] },
    { level: 14, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'natures_sanctuary', name: "Nature's Sanctuary", description: 'Beasts and plants must make a WIS save when attacking you or be compelled to choose a different target.', source: { kind: 'subclass', refId: 'circle_land' }, level: 14, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

export const circleOfTheMoonProgression: SubclassProgression = {
  classId: 'druid', name: 'Circle of the Moon', srd: false,
  entries: [
    { level: 2, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'combat_wild_shape', name: 'Combat Wild Shape', description: 'Wild Shape as a bonus action. While in beast form, use a bonus action to expend a spell slot (1 die per slot level) to regain HP.', source: { kind: 'subclass', refId: 'circle_moon' }, level: 2, effects: [], actions: [], choices: [], passive: true } }, { kind: 'feature', value: { id: 'circle_forms', name: 'Circle Forms', description: 'CR limit for Wild Shape increases to 1. At level 6, CR limit = druid level / 3 (rounded down).', source: { kind: 'subclass', refId: 'circle_moon' }, level: 2, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 6, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'primal_strike', name: 'Primal Strike', description: 'Your beast attacks in Wild Shape count as magical for overcoming resistance.', source: { kind: 'subclass', refId: 'circle_moon' }, level: 6, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 10, hpDie: 8, choices: [], grants: [
      { kind: 'feature', value: { id: 'elemental_wild_shape_air', name: 'Elemental Wild Shape: Air', description: 'Expend two uses of Wild Shape to transform into an air elemental.', source: { kind: 'subclass', refId: 'circle_moon' }, level: 10, effects: [], actions: [], choices: [], passive: false, tags: ['transformation'],
        activation: { actionType: 'action', resourceCost: { resourceId: 'wild_shape_pool', quantity: 2 }, range: 'self', target: 'self', requiresSave: null },
        abilityEffects: [{ type: 'transform', formId: 'air_elemental' }],
      } },
      { kind: 'feature', value: { id: 'elemental_wild_shape_earth', name: 'Elemental Wild Shape: Earth', description: 'Expend two uses of Wild Shape to transform into an earth elemental.', source: { kind: 'subclass', refId: 'circle_moon' }, level: 10, effects: [], actions: [], choices: [], passive: false, tags: ['transformation'],
        activation: { actionType: 'action', resourceCost: { resourceId: 'wild_shape_pool', quantity: 2 }, range: 'self', target: 'self', requiresSave: null },
        abilityEffects: [{ type: 'transform', formId: 'earth_elemental' }],
      } },
      { kind: 'feature', value: { id: 'elemental_wild_shape_fire', name: 'Elemental Wild Shape: Fire', description: 'Expend two uses of Wild Shape to transform into a fire elemental.', source: { kind: 'subclass', refId: 'circle_moon' }, level: 10, effects: [], actions: [], choices: [], passive: false, tags: ['transformation'],
        activation: { actionType: 'action', resourceCost: { resourceId: 'wild_shape_pool', quantity: 2 }, range: 'self', target: 'self', requiresSave: null },
        abilityEffects: [{ type: 'transform', formId: 'fire_elemental' }],
      } },
      { kind: 'feature', value: { id: 'elemental_wild_shape_water', name: 'Elemental Wild Shape: Water', description: 'Expend two uses of Wild Shape to transform into a water elemental.', source: { kind: 'subclass', refId: 'circle_moon' }, level: 10, effects: [], actions: [], choices: [], passive: false, tags: ['transformation'],
        activation: { actionType: 'action', resourceCost: { resourceId: 'wild_shape_pool', quantity: 2 }, range: 'self', target: 'self', requiresSave: null },
        abilityEffects: [{ type: 'transform', formId: 'water_elemental' }],
      } },
    ] },
    { level: 14, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'thousand_forms', name: 'Thousand Forms', description: 'Cast Alter Self at will without expending a spell slot.', source: { kind: 'subclass', refId: 'circle_moon' }, level: 14, effects: [], actions: [], choices: [], passive: false } }] },
  ],
};

// ── Circle of Dreams ──────────────────────────────────────────────────────────

export const circleOfDreamsProgression: SubclassProgression = {
  classId: 'druid', name: 'Circle of Dreams', srd: false,
  entries: [
    { level: 2, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'balm_of_summer_court_pool', name: 'Balm of the Summer Court (d6s)', maximum: 4, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'balm_of_the_summer_court', name: 'Balm of the Summer Court', description: 'You have a pool of fey-energy d6s equal to your druid level. As a bonus action, spend up to half your druid level of those dice on an ally within 120 feet — it regains HP equal to the total rolled and gains 1 temporary HP per die spent. The pool refills on a long rest.', source: { kind: 'subclass', refId: 'circle_dreams' }, level: 2, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'balm_of_summer_court_pool', quantity: 1 }, range: '120 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'heal', dice: '1d6' }],
        } },
      ] },
    { level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'hearth_of_moonlight_and_shadow', name: 'Hearth of Moonlight and Shadow', description: 'At the start of a short or long rest, conjure an invisible 30-foot sphere (blocked by total cover) that lasts until the rest ends or you leave it. You and allies inside gain +5 to Stealth and Perception checks, and open-flame light inside isn\'t visible from outside.', source: { kind: 'subclass', refId: 'circle_dreams' }, level: 6, effects: [], actions: [], choices: [], passive: false } },
      ] },
    { level: 10, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'hidden_paths', name: 'Hidden Paths', description: 'As a bonus action, teleport up to 60 feet to an unoccupied space you can see, or use your action to teleport a willing creature you touch up to 30 feet. Usable a number of times equal to your WIS modifier (min 1) per long rest.', source: { kind: 'subclass', refId: 'circle_dreams' }, level: 10, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: null, range: '60 feet', target: 'self', requiresSave: null },
          abilityEffects: [],
        } },
      ] },
    { level: 14, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'walker_in_dreams', name: 'Walker in Dreams', description: 'Once per short rest, cast Dream (as the messenger), Scrying, or a special Teleportation Circle that opens a portal to the last place you finished a long rest on your current plane — without a slot or material components.', source: { kind: 'subclass', refId: 'circle_dreams' }, level: 14, effects: [], actions: [], choices: [], passive: false } },
      ] },
  ],
};

// ── Circle of Spores ──────────────────────────────────────────────────────────

export const circleOfSporesProgression: SubclassProgression = {
  classId: 'druid', name: 'Circle of Spores', srd: false,
  entries: [
    { level: 2, hpDie: 8, choices: [],
      grants: [
        circleSpells(['chill_touch']),
        { kind: 'feature', value: { id: 'halo_of_spores', name: 'Halo of Spores', description: 'As a reaction, when a creature you can see moves within 10 feet of you or starts its turn there, deal it 1d4 necrotic damage (CON save negates; 1d6 at level 6, 1d8 at level 10, 1d10 at level 14).', source: { kind: 'subclass', refId: 'circle_spores' }, level: 2, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: null, range: '10 feet', target: 'single', requiresSave: { ability: 'con', dc: 'spell_save_dc' } },
          abilityEffects: [{ type: 'damage', dice: '1d4', damageType: 'necrotic', saveOnSuccess: 'none' }],
        } },
        { kind: 'feature', value: { id: 'symbiotic_entity', name: 'Symbiotic Entity', description: 'Spend a use of Wild Shape (instead of transforming) to gain 4 temporary HP per druid level for 10 minutes. While active: Halo of Spores rolls its damage die twice, and your melee weapon attacks deal an extra 1d6 necrotic damage.', source: { kind: 'subclass', refId: 'circle_spores' }, level: 2, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'wild_shape_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [],
        } },
      ] },
    { level: 6, hpDie: 8, choices: [], grants: [circleSpells(['blindness_deafness', 'gentle_repose']),
        { kind: 'feature', value: { id: 'fungal_infestation', name: 'Fungal Infestation', description: 'As a reaction, when a Small or Medium beast or humanoid dies within 10 feet of you, animate its corpse as a zombie under your command (1 hour duration, acts right after your turn, Attack action only). Usable a number of times equal to your WIS modifier (min 1) per long rest.', source: { kind: 'subclass', refId: 'circle_spores' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: null, range: '10 feet', target: 'single', requiresSave: null },
          abilityEffects: [],
        } },
      ] },
    { level: 10, hpDie: 8, choices: [], grants: [circleSpells(['animate_dead', 'gaseous_form']),
        { kind: 'feature', value: { id: 'spreading_spores', name: 'Spreading Spores', description: 'As a bonus action while Symbiotic Entity is active, hurl your spores up to 30 feet to fill a 10-foot cube for 1 minute; a creature that enters or starts its turn there takes your Halo of Spores damage (CON save negates, max once per turn). Disables your Halo of Spores reaction while the cube persists.', source: { kind: 'subclass', refId: 'circle_spores' }, level: 10, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: null, range: '30 feet', target: 'area', requiresSave: { ability: 'con', dc: 'spell_save_dc' } },
          abilityEffects: [],
        } },
      ] },
    { level: 14, hpDie: 8, choices: [], grants: [circleSpells(['blight', 'confusion']),
        { kind: 'feature', value: { id: 'fungal_body', name: 'Fungal Body', description: 'You can\'t be blinded, deafened, frightened, or poisoned, and any critical hit against you counts as a normal hit instead, unless you\'re incapacitated.', source: { kind: 'subclass', refId: 'circle_spores' }, level: 14, effects: [
          { type: 'condition_immunity', target: 'blinded', operation: 'immunity', value: null, condition: null },
          { type: 'condition_immunity', target: 'deafened', operation: 'immunity', value: null, condition: null },
          { type: 'condition_immunity', target: 'frightened', operation: 'immunity', value: null, condition: null },
          { type: 'condition_immunity', target: 'poisoned', operation: 'immunity', value: null, condition: null },
        ], actions: [], choices: [], passive: true } },
      ] },
  ],
};

// ── Circle of Stars ───────────────────────────────────────────────────────────

export const circleOfStarsProgression: SubclassProgression = {
  classId: 'druid', name: 'Circle of Stars', srd: false,
  entries: [
    { level: 2, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'star_map', name: 'Star Map', description: 'Create a Tiny star chart usable as a spellcasting focus. While holding it: you know Guidance, you always have Guiding Bolt prepared as a druid spell (not counted against your prepared total), and you can cast it without a slot a number of times equal to your proficiency bonus per long rest. A lost map can be remade with an hour-long ceremony during a rest.', source: { kind: 'subclass', refId: 'circle_stars' }, level: 2, effects: [], actions: [], choices: [], passive: true } },
        circleSpells(['guiding_bolt']),
        { kind: 'feature', value: { id: 'starry_form', name: 'Starry Form', description: 'As a bonus action, spend a use of Wild Shape to become a luminous starry form for 10 minutes (retaining your stats, shedding light in a 10-foot radius plus 10 feet dim) instead of transforming into a beast. Choose a constellation each time: Archer (bonus-action ranged spell attack, 1d8 + WIS radiant on a hit), Chalice (a healing spell slot also heals a second creature within 30 feet for 1d8 + WIS), or Dragon (treat a 9 or lower as a 10 on INT/WIS checks and concentration saves).', source: { kind: 'subclass', refId: 'circle_stars' }, level: 2, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'wild_shape_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [],
        } },
      ] },
    { level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'cosmic_omen', name: 'Cosmic Omen', description: 'On finishing a long rest, roll a die: even grants a reaction (until your next long rest) to add a rolled d6 to an ally\'s attack roll, save, or check within 30 feet (Weal); odd grants the same reaction but subtracts the d6 instead (Woe). Usable a number of times equal to your proficiency bonus per long rest.', source: { kind: 'subclass', refId: 'circle_stars' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: null, range: '30 feet', target: 'single', requiresSave: null },
          abilityEffects: [],
        } },
      ] },
    { level: 10, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'twinkling_constellations', name: 'Twinkling Constellations', description: 'Starry Form improves: the Archer and Chalice dice become 2d8, the Dragon grants a 20-foot hovering flying speed, and you can switch constellations at the start of each of your turns.', source: { kind: 'subclass', refId: 'circle_stars' }, level: 10, effects: [], actions: [], choices: [], passive: true } },
      ] },
    { level: 14, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'full_of_stars', name: 'Full of Stars', description: 'While in Starry Form, you become partially incorporeal, gaining resistance to bludgeoning, piercing, and slashing damage.', source: { kind: 'subclass', refId: 'circle_stars' }, level: 14, effects: [], actions: [], choices: [], passive: true } },
      ] },
  ],
};

// ── Circle of Wildfire ────────────────────────────────────────────────────────

export const circleOfWildfireProgression: SubclassProgression = {
  classId: 'druid', name: 'Circle of Wildfire', srd: false,
  entries: [
    { level: 2, hpDie: 8, choices: [], grants: [circleSpells(['burning_hands', 'cure_wounds']),
        { kind: 'feature', value: { id: 'summon_wildfire_spirit', name: 'Summon Wildfire Spirit', description: 'Spend a use of Wild Shape (instead of transforming) to summon a friendly wildfire spirit within 30 feet for 1 hour — a small fire elemental (5 + 5x your druid level HP, fire immunity, ranged fire attacks) that shares your initiative and obeys your commands. Each creature within 10 feet of it when it appears takes 2d6 fire damage (DEX save halves).', source: { kind: 'subclass', refId: 'circle_wildfire' }, level: 2, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'wild_shape_pool', quantity: 1 }, range: '30 feet', target: 'area', requiresSave: { ability: 'dex', dc: 'spell_save_dc' } },
          abilityEffects: [{ type: 'damage', dice: '2d6', damageType: 'fire', saveOnSuccess: 'half' }],
        } },
      ] },
    { level: 6, hpDie: 8, choices: [], grants: [circleSpells(['flaming_sphere', 'scorching_ray']),
        { kind: 'feature', value: { id: 'enhanced_bond', name: 'Enhanced Bond', description: 'While your wildfire spirit is summoned, casting a spell that deals fire damage or restores HP adds a rolled d8 to one damage or healing roll of that spell. Spells with a range other than self can also originate from your spirit\'s location.', source: { kind: 'subclass', refId: 'circle_wildfire' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
      ] },
    { level: 10, hpDie: 8, choices: [], grants: [circleSpells(['plant_growth', 'revivify']),
        { kind: 'feature', value: { id: 'cauterizing_flames', name: 'Cauterizing Flames', description: 'When a Small or larger creature dies within 30 feet of you or your spirit, a spectral flame lingers in its space for 1 minute. As a reaction when a creature enters that space, extinguish the flame to heal or burn it for 2d10 + WIS modifier. Usable a number of times equal to your proficiency bonus per long rest.', source: { kind: 'subclass', refId: 'circle_wildfire' }, level: 10, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: null, range: '30 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '2d10', damageType: 'fire' }],
        } },
      ] },
    { level: 14, hpDie: 8, choices: [], grants: [circleSpells(['aura_of_life', 'fire_shield']),
        { kind: 'feature', value: { id: 'blazing_revival', name: 'Blazing Revival', description: 'If your wildfire spirit is within 120 feet when you drop to 0 HP, you can sacrifice it (dropping it to 0 HP) to instantly regain half your HP and stand up. Usable once per long rest.', source: { kind: 'subclass', refId: 'circle_wildfire' }, level: 14, effects: [], actions: [], choices: [], passive: false } },
      ] },
  ],
};

// ── Circle of the Shepherd ────────────────────────────────────────────────────

export const circleOfTheShepherdProgression: SubclassProgression = {
  classId: 'druid', name: 'Circle of the Shepherd', srd: false,
  entries: [
    { level: 2, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'speech_of_the_woods', name: 'Speech of the Woods', description: 'Learn Sylvan. Beasts can understand your speech and you can decipher their sounds and body language well enough for a friendly beast to relay what it recently saw or heard.', source: { kind: 'subclass', refId: 'circle_shepherd' }, level: 2, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'spirit_totem', name: 'Spirit Totem', description: 'As a bonus action, summon an incorporeal spirit within 60 feet, radiating a 30-foot aura for 1 minute (movable 60 feet as a bonus action). Choose a spirit: Bear grants allies in the aura temporary HP (5 + druid level) and advantage on STR checks/saves; Hawk lets you grant advantage on one attack roll against a target in the aura as a reaction, plus advantage on Perception checks in the aura; Unicorn grants advantage on checks to detect creatures in the aura, and your healing spells also heal one chosen creature in the aura for your druid level. Usable once per short or long rest.', source: { kind: 'subclass', refId: 'circle_shepherd' }, level: 2, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: null, range: '60 feet', target: 'area', requiresSave: null },
          abilityEffects: [],
        } },
      ] },
    { level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'mighty_summoner', name: 'Mighty Summoner', description: 'Beasts and fey you summon or create with a spell appear with 2 extra HP per Hit Die, and their natural weapons count as magical for overcoming resistance and immunity to nonmagical attacks.', source: { kind: 'subclass', refId: 'circle_shepherd' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
      ] },
    { level: 10, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'guardian_spirit', name: 'Guardian Spirit', description: 'A beast or fey you summoned or created that ends its turn in your Spirit Totem aura regains HP equal to half your druid level.', source: { kind: 'subclass', refId: 'circle_shepherd' }, level: 10, effects: [], actions: [], choices: [], passive: true } },
      ] },
    { level: 14, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'faithful_summons', name: 'Faithful Summons', description: 'If you drop to 0 HP or are incapacitated against your will, immediately gain the effect of Conjure Animals cast at 9th level (four CR-2-or-lower beasts appear within 20 feet, protecting you for 1 hour with no concentration required). Usable once per long rest.', source: { kind: 'subclass', refId: 'circle_shepherd' }, level: 14, effects: [], actions: [], choices: [], passive: false } },
      ] },
  ],
};

// ── Circle of the Primeval (UA) ──────────────────────────────────────────────
export const circleOfThePrimevalProgression: SubclassProgression = {
  classId: 'druid', name: 'Circle of the Primeval (UA)', srd: false,
  entries: [
    { level: 2, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'keeper_of_old', name: 'Keeper of Old', description: 'Gain proficiency in History. On an Intelligence (History) check, roll a d4 and add it to the total.', source: { kind: 'subclass', refId: 'circle_primeval' }, level: 2, effects: [
          { type: 'grant_proficiency', target: 'skill:history', operation: 'add', value: null, condition: null },
        ], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'primeval_companion', name: 'Primeval Companion', description: 'As an action, expend a use of Wild Shape to summon your primeval companion (dinosaur or other ancient beast spirit) in an unoccupied space within 30 feet instead of transforming yourself. It\'s friendly, obeys your commands (AC 13 + prof bonus, HP 5 + 5 per druid level, a Strike attack, and Intercept Attack — redirecting half of an attack\'s damage from a nearby ally to itself), and lasts until reduced to 0 HP or you die.', source: { kind: 'subclass', refId: 'circle_primeval' }, level: 2, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'wild_shape_pool', quantity: 1 }, range: '30 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 6, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'prehistoric_conduit', name: 'Prehistoric Conduit', description: 'Spells you cast with a range other than self can originate from you or your primeval companion. Your companion has advantage on saving throws against your spells, and if it would normally take half damage on a success against one of your spells, it instead takes none on a success and half (with no additional effect) on a failure.', source: { kind: 'subclass', refId: 'circle_primeval' }, level: 6, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 10, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'titanic_bond', name: 'Titanic Bond', description: 'Your primeval companion grows to Large size, and you can grant it a climbing or swimming speed equal to its walking speed when summoned. Once per turn while it\'s summoned, when you hit with an attack or damage a creature you can see with a spell, force a Wisdom save (against your spell save DC) or frighten that creature until the end of your next turn.', source: { kind: 'subclass', refId: 'circle_primeval' }, level: 10, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'free', resourceCost: null, range: '5 feet', target: 'single', requiresSave: { ability: 'wis', dc: 'spell_save_dc' } },
      abilityEffects: [{ type: 'apply_condition', conditionId: 'frightened', duration: { unit: 'rounds', remaining: 1 } }] } }] },
    { level: 14, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'scourge_of_the_ancients', name: 'Scourge of the Ancients', description: 'As part of the bonus action you use to command your companion, expend a spell slot of any level to empower it for 1 hour (or until it vanishes, or you use this again): it becomes Huge (or the largest size that fits) with temporary hit points equal to 10 times the slot\'s level, its Strike deals extra damage equal to 1d8 plus the slot\'s level, and its walking speed increases by 5 feet per slot level.', source: { kind: 'subclass', refId: 'circle_primeval' }, level: 14, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'bonus_action', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
      abilityEffects: [] } }] },
  ],
};

export const DRUID_SUBCLASSES: SubclassProgression[] = [
  circleOfTheLandProgression,
  circleOfTheMoonProgression,
  circleOfDreamsProgression,
  circleOfSporesProgression,
  circleOfStarsProgression,
  circleOfWildfireProgression,
  circleOfTheShepherdProgression,
  circleOfThePrimevalProgression,
];
