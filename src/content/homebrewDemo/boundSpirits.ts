// src/content/homebrewDemo/boundSpirits.ts
// The twelve Bound Spirits of the Emperor Warlock (docs/homebrew/EMPEROR_WARLOCK_DEMO.md),
// as ModeOptions of the Legacy Binding mode group. Each has level-gated entries
// at 1/5/10/15/20 and the spirit-granted spells (known only while active).
//
// What is real and what is not, spirit by spirit, is stated in each feature's
// own description ("Automated:" / "Table-resolved:"). In short: proficiencies,
// expertise, numeric bonuses, limited-use pools, activation economy, save DCs
// and damage dice, ally auras/grants and spells are modeled; summoned
// creatures/units/armies, campaign-scale projects, recurring income, terrain
// and positioning are DM-adjudicated.
import type { ModeOption, ModeEntry, Feature, ResourceGrant } from '../../engine/types';
import {
  feat, pool, pbPool, manualPool, skillProf, skillProfOrExpertise, skillExpertise, weaponProf, add, setStat,
  active, spellFeature, activation, AUTO, TABLE,
} from './helpers';

type Spirit = { id: string; name: string; summary: string; entries: ModeEntry[] };

/**
 * Splits a spirit's bonus spells by level. 1st–5th-level spells are ordinary
 * known spells (they cost a Pact Magic slot). 6th+ level spells cost the
 * matching Legacy Arcanum use instead of a slot, so each becomes a feature that
 * casts it from that pool (the pool exists once Legacy Arcanum is gained at 11+).
 */
// Spell levels, stated here (checked against the spell library in the pack's
// tests) because the on-device spell repo loads lazily and cannot be consulted
// when this module is first imported.
export const SPIRIT_SPELL_LEVEL: Record<string, number> = {
  longstrider: 1, hunters_mark: 1, phantom_steed: 3, haste: 3, swift_quiver: 5, commune_with_nature: 5, wind_walk: 6, foresight: 9,
  command: 1, cause_fear: 1, fear: 3, animate_dead: 3, geas: 5, modify_memory: 5, finger_of_death: 7, power_word_kill: 9,
  fog_cloud: 1, pass_without_trace: 2, nondetection: 3, freedom_of_movement: 4, mislead: 5, reverse_gravity: 7,
  heroism: 1, sending: 3, scrying: 5, wall_of_force: 5, forcecage: 7, meteor_swarm: 9,
  dominate_person: 5, steel_wind_strike: 5, conjure_celestial: 7, shapechange: 9,
  disguise_self: 1, silent_image: 1, suggestion: 2, major_image: 3, project_image: 7,
  tongues: 3, legend_lore: 5, teleport: 7,
  protection_from_evil_and_good: 1, beacon_of_hope: 3, aura_of_vitality: 3, greater_restoration: 5, circle_of_power: 5, holy_aura: 8, mass_heal: 9,
  entangle: 1, plant_growth: 3, conjure_animals: 3, insect_plague: 5, animal_shapes: 8,
  shield_of_faith: 1, crusaders_mantle: 3, spirit_guardians: 3, wall_of_stone: 5, temple_of_the_gods: 7, invulnerability: 9,
  clairvoyance: 3, bless: 1,
};
const SPELL_NAME = (id: string) => id.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');

function spiritSpells(spiritId: string, level: number, spellIds: string[], cantripIds: string[] = []): Feature[] {
  const low: string[] = [];
  const out: Feature[] = [];
  for (const id of spellIds) {
    const spellLevel = SPIRIT_SPELL_LEVEL[id];
    if (spellLevel === undefined) throw new Error(`boundSpirits: no level recorded for spirit spell "${id}"`);
    if (spellLevel >= 6) {
      const name = SPELL_NAME(id);
      out.push(feat(`${spiritId}_cast_${id}`, `${name} (Legacy Arcanum ${spellLevel})`,
        `${AUTO}cast ${name} once without a slot using your ${spellLevel}th-level Legacy Arcanum; it recharges on a long rest (shared with your own Arcanum spell of that level). Known only while this Bound Spirit is active.`, {
          passive: false,
          activation: activation('action', `legacy_arcanum_${spellLevel}`, { range: 'self', target: 'single' }),
          abilityEffects: [{ type: 'cast_spell', spellId: id }],
        }));
    } else low.push(id);
  }
  if (low.length || cantripIds.length) out.unshift(spellFeature(`${spiritId}_spells_${level}`, 'Spirit-Granted Spells', cantripIds, low));
  return out;
}

const entry = (level: number, features: Feature[], resources: ResourceGrant[] = []): ModeEntry => ({ level, features, resources });
const SUMMON_NOTE = `${TABLE}the summoned creature/unit is run by the DM from the stat block above — Grimoire tracks the use and recharge, not the creature.`;

// ── 1 — Genghis Khan ────────────────────────────────────────────────────────
const genghis: Spirit = {
  id: 'genghis_khan', name: 'Genghis Khan', summary: 'Horse-lord and archer: mounted ranged combat, scouting, a sidekick.',
  entries: [
    entry(1, [
      feat('steppe_archer', 'Steppe Archer', `Shortbow, longbow and Animal Handling proficiency. While mounted: no disadvantage on ranged attacks solely because an enemy is adjacent, bow range +50%, and mounting/dismounting costs 5 ft.\n\n${AUTO}the three proficiencies.\n${TABLE}the mounted bow rules.`,
        { effects: [weaponProf('shortbow'), weaponProf('longbow'), skillProf('animal_handling')] }),
      ...spiritSpells('genghis_khan', 1, ['longstrider', 'hunters_mark']),
    ]),
    entry(5, [
      feat('born_in_the_saddle', 'Born in the Saddle', `Your mount gains +10 ft speed; you have advantage on checks and saves to avoid falling; you can take a Short Rest while traveling mounted.\n\n${TABLE}all of it (mount statistics and travel are not modeled).`),
      ...spiritSpells('genghis_khan', 5, ['phantom_steed', 'haste']),
    ]),
    entry(10, [
      active('eyes_of_the_khan', 'Eyes of the Khan', `Once per Long Rest, summon spectral eagles for 10 minutes to scout a 1-mile outdoor radius. As an action, see through one eagle. They reveal visible creatures, camps, fires, roads and large structures, but not through cover or magical concealment.\n\n${AUTO}the once-per-Long-Rest use.\n${SUMMON_NOTE}`, { poolId: 'eyes_of_the_khan' }),
      ...spiritSpells('genghis_khan', 10, ['swift_quiver', 'commune_with_nature']),
    ], [pool('eyes_of_the_khan', 'Eyes of the Khan', 1)]),
    entry(15, [
      active('appoint_a_noyan', 'Appoint a Noyan', `Once per month, one willing NPC of CR 1/2 or lower gains six Sidekick levels for the duration of the current binding.\n\n${AUTO}the once-per-month use, recharged by hand when a new month begins.\n${TABLE}the NPC and its levels.`, { poolId: 'appoint_a_noyan' }),
      ...spiritSpells('genghis_khan', 15, ['wind_walk']),
    ], [manualPool('appoint_a_noyan', 'Appoint a Noyan', 'once per in-game month')]),
    entry(20, [
      feat('reincarnation_of_the_khan', 'Reincarnation of the Khan', `Once per 10 in-game years, spend 24 hours to gain a wholly new appearance and mundane identity. The soul is unchanged.\n\n${TABLE}the whole feature — Grimoire has no calendar, so it only records that you have it.`),
      ...spiritSpells('genghis_khan', 20, ['foresight']),
    ]),
  ],
};

// ── 2 — Stalin ──────────────────────────────────────────────────────────────
const firingSquad = (dice: string, level: number) => active('firing_squad', 'Firing Squad',
  `Once per Long Rest, a target within 60 ft makes a DEX or CON save (the target chooses) against your Spirit Save DC. Failed save: ${dice} damage (4d6 at 1st, 6d6 at 5th, 8d6 at 10th, 10d6 at 15th, 12d6 at 20th); half on a success.\n\n${AUTO}the use, the DC and the damage dice (currently ${dice} at level ${level}); this card is replaced, not duplicated, as you level.\n${TABLE}the damage type (DM's call) and that the target may pick CON instead of DEX; applying the damage.`,
  { poolId: 'firing_squad', range: '60 feet', target: 'single', save: 'dex', damage: [{ dice, type: 'force', half: true }] });
const stalin: Spirit = {
  id: 'stalin', name: 'Stalin', summary: 'Terror and state power: a firing squad, a spectral mob, requisitions, a coup.',
  entries: [
    entry(1, [firingSquad('4d6', 1), ...spiritSpells('stalin', 1, ['command', 'cause_fear'])], [pool('firing_squad', 'Firing Squad', 1)]),
    entry(5, [
      firingSquad('6d6', 5),
      feat('open_the_vodka', 'Open the Vodka', `Consume a bottle of alcohol to summon a spectral mob for 1 minute: AC 12, HP 30 + 2 × your Emperor level, Speed 30, a 20-ft square; attack 2d6 + CHA bludgeoning using your Spirit Attack modifier; enemies in its space take −2 to ability checks; it acts immediately after you.\n\n${SUMMON_NOTE}`),
      ...spiritSpells('stalin', 5, ['fear', 'animate_dead']),
    ]),
    entry(10, [
      firingSquad('8d6', 10),
      feat('burn_moscow', 'Burn Moscow', `After 10 minutes destroying a defensible structure or base you control, pursuers have disadvantage on tracking, navigation and forced-pursuit checks for 24 hours, and your party has advantage evading pursuit.\n\n${TABLE}the whole feature (structures, pursuit and tracking are not modeled).`),
      ...spiritSpells('stalin', 10, ['geas', 'modify_memory']),
    ]),
    entry(15, [
      firingSquad('10d6', 15),
      active('comrades_provide', 'Comrades Provide', `Once per 7 Long Rests, in a settlement with supporters, requisition mundane goods and services worth up to 50 × your Emperor level gp. No magic items or cash.\n\n${AUTO}the once-per-7-Long-Rests use (recharged by hand).\n${TABLE}what is available and the gp value.`, { poolId: 'comrades_provide' }),
      ...spiritSpells('stalin', 15, ['finger_of_death']),
    ], [manualPool('comrades_provide', 'Comrades Provide', 'once per 7 long rests')]),
    entry(20, [
      firingSquad('12d6', 20),
      feat('take_the_country', 'Take the Country', `A four-stage campaign project: Popular Control → Local Influence → State Power → Coup. The DM sets obstacles. You have advantage on Charisma checks advancing it, with doubled proficiency where applicable.\n\n${TABLE}the whole project — Grimoire has no campaign-project model, so this is a reminder only.`),
      ...spiritSpells('stalin', 20, ['power_word_kill']),
    ]),
  ],
};

// ── 3 — Hannibal ────────────────────────────────────────────────────────────
const hannibal: Spirit = {
  id: 'hannibal', name: 'Hannibal', summary: 'Campaign master: terrain, envelopment, endurance, battle on enemy ground.',
  entries: [
    entry(1, [
      feat('enemy_of_empire', 'Enemy of Empire', `Choose one faction; gain History or Survival proficiency concerning it. Once per turn, deal extra damage equal to your proficiency bonus against that faction's agents.\n\n${TABLE}the faction, the proficiency choice and the extra damage (whether a target is an agent is a table fact).`),
      ...spiritSpells('hannibal', 1, ['longstrider', 'fog_cloud']),
    ]),
    entry(5, [
      feat('alpine_march', 'Alpine March', `You and companions within 60 ft ignore nonmagical difficult terrain overland, and your pace cannot drop below half due solely to ordinary terrain.\n\n${TABLE}all of it.`),
      ...spiritSpells('hannibal', 5, ['pass_without_trace', 'nondetection']),
    ]),
    entry(10, [
      active('double_envelopment', 'Double Envelopment', `Reaction, when an ally hits a creature adjacent to you: make one weapon attack against it. Proficiency-bonus uses per Long Rest.\n\n${AUTO}the Reaction and the proficiency-bonus-sized pool.\n${TABLE}adjacency and the attack roll.`, { actionType: 'reaction', poolId: 'double_envelopment' }),
      ...spiritSpells('hannibal', 10, ['freedom_of_movement', 'mislead']),
    ], [pbPool('double_envelopment', 'Double Envelopment')]),
    entry(15, [
      feat('master_campaigner', 'Master Campaigner', `You automatically succeed on exhaustion saves from ordinary heat and cold, and gain expertise in Survival.\n\n${AUTO}Survival expertise.\n${TABLE}the automatic exhaustion saves.`, { effects: [skillExpertise('survival')] }),
      ...spiritSpells('hannibal', 15, ['reverse_gravity']),
    ]),
    entry(20, [
      active('battle_on_enemy_ground', 'Battle on Enemy Ground', `Once per Long Rest, for 1 minute in hostile territory: you and allies within 60 ft gain +10 ft speed, +2 AC, advantage against being frightened, and advantage on the first weapon attack each turn.\n\n${AUTO}the use; +10 speed and +2 AC for you and the allies you tick on the Features tab's aura list (end it there after the minute).\n${TABLE}who is within 60 ft, "hostile territory", and the two advantages.`, {
        poolId: 'battle_on_enemy_ground', flag: 'battle_on_enemy_ground',
        allyGrants: [{ id: 'battle', mode: 'aura', label: 'Battle on Enemy Ground', rangeFeet: 60, includeSelf: true, activeWhileFlag: 'battle_on_enemy_ground',
          effects: [add('speed', 10), add('ac', 2)], note: 'Advantage against being frightened; advantage on your first weapon attack each turn (table-resolved).' }],
      }),
      ...spiritSpells('hannibal', 20, ['foresight']),
    ], [pool('battle_on_enemy_ground', 'Battle on Enemy Ground', 1)]),
  ],
};

// ── 4 — Napoleon ────────────────────────────────────────────────────────────
const napoleon: Spirit = {
  id: 'napoleon', name: 'Napoleon', summary: 'Artillery and ambition: scientists, presence, a rival, a grand battery.',
  entries: [
    entry(1, [
      feat('scientific_corps', 'Scientific Corps', `Add half your proficiency bonus to Intelligence checks you are not proficient in; gain Investigation or History proficiency.\n\n${TABLE}the half-proficiency bonus and the proficiency choice (the engine has no "untrained Intelligence" bonus).`),
      ...spiritSpells('napoleon', 1, ['command', 'heroism']),
    ]),
    entry(5, [
      feat('imperial_presence', 'Imperial Presence', `Your Charisma increases by 1 (maximum 20). Gain Persuasion proficiency, or expertise if you already have it.\n\n${AUTO}+1 Charisma and Persuasion proficiency/expertise.\n${TABLE}the 20 cap (do not exceed it).`, { effects: [add('cha', 1), skillProfOrExpertise('persuasion')] }),
      ...spiritSpells('napoleon', 5, ['sending', 'haste']),
    ]),
    entry(10, [
      active('against_the_odds', 'Against the Odds', `Once per Long Rest, when you are outnumbered at the start of combat: allies of your choice within 30 ft gain temporary hit points equal to your Emperor level for 1 minute and add half your proficiency bonus to saving throws during the first round.\n\n${AUTO}the use; temp HP and the save bonus for the allies you tick (the bonus lasts one round of their turns).\n${TABLE}"outnumbered" and who is within 30 ft.`, {
        actionType: 'free', poolId: 'against_the_odds',
        allyGrants: [{ id: 'odds', mode: 'chosen', label: 'Against the Odds', rangeFeet: 30, targets: 'many', tempHp: { addLevel: true },
          effects: [add('savingThrows.str', 1), add('savingThrows.dex', 1), add('savingThrows.con', 1), add('savingThrows.int', 1), add('savingThrows.wis', 1), add('savingThrows.cha', 1)],
          valueFromProficiency: 'half', duration: { unit: 'rounds', remaining: 1 } }],
      }),
      ...spiritSpells('napoleon', 10, ['scrying', 'wall_of_force']),
    ], [pool('against_the_odds', 'Against the Odds', 1)]),
    entry(15, [
      feat('chosen_rival', 'Chosen Rival', `After 1 hour studying a target, you have advantage on Investigation, History and Survival checks about it, and deal +1d8 damage once per turn against it or its agents.\n\n${TABLE}the whole feature (marked-creature state is not modeled).`),
      ...spiritSpells('napoleon', 15, ['forcecage']),
    ]),
    entry(20, [
      active('grand_battery', 'Grand Battery', `Once per Long Rest, choose a point within 1 mile. A 60-ft-radius area there: DEX save; 10d8 fire plus 10d8 bludgeoning damage, half on a success, double to objects and structures.\n\n${AUTO}the use, the Spirit Save DC and both damage dice.\n${TABLE}the point, who is in the area, and applying the damage.`, {
        poolId: 'grand_battery', range: '1 mile', target: 'area', save: 'dex', damage: [{ dice: '10d8', type: 'fire', half: true }, { dice: '10d8', type: 'bludgeoning', half: true }] }),
      ...spiritSpells('napoleon', 20, ['meteor_swarm']),
    ], [pool('grand_battery', 'Grand Battery', 1)]),
  ],
};

// ── 5 — Alexander the Great ─────────────────────────────────────────────────
const alexander: Spirit = {
  id: 'alexander_the_great', name: 'Alexander the Great', summary: 'Shock cavalry: hammer and anvil, mounts, a ward, conqueror\'s tempo.',
  entries: [
    entry(1, [
      feat('hammer_and_anvil', 'Hammer and Anvil', `Once per turn, add your proficiency bonus to an attack roll against a creature that is also threatened by an ally, unless two or more enemies are adjacent to you.\n\n${TABLE}all of it (threat and adjacency are not modeled).`),
      ...spiritSpells('alexander_the_great', 1, ['heroism', 'longstrider']),
    ]),
    entry(5, [
      active('bucephalus', 'Bucephalus', `Once per Long Rest, summon a spectral warhorse for 10 minutes: AC 14, HP 5 × your Emperor level, Speed 120.\n\n${AUTO}the once-per-Long-Rest use.\n${SUMMON_NOTE}`, { poolId: 'bucephalus' }),
      ...spiritSpells('alexander_the_great', 5, ['haste', 'phantom_steed']),
    ], [pool('bucephalus', 'Bucephalus', 1)]),
    entry(10, [
      active('war_elephant', 'War Elephant', `Once per Long Rest, summon a spectral war elephant for 10 minutes: AC 15, HP 60, Speed 40. Three weapon positions; up to three creatures operate bows (150/600, 1d8 piercing, the operator's attack modifier). It acts immediately after you; your Bonus Action commands any action other than Dodge.\n\n${AUTO}the once-per-Long-Rest use.\n${SUMMON_NOTE}`, { poolId: 'war_elephant' }),
      ...spiritSpells('alexander_the_great', 10, ['dominate_person', 'steel_wind_strike']),
    ], [pool('war_elephant', 'War Elephant', 1)]),
    entry(15, [
      active('royal_panoply', 'Royal Panoply', `Spend 10 gp and 1 hour: your AC becomes 17 (+shield if applicable) and you gain a 50-point ward that absorbs damage before your hit points. The ward refills on a Long Rest; 10 pp on a Short Rest restores 10 ward points.\n\n${AUTO}AC 17 while the Panoply is on (turn it off from the Features tab list), and the 50-point ward as a pool you spend down by hand.\n${TABLE}the gp/pp cost, and the ward absorbing damage before HP (spend it from the pool when you take damage).`, {
        actionType: 'free', flag: 'royal_panoply', effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 17, condition: 'royal_panoply' }] }),
      ...spiritSpells('alexander_the_great', 15, ['conjure_celestial']),
    ], [pool('royal_panoply_ward', 'Royal Panoply ward (points)', 50)]),
    entry(20, [
      active('conquerors_tempo', "Conqueror's Tempo", `Once per Long Rest, for 1 minute: +20 ft speed, your weapon ranges double, and you make one additional weapon attack whenever you take the Attack action.\n\n${AUTO}the use, +20 speed and +1 attack on the Attack action while active (end it from the Features tab list).\n${TABLE}doubling weapon ranges.`, {
        poolId: 'conquerors_tempo', flag: 'conquerors_tempo', effects: [add('speed', 20, 'conquerors_tempo'), add('extra_attack', 1, 'conquerors_tempo')] }),
      ...spiritSpells('alexander_the_great', 20, ['shapechange']),
    ], [pool('conquerors_tempo', "Conqueror's Tempo", 1)]),
  ],
};

// ── 6 — Odysseus ────────────────────────────────────────────────────────────
const odysseus: Spirit = {
  id: 'odysseus', name: 'Odysseus', summary: 'Cunning and guile: a wooden horse, a silver tongue, a way home.',
  entries: [
    entry(1, [
      feat('cunning', 'Cunning', `Insight and Investigation proficiency; expertise in one of them.\n\n${AUTO}both proficiencies.\n${TABLE}the expertise pick — add it from the Expertise control on the Features tab.`, { effects: [skillProf('insight'), skillProf('investigation')] }),
      ...spiritSpells('odysseus', 1, ['disguise_self', 'silent_image']),
    ]),
    entry(5, [
      active('wooden_horse', 'Wooden Horse', `Once per Long Rest, create a Large hidden structure for 8 hours holding up to eight Medium creatures. Others detect it only with Investigation/Insight against your Spirit Save DC.\n\n${AUTO}the once-per-Long-Rest use.\n${TABLE}the structure and who notices it.`, { poolId: 'wooden_horse' }),
      ...spiritSpells('odysseus', 5, ['suggestion', 'major_image']),
    ], [pool('wooden_horse', 'Wooden Horse', 1)]),
    entry(10, [
      feat('silver_tongue', 'Silver Tongue', `Animal Handling and Deception proficiency; expertise in one. Once per Long Rest, reroll one failed check with either skill.\n\n${AUTO}both proficiencies; track the reroll with "Silver Tongue reroll".\n${TABLE}the expertise pick and the reroll itself.`, { effects: [skillProf('animal_handling'), skillProf('deception')] }),
      active('silver_tongue_reroll', 'Silver Tongue reroll', `Spend your once-per-Long-Rest reroll of a failed Animal Handling or Deception check.\n\n${AUTO}the use is tracked.\n${TABLE}the reroll.`, { actionType: 'free', poolId: 'silver_tongue_reroll' }),
      ...spiritSpells('odysseus', 10, ['modify_memory', 'mislead']),
    ], [pool('silver_tongue_reroll', 'Silver Tongue reroll', 1)]),
    entry(15, [
      feat('i_will_return_home', 'I Will Return Home', `You always know the direction, distance and plane of one chosen home; you cannot become lost heading there nonmagically; and you have advantage against magic that blocks your return.\n\n${TABLE}all of it.`),
      ...spiritSpells('odysseus', 15, ['project_image']),
    ]),
    entry(20, [
      active('heroes_of_the_odyssey', 'Heroes of the Odyssey', `Once per Long Rest, summon one hero for 1 minute.\nAchilles: AC 20, HP 80, two attacks 2d10+6 slashing; vanishes if hit by a critical poison hit.\nPrometheus: 20-ft radius 10d6 fire DEX-half on arrival, then ranged 3d10 fire attacks.\nHeracles: STR 26, advantage on STR checks/saves, two attacks 2d12+8 bludgeoning, counts as Huge for lifting/pushing/breaking, attempts any ordered physical labor.\n\n${AUTO}the once-per-Long-Rest use.\n${SUMMON_NOTE}`, { poolId: 'heroes_of_the_odyssey' }),
      ...spiritSpells('odysseus', 20, ['foresight']),
    ], [pool('heroes_of_the_odyssey', 'Heroes of the Odyssey', 1)]),
  ],
};

// ── 7 — Julius Caesar ───────────────────────────────────────────────────────
const caesar: Spirit = {
  id: 'julius_caesar', name: 'Julius Caesar', summary: 'Legions and law: pilum doctrine, survival, forced march, a dictatorship.',
  entries: [
    entry(1, [
      feat('pilum_doctrine', 'Pilum Doctrine', `Javelin range becomes 60/240, and drawing a thrown weapon as part of the attack needs no separate object interaction.\n\n${TABLE}all of it (weapon ranges are not modified by the engine).`),
      ...spiritSpells('julius_caesar', 1, ['command', 'heroism']),
    ]),
    entry(5, [
      active('twenty_three_wounds', 'Twenty-Three Wounds', `Once per Long Rest, a hit that would reduce you to 0 hit points instead leaves you at 1 hit point.\n\n${AUTO}the once-per-Long-Rest use.\n${TABLE}the hit-point change itself — set your HP to 1 when you use it.`, { actionType: 'free', poolId: 'twenty_three_wounds' }),
      ...spiritSpells('julius_caesar', 5, ['sending', 'tongues']),
    ], [pool('twenty_three_wounds', 'Twenty-Three Wounds', 1)]),
    entry(10, [
      feat('caesar_forced_march', 'Forced March', `Allies who start their turn within 30 ft of you gain +10 ft speed until their next turn, and your group travels one additional hour before forced-march checks.\n\n${AUTO}+10 speed for the allies you tick on the Features tab's aura list.\n${TABLE}who is within 30 ft at the start of their turn, and the travel hour.`, {
        allyGrants: [{ id: 'march', mode: 'aura', label: 'Forced March (+10 ft speed)', rangeFeet: 30, effects: [add('speed', 10)] }] }),
      ...spiritSpells('julius_caesar', 10, ['geas', 'legend_lore']),
    ]),
    entry(15, [
      feat('codifier', 'Codifier', `History expertise and expertise in Investigation or Persuasion. After 10 minutes studying a legal or government structure, learn its hierarchy, enforcement and major procedures.\n\n${AUTO}History expertise.\n${TABLE}the second expertise pick (add it from the Expertise control) and the study.`, { effects: [skillExpertise('history')] }),
      ...spiritSpells('julius_caesar', 15, ['teleport']),
    ]),
    entry(20, [
      feat('dictator_perpetuo', 'Dictator Perpetuo', `A campaign-scale project to centralize a republic. You have advantage on coalition-building, military-loyalty, institutional-reform and public-persuasion checks, with doubled proficiency where applicable.\n\n${TABLE}the whole project — Grimoire has no campaign-project model, so this is a reminder only.`),
      ...spiritSpells('julius_caesar', 20, ['foresight']),
    ]),
  ],
};

// ── 8 — Saladin ─────────────────────────────────────────────────────────────
const saladin: Spirit = {
  id: 'saladin', name: 'Saladin', summary: 'Chivalry and wisdom: a defender\'s reaction, cavalry, charges, siegecraft.',
  entries: [
    entry(1, [
      feat('chivalric_defender', 'Chivalric Defender', `Religion and Insight proficiency. As a Reaction, a proficiency-bonus number of times per Long Rest, add your proficiency bonus to an adjacent ally's AC against one attack.\n\n${AUTO}both proficiencies; the Reaction, its pool, and the AC bonus on the ally you pick (one round).\n${TABLE}adjacency and which attack.`, {
        passive: false, effects: [skillProf('religion'), skillProf('insight')],
        activation: activation('reaction', 'chivalric_defender', { range: 'adjacent ally', target: 'single' }),
        allyGrants: [{ id: 'defend', mode: 'chosen', label: 'Chivalric Defender (+PB AC)', rangeFeet: 5, effects: [add('ac', 1)], valueFromProficiency: 'full', duration: { unit: 'rounds', remaining: 1 } }] }),
      ...spiritSpells('saladin', 1, ['protection_from_evil_and_good', 'heroism']),
    ], [pbPool('chivalric_defender', 'Chivalric Defender')]),
    entry(5, [
      feat('cavalry_commander', 'Cavalry Commander', `You and mounted allies within 30 ft gain +15 ft mounted speed.\n\n${TABLE}all of it (mounted speed is not modeled separately from speed).`),
      ...spiritSpells('saladin', 5, ['beacon_of_hope', 'aura_of_vitality']),
    ]),
    entry(10, [
      feat('decisive_charge', 'Decisive Charge', `Once per turn, after moving 20+ ft toward a target before a melee hit, deal +3d8 damage.\n\n${TABLE}all of it (movement and "once per turn" are not tracked).`),
      ...spiritSpells('saladin', 10, ['greater_restoration', 'circle_of_power']),
    ]),
    entry(15, [
      feat('siege_master', 'Siege Master', `You deal double damage to objects and structures; you and allies within 30 ft have advantage against traps, collapsing fortifications and siege weapons.\n\n${TABLE}all of it.`),
      ...spiritSpells('saladin', 15, ['holy_aura']),
    ]),
    entry(20, [
      feat('wisdom_of_the_sultan', 'Wisdom of the Sultan', `While Saladin is your active Bound Spirit your Wisdom becomes 24 if lower, and you gain Wisdom saving throw proficiency if you lack it.\n\n${AUTO}Wisdom raised to 24 (it never lowers a higher score — do not stack it on top of 24+).\n${TABLE}Wisdom saving-throw proficiency (the engine cannot grant a saving-throw proficiency from a feature).`, { effects: [setStat('wis', 24)] }),
      ...spiritSpells('saladin', 20, ['mass_heal']),
    ]),
  ],
};

// ── 9 — Montezuma ───────────────────────────────────────────────────────────
const montezuma: Spirit = {
  id: 'montezuma', name: 'Montezuma', summary: 'Jungle warlord: tracking, a warband, tribute, the avatar of a city.',
  entries: [
    entry(1, [
      feat('trail_reader', 'Trail Reader', `Survival proficiency, or expertise if you already have it; advantage following physical tracks.\n\n${AUTO}Survival proficiency/expertise.\n${TABLE}the tracking advantage.`, { effects: [skillProfOrExpertise('survival')] }),
      ...spiritSpells('montezuma', 1, ['entangle', 'hunters_mark']),
    ]),
    entry(5, [
      feat('jungle_march', 'Jungle March', `You ignore nonmagical difficult terrain, and your party does not lose overland speed due solely to ordinary vegetation.\n\n${TABLE}all of it.`),
      ...spiritSpells('montezuma', 5, ['plant_growth', 'conjure_animals']),
    ]),
    entry(10, [
      active('eagle_and_jaguar_host', 'Eagle and Jaguar Host', `Once per Long Rest, summon a warband for 1 minute: AC 14, HP 70, Speed 35, a 20-ft square; attack uses your Spirit Attack modifier, 4d8 piercing; it represents about 100 warriors as one creature.\n\n${AUTO}the once-per-Long-Rest use.\n${SUMMON_NOTE}`, { poolId: 'eagle_and_jaguar_host' }),
      ...spiritSpells('montezuma', 10, ['commune_with_nature', 'insect_plague']),
    ], [pool('eagle_and_jaguar_host', 'Eagle and Jaguar Host', 1)]),
    entry(15, [
      active('tribute', 'Tribute', `Every 7 days, receive 10% of your legitimate expenditures since the last tribute, to a maximum of 25 × your Emperor level gp. Transfers within the party do not count.\n\n${AUTO}the every-7-days use, recharged by hand.\n${TABLE}the amount — Grimoire does not track spending or a calendar.`, { poolId: 'tribute', actionType: 'free' }),
      ...spiritSpells('montezuma', 15, ['animal_shapes']),
    ], [manualPool('tribute', 'Tribute', 'every 7 days')]),
    entry(20, [
      active('avatar_of_tenochtitlan', 'Avatar of Tenochtitlan', `Once per Long Rest, for 1 minute, your ability scores rise to at least STR 22, DEX 24, CON 22, CHA 24 (Intelligence is unaffected if already below 8); they revert afterward.\n\n${AUTO}the use, and the four scores set while it is on (end it from the Features tab list).\n${TABLE}"at least" — if a score is already higher, do not take the avatar value.`, {
        poolId: 'avatar_of_tenochtitlan', flag: 'avatar_of_tenochtitlan',
        effects: [setStat('str', 22, 'avatar_of_tenochtitlan'), setStat('dex', 24, 'avatar_of_tenochtitlan'), setStat('con', 22, 'avatar_of_tenochtitlan'), setStat('cha', 24, 'avatar_of_tenochtitlan')] }),
      ...spiritSpells('montezuma', 20, ['shapechange']),
    ], [pool('avatar_of_tenochtitlan', 'Avatar of Tenochtitlan', 1)]),
  ],
};

// ── 10 — David IV the Builder ───────────────────────────────────────────────
const david: Spirit = {
  id: 'david_iv_the_builder', name: 'David IV the Builder', summary: 'Kingdom-builder: a stand at Didgori, a spear wall, two armies, four towers.',
  entries: [
    entry(1, [
      feat('royal_authority', 'Royal Authority', `Persuasion and History proficiency; expertise in one of them.\n\n${AUTO}both proficiencies.\n${TABLE}the expertise pick (add it from the Expertise control).`, { effects: [skillProf('persuasion'), skillProf('history')] }),
      ...spiritSpells('david_iv_the_builder', 1, ['shield_of_faith', 'heroism']),
    ]),
    entry(5, [
      active('didgori', 'Didgori', `Once per Long Rest, if you are outnumbered when initiative is rolled: you gain temporary hit points equal to your Emperor level, and during the first round you and allies within 30 ft gain +2 to attack rolls and saving throws.\n\n${AUTO}the use; temp HP and +2 to all saves for you and the allies you tick (one round).\n${TABLE}"outnumbered", who is within 30 ft, and the +2 to attack rolls.`, {
        actionType: 'free', poolId: 'didgori',
        allyGrants: [{ id: 'didgori', mode: 'chosen', label: 'Didgori (+2 saves, temp HP)', rangeFeet: 30, targets: 'many', tempHp: { addLevel: true },
          effects: ['str', 'dex', 'con', 'int', 'wis', 'cha'].map(a => add(`savingThrows.${a}`, 2)), duration: { unit: 'rounds', remaining: 1 },
          note: '+2 to attack rolls this round (table-resolved).' }] }),
      ...spiritSpells('david_iv_the_builder', 5, ['crusaders_mantle', 'spirit_guardians']),
    ], [pool('didgori', 'Didgori', 1)]),
    entry(10, [
      active('spear_wall', 'Spear Wall', `Once per Long Rest, create a 30 × 5 ft line of spectral spears for 2 rounds. A creature in it makes a STR save: 5d8 piercing and speed 0 for the turn on a failure; half damage and no speed reduction on a success.\n\n${AUTO}the use, the Spirit Save DC and the damage dice.\n${TABLE}who is in the line and applying the damage and speed change.`, {
        poolId: 'spear_wall', range: '30-ft line', target: 'area', save: 'str', damage: [{ dice: '5d8', type: 'piercing', half: true }] }),
      ...spiritSpells('david_iv_the_builder', 10, ['wall_of_stone', 'greater_restoration']),
    ], [pool('spear_wall', 'Spear Wall', 1)]),
    entry(15, [
      active('kartvelebi_and_khevsurebi', 'Kartvelebi and Khevsurebi', `Once per Long Rest, for 1 minute, summon two units under one command acting after you.\nKartvelebi: AC 16, HP 80, Speed 30, attack 4d10 slashing, once per summoning +3d8 radiant on a hit.\nKhevsurebi: AC 15, HP 60, Speed 35, bow 300 ft 3d8 piercing, sword 2d8 slashing, Reaction +2 AC against one attack.\n\n${AUTO}the once-per-Long-Rest use.\n${SUMMON_NOTE}`, { poolId: 'kartvelebi' }),
      ...spiritSpells('david_iv_the_builder', 15, ['temple_of_the_gods']),
    ], [pool('kartvelebi', 'Kartvelebi and Khevsurebi', 1)]),
    entry(20, [
      active('the_four_builders', 'The Four Builders', `Once per in-game year, at a controlled site, construct a permanent fortified tower or keep over 12 months. If the site is seized, work pauses; recovering it adds 6 months.\n\n${AUTO}the once-per-year use, recharged by hand.\n${TABLE}the construction itself — Grimoire has no calendar or building model.`, { poolId: 'the_four_builders', actionType: 'free' }),
      ...spiritSpells('david_iv_the_builder', 20, ['invulnerability']),
    ], [manualPool('the_four_builders', 'The Four Builders', 'once per in-game year')]),
  ],
};

// ── 11 — Sun Tzu ────────────────────────────────────────────────────────────
const sunTzu: Spirit = {
  id: 'sun_tzu', name: 'Sun Tzu', summary: 'Strategy: know the ground and the enemy, shape the battlefield.',
  entries: [
    entry(1, [
      feat('know_the_ground', 'Know the Ground', `Gain Investigation or Insight proficiency (expertise if already proficient in the chosen skill). After 1 minute observing an area, ask the DM one: most defensible position, safest retreat route, most exploitable visible terrain feature, or best ambush position.\n\n${TABLE}the skill choice and the DM question.`),
      ...spiritSpells('sun_tzu', 1, ['fog_cloud', 'silent_image']),
    ]),
    entry(5, [
      active('withdraw_before_they_know', 'Withdraw Before They Know You Were There', `When you Hide or Disengage, choose one willing ally within 30 ft who can see or hear you. It may immediately move up to half its speed without provoking opportunity attacks. Proficiency-bonus uses per Long Rest.\n\n${AUTO}the proficiency-bonus-sized pool.\n${TABLE}the movement and the ally.`, { actionType: 'free', poolId: 'withdraw_before' }),
      ...spiritSpells('sun_tzu', 5, ['pass_without_trace', 'clairvoyance']),
    ], [pbPool('withdraw_before', 'Withdraw Before They Know You Were There')]),
    entry(10, [
      feat('know_the_enemy', 'Know the Enemy', `After observing a creature for 1 minute, learn two chosen facts: its highest ability score, lowest ability score, one resistance, one immunity, one vulnerability, one save proficiency, or whether it is healthy, wounded or badly wounded relative to maximum HP. Once per creature per Long Rest.\n\n${TABLE}all of it (per-creature tracking is not modeled).`),
      ...spiritSpells('sun_tzu', 10, ['mislead', 'scrying']),
    ]),
    entry(15, [
      active('shape_the_battlefield', 'Shape the Battlefield', `Once per Long Rest, as an action, choose a point within 120 ft; for 1 minute a 30-ft-radius prepared battlefield. You and chosen allies ignore nonmagical difficult terrain, gain +10 ft movement and cannot be surprised there. Enemies treat it as difficult terrain.\n\n${AUTO}the use; +10 speed for you and the allies you tick on the Features tab's aura list (end it there).\n${TABLE}the area, difficult terrain and surprise.`, {
        poolId: 'shape_the_battlefield', flag: 'shape_the_battlefield', range: '120 feet', target: 'area',
        allyGrants: [{ id: 'battlefield', mode: 'aura', label: 'Shape the Battlefield (+10 ft)', rangeFeet: 30, includeSelf: true, activeWhileFlag: 'shape_the_battlefield', effects: [add('speed', 10)] }] }),
      ...spiritSpells('sun_tzu', 15, ['project_image']),
    ], [pool('shape_the_battlefield', 'Shape the Battlefield', 1)]),
    entry(20, [
      active('tactical_plan', 'Supreme Strategy — Tactical Plan', `Once per Long Rest, after observing the enemy or battlefield for 1 minute, for 1 minute you and allies within 60 ft cannot be surprised, have advantage on initiative, and gain advantage on the first attack roll each makes during the effect. It ends for a creature more than 60 ft away.\n\n${AUTO}the once-per-Long-Rest use.\n${TABLE}every effect (surprise, initiative advantage, range) — Grimoire tracks the use only.`, { poolId: 'tactical_plan' }),
      active('strategic_analysis', 'Supreme Strategy — Strategic Analysis', `Once per 30 in-game days, after 24 hours studying a known organized enemy, fortification, campaign or political/military position, the DM reveals one meaningful exploitable weakness in logistics, defenses, leadership, terrain, supply, morale or strategy, limited to information reasonably knowable.\n\n${AUTO}the once-per-30-days use, recharged by hand.\n${TABLE}the revelation (a DM ruling).`, { poolId: 'strategic_analysis', actionType: 'free' }),
      ...spiritSpells('sun_tzu', 20, ['foresight']),
    ], [pool('tactical_plan', 'Tactical Plan', 1), manualPool('strategic_analysis', 'Strategic Analysis', 'once per 30 in-game days')]),
  ],
};

// ── 12 — Joan of Arc ────────────────────────────────────────────────────────
const joan: Spirit = {
  id: 'joan_of_arc', name: 'Joan of Arc', summary: 'Conviction and the banner: rerolls, standards, a rally, contagious courage.',
  entries: [
    entry(1, [
      feat('voices_of_conviction', 'Voices of Conviction', `Religion and Persuasion proficiency (expertise in one if already proficient). As a Reaction, when you or an ally within 30 ft fails a saving throw against being frightened, reroll it. Proficiency-bonus uses per Long Rest.\n\n${AUTO}both proficiencies; the Reaction, its pool, and a reroll token for the creature you pick.\n${TABLE}the expertise pick and the reroll itself.`, {
        passive: false, effects: [skillProf('religion'), skillProf('persuasion')],
        activation: activation('reaction', 'voices_of_conviction', { range: '30 feet', target: 'single' }),
        allyGrants: [{ id: 'reroll', mode: 'chosen', label: 'Voices of Conviction', rangeFeet: 30, token: { text: 'Reroll the failed save against being frightened and use the new roll', uses: 1 } }] }),
      ...spiritSpells('joan_of_arc', 1, ['heroism', 'bless']),
    ], [pbPool('voices_of_conviction', 'Voices of Conviction')]),
    entry(5, [
      active('raise_the_standard', 'Raise the Standard', `Once per Long Rest, as a Bonus Action, raise a spectral standard for 1 minute. On appearance, you and chosen allies within 30 ft gain temporary hit points equal to your Charisma modifier. While within 30 ft, affected creatures gain +1 AC and advantage on saves against being frightened.\n\n${AUTO}the use; temp HP and +1 AC for you and the allies you tick (dismiss it after the minute).\n${TABLE}"while within 30 ft" (a creature that leaves should dismiss it) and the frightened-save advantage.`, {
        actionType: 'bonus_action', poolId: 'raise_the_standard',
        allyGrants: [{ id: 'standard', mode: 'chosen', label: 'Raise the Standard', rangeFeet: 30, targets: 'many', tempHp: { addAbilityMod: 'cha' }, effects: [add('ac', 1)],
          duration: { unit: 'minutes', remaining: 1 }, note: 'Advantage on saves against being frightened (table-resolved).' }] }),
      ...spiritSpells('joan_of_arc', 5, ['beacon_of_hope', 'crusaders_mantle']),
    ], [pool('raise_the_standard', 'Raise the Standard', 1)]),
    entry(10, [
      active('rally_the_fallen', 'Rally the Fallen', `Once per Long Rest, as a Reaction when a creature within 60 ft would hit 0 hit points: it instead drops to 1 hit point and may move up to half its speed without provoking opportunity attacks.\n\n${AUTO}the Reaction and its once-per-Long-Rest pool.\n${TABLE}the drop to 1 HP and the movement.`, { actionType: 'reaction', poolId: 'rally_the_fallen', range: '60 feet', target: 'single' }),
      ...spiritSpells('joan_of_arc', 10, ['circle_of_power', 'greater_restoration']),
    ], [pool('rally_the_fallen', 'Rally the Fallen', 1)]),
    entry(15, [
      active('courage_is_contagious', 'Courage Is Contagious', `When you take damage from a hostile creature, choose one ally within 30 ft. It gains temporary hit points equal to your Charisma modifier plus your proficiency bonus. A creature can receive this from the feature only once per round.\n\n${AUTO}the temp HP for the ally you pick.\n${TABLE}"once per round per creature" and the trigger.`, {
        actionType: 'free', range: '30 feet', target: 'single',
        allyGrants: [{ id: 'courage', mode: 'chosen', label: 'Courage Is Contagious', rangeFeet: 30, tempHp: { addAbilityMod: 'cha', addProficiency: true } }] }),
      ...spiritSpells('joan_of_arc', 15, ['holy_aura']),
    ]),
    entry(20, [
      active('banner_of_orleans', 'Banner of Orléans', `Once per Long Rest, as an action, raise a legendary standard for 1 minute. Chosen allies within 60 ft are immune to being frightened, gain +2 AC and +10 ft speed, and have advantage on death saving throws. On appearance, each may move up to half speed without provoking opportunity attacks. At the start of an affected ally's turn, if it is below half its hit points, it gains temporary hit points equal to your Charisma modifier.\n\n${AUTO}the use; frightened immunity, +2 AC and +10 speed for you and the allies you tick (dismiss it after the minute).\n${TABLE}who is within 60 ft, the death-save advantage, the movement and the start-of-turn temporary hit points.`, {
        poolId: 'banner_of_orleans',
        allyGrants: [{ id: 'banner', mode: 'chosen', label: 'Banner of Orléans', rangeFeet: 60, targets: 'many',
          effects: [{ type: 'condition_immunity', target: 'frightened', operation: 'immunity', value: null, condition: null }, add('ac', 2), add('speed', 10)],
          duration: { unit: 'minutes', remaining: 1 }, note: 'Advantage on death saves; start-of-turn temp HP = CHA mod when below half HP (table-resolved).' }] }),
      ...spiritSpells('joan_of_arc', 20, ['mass_heal']),
    ], [pool('banner_of_orleans', 'Banner of Orléans', 1)]),
  ],
};

const SPIRITS: Spirit[] = [genghis, stalin, hannibal, napoleon, alexander, odysseus, caesar, saladin, montezuma, david, sunTzu, joan];

/** The twelve options, in d12 order (1 Genghis Khan … 12 Joan of Arc). */
export const BOUND_SPIRIT_OPTIONS: ModeOption[] = SPIRITS.map(s => ({ id: s.id, name: s.name, summary: s.summary, entries: s.entries }));

