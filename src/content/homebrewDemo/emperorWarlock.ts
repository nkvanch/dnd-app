// src/content/homebrewDemo/emperorWarlock.ts
// The Emperor Warlock — playtest / demo-pack class
// (docs/homebrew/EMPEROR_WARLOCK_DEMO.md, the authoritative spec).
//
// Built ON the engine primitives, not around them:
//  - Legacy Binding   → a mode group (the d12 table, Council of Spirits re-roll,
//                        Two Voices, Crown of Legends are selector configuration).
//  - Bound Spirits     → the twelve ModeOptions in boundSpirits.ts (never "Subclass").
//  - Imperial Command  → Command Dice pool (= proficiency bonus) + a chosen ally grant.
//  - Imperial Edicts   → a swappable feature_pool choice (2 at L2, +1 at 6/10/14/17).
//  - Pact Magic        → CharClass.spellcastingStyle 'pact' + the class's own pactSlotTable.
//  - Legacy Arcanum    → arcanum spell choices backed by once-per-Long-Rest pools.
//
// A single CharClass object carries everything, so the whole pack — class,
// twelve spirits, seventeen edicts — exports and imports as one unit.
import type { CharClass, ClassProgression, LevelEntry, Grant, ChoiceDefinition, ChoiceOption, ModeGroup, SpellSlotRow, Feature } from '../../engine/types';
import { BOUND_SPIRIT_OPTIONS } from './boundSpirits';
import {
  CLASS_ID, SRC, AUTO, TABLE, feat, pool, pbPool, add, skillProfOrExpertise, activation, asiChoice, spellChoice,
} from './helpers';

// ── Pact Magic ──────────────────────────────────────────────────────────────
// The spec says "Warlock-style Pact Magic: few same-level slots, Short/Long Rest
// recovery" and gives no table, so this is the Warlock's own slot progression,
// written out as the class's OWN table (not a lookup by class id).
const row = (level: number, count: number, tier: 1 | 2 | 3 | 4 | 5): SpellSlotRow => {
  const slots = [0, 0, 0, 0, 0, 0, 0, 0, 0] as SpellSlotRow['slots'];
  slots[tier - 1] = count;
  return { level, slots };
};
export const EMPEROR_PACT_SLOTS: SpellSlotRow[] = [
  row(1, 1, 1), row(2, 2, 1), row(3, 2, 2), row(4, 2, 2), row(5, 2, 3), row(6, 2, 3), row(7, 2, 4), row(8, 2, 4), row(9, 2, 5), row(10, 2, 5),
  row(11, 3, 5), row(12, 3, 5), row(13, 3, 5), row(14, 3, 5), row(15, 3, 5), row(16, 3, 5), row(17, 4, 5), row(18, 4, 5), row(19, 4, 5), row(20, 4, 5),
];

// ── Legacy Binding (the mode group) ─────────────────────────────────────────
export const LEGACY_BINDING: ModeGroup = {
  id: 'legacy_binding', name: 'Legacy Binding', optionLabel: 'Bound Spirit', scope: 'self',
  levelSource: { kind: 'class', classId: CLASS_ID }, requireActiveOption: true,
  options: BOUND_SPIRIT_OPTIONS,
  selector: {
    kind: 'table', die: 12, periodLabel: 'in-game month',
    reroll: { level: 3, perPeriod: 1 },                 // Council of Spirits
    pickBest: [{ level: 11, rolls: 2 }],                // Two Voices
    freeChoiceFromLevel: 20,                            // Crown of Legends
  },
};

// ── Imperial Command ────────────────────────────────────────────────────────
const COMMAND_USE = 'one attack roll, ability check, saving throw or weapon damage roll within the next minute (consumed when used)';
const imperialCommand: Feature = feat('imperial_command', 'Imperial Command',
  `You have Command Dice equal to your proficiency bonus. As a Bonus Action, choose yourself or one creature within 60 ft that can see or hear you and grant it one Command Die. Within the next minute it can roll that die and add it to one attack roll, ability check, saving throw or weapon damage roll; the die is consumed when used. Expended dice return on a Long Rest. Die size: d6 at levels 1–8, d8 at 9–16, d10 at 17–20.\n\n${AUTO}the pool (= proficiency bonus), the die size by level, the Bonus Action, handing the die to yourself or another character on this device, and spending it from their Features tab.\n${TABLE}who can see or hear you, the 60 ft range, and adding the roll to the right d20 or damage.`, {
    passive: false,
    activation: activation('bonus_action', 'command_dice', { range: '60 feet', target: 'single' }),
    allyGrants: [{
      id: 'command_die', mode: 'chosen', label: 'Command Die', rangeFeet: 60,
      rangeWithFeature: [{ featureId: 'edict_commander_of_many', feet: 120 }],
      die: { size: 'd6', sizeByLevel: [{ level: 9, size: 'd8' }, { level: 17, size: 'd10' }], usableOn: COMMAND_USE },
      duration: { unit: 'minutes', remaining: 1 },
    }],
  });
const COMMAND_DICE = pool('command_dice', 'Command Dice', 2, 'long_rest', {
  scalesWith: 'proficiency', shortRestIfEmpty: { amount: 1, minLevel: 13 },
});

// ── Imperial Edicts ─────────────────────────────────────────────────────────
type EdictDef = { id: string; name: string; text: string; build?: (f: Feature) => Feature; resources?: ChoiceOption['resources'] };
const e = (id: string, name: string, text: string, extra: Partial<Feature> = {}, resources?: ChoiceOption['resources']): { feature: Feature; resources?: ChoiceOption['resources'] } =>
  ({ feature: feat(`edict_${id}`, name, text, extra), resources });

const EDICTS: { feature: Feature; resources?: ChoiceOption['resources'] }[] = [
  e('scholar_of_empires', 'Scholar of Empires', `Gain History proficiency. If you are already proficient, gain expertise.\n\n${AUTO}exactly that (the engine checks your other sources).`, { effects: [skillProfOrExpertise('history')] }),
  e('voice_of_authority', 'Voice of Authority', `Gain Persuasion proficiency. If you are already proficient, gain expertise.\n\n${AUTO}exactly that.`, { effects: [skillProfOrExpertise('persuasion')] }),
  e('battlefield_observer', 'Battlefield Observer', `Add your Charisma modifier to initiative rolls.\n\n${AUTO}the bonus follows your Charisma modifier.`, {
    allyGrants: [{ id: 'initiative', mode: 'aura', label: 'Battlefield Observer', selfOnly: true, valueFromAbilityMod: { ability: 'cha' }, effects: [add('initiative', 0)] }] }),
  e('iron_discipline', 'Iron Discipline', `You have advantage on saving throws against being frightened.\n\n${TABLE}the advantage (the engine does not model save-type advantage) — this is a reminder.`),
  e('mounted_commander', 'Mounted Commander', `Gain Animal Handling proficiency, or expertise if already proficient. You have advantage on Animal Handling checks made to control, calm, direct, or remain in control of a mount.\n\n${AUTO}the proficiency/expertise.\n${TABLE}the mount-control advantage.`, { effects: [skillProfOrExpertise('animal_handling')] }),
  e('tactical_withdrawal', 'Tactical Withdrawal', `As a Bonus Action, take the Disengage action. Uses equal to your proficiency bonus per Long Rest.\n\n${AUTO}the Bonus Action and the proficiency-bonus-sized pool.\n${TABLE}the Disengage movement itself.`, {
    passive: false, activation: activation('bonus_action', 'edict_tactical_withdrawal') }, [pbPool('edict_tactical_withdrawal', 'Tactical Withdrawal')]),
  e('rally', 'Rally', `When you would grant a creature a Command Die using Imperial Command, you may instead expend that die to grant temporary hit points equal to one roll of your Command Die + your Charisma modifier.\n\n${AUTO}spending the die and the temporary hit points (rolled with your current Command Die size) for the creature you pick.`, {
    passive: false, activation: activation('bonus_action', 'command_dice', { range: '60 feet', target: 'single' }),
    allyGrants: [{ id: 'rally', mode: 'chosen', label: 'Rally', rangeFeet: 60, rangeWithFeature: [{ featureId: 'edict_commander_of_many', feet: 120 }],
      tempHp: { dice: '1d6', diceSizeByLevel: [{ level: 9, size: 'd8' }, { level: 17, size: 'd10' }], addAbilityMod: 'cha' } }] }),
  e('unbroken_line', 'Unbroken Line', `While you are not incapacitated, every ally within 5 feet of you gains +1 AC.\n\n${AUTO}+1 AC for the allies you tick on the Features tab's aura list, switching off while you are incapacitated.\n${TABLE}who is within 5 feet.`, {
    allyGrants: [{ id: 'line', mode: 'aura', label: 'Unbroken Line (+1 AC)', rangeFeet: 5, effects: [add('ac', 1)] }] }),
  e('forced_march', 'Forced March', `While traveling with you, your group can travel for one additional hour each day before normal forced-march consequences begin.\n\n${TABLE}all of it.`),
  e('commander_of_many', 'Commander of Many', `Imperial Command range increases from 60 ft to 120 ft.\n\n${AUTO}the printed range on Imperial Command and Rally becomes 120 ft.\n${TABLE}whether a creature is actually within it.`),
  e('historian', 'Historian', `After at least 10 minutes observing and investigating a settlement, ruin, fortress, battlefield, seat of government or similarly important location, ask the DM for a concise account of its approximate military or political history. The answer reflects what could reasonably be inferred from evidence and common knowledge.\n\n${TABLE}all of it (a DM ruling).`),
  e('unshaken', 'Unshaken', `When you fail a Wisdom or Charisma saving throw, reroll it and use the new result. Once per Long Rest. This does not inherently consume your Reaction.\n\n${AUTO}the once-per-Long-Rest use is tracked.\n${TABLE}the reroll.`, {
    passive: false, activation: activation('free', 'edict_unshaken') }, [pool('edict_unshaken', 'Unshaken', 1)]),
  e('imperial_blast', 'Imperial Blast', `When you hit with Eldritch Blast, add your Charisma modifier to the damage of that beam.\n\n${TABLE}the extra damage (the engine cannot yet modify one spell's damage).`),
  e('commanding_repulsion', 'Commanding Repulsion', `Once on each of your turns when Eldritch Blast hits a creature, you may push that creature up to 10 ft directly away from you.\n\n${TABLE}the push (forced-movement paths are not modeled).`),
  e('suppressing_fire', 'Suppressing Fire', `When you damage a creature with Eldritch Blast, its speed is reduced by 10 ft until the start of your next turn. Multiple beams against the same target do not stack the reduction.\n\n${TABLE}the speed reduction on the target.`),
  e('long_range_artillery', 'Long-Range Artillery', `Eldritch Blast range becomes 300 ft.\n\n${TABLE}the range increase (the engine cannot yet modify one spell's range).`),
  e('mark_of_the_emperor', 'Mark of the Emperor', `Once on each of your turns when you hit a creature with Eldritch Blast, mark it until the start of your next turn. The next ally other than you to make an attack roll against the marked creature gains one free Command Die for that attack roll. The die does not expend your pool and is consumed on use.\n\n${AUTO}handing the free Command Die (current size) to the ally you pick, without touching your pool.\n${TABLE}the mark, "next ally to attack it", and the once-per-turn limit.`, {
    passive: false, activation: activation('free', null, { range: '120 feet', target: 'single' }),
    allyGrants: [{ id: 'mark', mode: 'chosen', label: 'Mark of the Emperor (free Command Die)', rangeFeet: 120,
      die: { size: 'd6', sizeByLevel: [{ level: 9, size: 'd8' }, { level: 17, size: 'd10' }], usableOn: 'the attack roll against the marked creature' }, duration: { unit: 'rounds', remaining: 1 } }] }),
];

export const EDICT_OPTIONS: ChoiceOption[] = EDICTS.map(({ feature, resources }) => ({
  id: feature.id.replace(/^edict_/, ''), label: feature.name, value: feature, ...(resources ? { resources } : {}),
}));

const edictChoice = (level: number, count: number): ChoiceDefinition => ({
  id: `imperial_edicts_${level}`, kind: 'feature_pool', count, pool: EDICT_OPTIONS, grants: [], required: true, resolved: false,
  prompt: count > 1 ? `Learn ${count} Imperial Edicts.` : 'Learn 1 Imperial Edict.',
  swappable: { group: 'imperial_edicts', perLevel: 1 },
});

// ── Progression ─────────────────────────────────────────────────────────────
const CLASS_SKILLS = ['animal_handling', 'history', 'insight', 'intimidation', 'investigation', 'persuasion', 'religion', 'survival'];
const label = (s: string) => s.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
const skillChoice: ChoiceDefinition = {
  id: 'emperor_skills_lvl_1', prompt: `Choose 2 skills from: ${CLASS_SKILLS.map(label).join(', ')}.`, kind: 'skill', count: 2,
  pool: CLASS_SKILLS.map(s => ({ id: s, label: label(s), value: s })), grants: [], required: true, resolved: false,
};
const expertiseChoice = (id: string): ChoiceDefinition => ({
  id, prompt: 'Choose expertise in History or one Emperor Warlock class skill you are proficient in.', kind: 'expertise', count: 1, pool: 'all', grants: [], required: true, resolved: false,
});

// Spells known / cantrips: the spec is silent, so the Warlock's own counts are used.
const SPELLS_KNOWN_GAINED: Record<number, number> = { 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 11: 1, 13: 1, 15: 1, 17: 1, 19: 1 };
const CANTRIPS_GAINED: Record<number, number> = { 1: 2, 4: 1, 10: 1 };
const ARCANUM_LEVELS: Record<number, number> = { 11: 6, 13: 7, 15: 8, 17: 9 };
const EDICT_LEVELS: Record<number, number> = { 2: 2, 6: 1, 10: 1, 14: 1, 17: 1 };

function levelEntry(level: number): LevelEntry {
  const grants: Grant[] = [];
  const choices: ChoiceDefinition[] = [];
  const f = (feature: Feature) => grants.push({ kind: 'feature', value: { ...feature, level } });

  // Pact Magic: every level re-states the slot row from the class's own table.
  grants.push({ kind: 'spell_slots', value: { level, slotsTable: EMPEROR_PACT_SLOTS } });

  if (level === 1) {
    choices.push(skillChoice);
    grants.push({ kind: 'proficiency', value: { armor: ['light'], weapons: ['simple'] } });
    f(feat('legacy_binding', 'Legacy Binding',
      `At the start of every in-game month, roll a d12 to learn which Bound Spirit answers. You keep that spirit until the next month and gain every feature of it for which you meet the level requirement; when the spirit changes, the old spirit's abilities and spells disappear and the new spirit's replace them.\n\n${AUTO}the d12 roll (or enter the die you rolled at the table), switching spirits in one step, level-gated spirit features and spirit-granted spells, and spent pools staying spent when you leave a spirit and return.\n${TABLE}when a month passes — there is no calendar; press "New in-game month" on the Features tab.`,
      { modeGroup: LEGACY_BINDING, sourceLabel: 'Bound Spirit' }));
    f(imperialCommand);
    grants.push({ kind: 'resource', value: COMMAND_DICE });
    f(feat('pact_magic', 'Pact Magic', `Charisma-based spellcasting. Spirit Save DC = 8 + proficiency bonus + Charisma modifier; Spirit Attack = proficiency bonus + Charisma modifier. You have a few spell slots, all of one level, which return on a Short or Long Rest. Eldritch Blast is known automatically.\n\n${AUTO}the slots, their recharge, the DC and attack modifier.`));
    grants.push({ kind: 'init_spellcasting', value: { ability: 'cha', pact: true } });
    grants.push({ kind: 'known_spells', value: { cantripIds: ['eldritch_blast'] } });
    f(feat('martial_weapon_training', 'Martial Weapon Training', `You are proficient with simple weapons and one martial weapon of your choice.\n\n${AUTO}simple weapons.\n${TABLE}your one martial weapon — add it from the Features tab (+ Custom Feature).`));
  }
  if (level === 2) f(feat('imperial_edicts', 'Imperial Edicts', `Learn 2 Edicts at level 2, then one more at levels 6, 10, 14 and 17 (six at level 20). Whenever you gain an Emperor Warlock level you may replace one Edict you know with another (Features tab → Edicts).`));
  if (EDICT_LEVELS[level]) choices.push(edictChoice(level, EDICT_LEVELS[level]));
  if (level === 3) {
    f(feat('council_of_spirits', 'Council of Spirits', `Once per in-game month, after rolling for Legacy Binding, you may reject the result and roll again; you must keep the second result. Also gain expertise in History or one Emperor Warlock class skill in which you are proficient.\n\n${AUTO}one re-roll each month (refilled when you press "New in-game month") and the expertise pick.`));
    choices.push(expertiseChoice('emperor_expertise_3'));
  }
  if (level === 5) f(feat('extra_attack_emperor', 'Extra Attack', 'You can attack twice when you take the Attack action.', { effects: [add('extra_attack', 1)] }));
  if (level === 7) f(feat('commanding_presence', 'Commanding Presence', `You and allies within 10 ft have advantage on saving throws against being frightened. At level 18 the radius becomes 30 ft.\n\n${AUTO}the aura checklist (shows 10 ft, then 30 ft from level 18) and a reminder on each ticked ally.\n${TABLE}the advantage itself and who is within range.`, {
    allyGrants: [{ id: 'presence', mode: 'aura', label: 'Commanding Presence', rangeFeet: 10, rangeByLevel: [{ level: 18, feet: 30 }], includeSelf: true, note: 'Advantage on saving throws against being frightened (table-resolved).' }] }));
  if (level === 9) f(feat('improved_command', 'Improved Command', 'Your Command Die becomes a d8.', {}));
  if (level === 11) f(feat('two_voices', 'Two Voices', `When the month changes, roll two d12s and choose which spirit answers. Council of Spirits can reroll one of those dice.\n\n${AUTO}two dice, your pick, and re-rolling one of them.`));
  if (level === 13) f(feat('tireless_command', 'Tireless Command', `When you finish a Short Rest with no Command Dice remaining, regain one Command Die.\n\n${AUTO}exactly that.`));
  if (level === 17) f(feat('greater_command', 'Greater Command', 'Your Command Die becomes a d10.'));
  if (level === 18) f(feat('greater_presence', 'Greater Presence', 'The radius of Commanding Presence becomes 30 ft.'));
  if (level === 20) f(feat('crown_of_legends', 'Crown of Legends', `No more random rolls unless you want them. Choose any of the twelve spirits each month and unlock that spirit's level-20 feature.\n\n${AUTO}free choice of any spirit (the roll stays available).`));

  if (ARCANUM_LEVELS[level]) {
    const sl = ARCANUM_LEVELS[level];
    const rid = `legacy_arcanum_${sl}`;
    f(feat(`legacy_arcanum_${sl}`, `Legacy Arcanum (${sl}th level)`, `Learn one ${sl}th-level warlock spell. Cast it once without a spell slot; the use returns on a Long Rest. (Spirit-granted spells of this level use the same once-per-Long-Rest use.)\n\n${AUTO}the pick, the pool and casting from it.`));
    grants.push({ kind: 'resource', value: pool(rid, `Legacy Arcanum (${sl}th)`, 1) });
    choices.push({ ...spellChoice(`emperor_arcanum_${sl}`, 1, `Choose your ${sl}th-level Legacy Arcanum spell.`), arcanum: { spellLevel: sl, resourceId: rid } });
  }
  if (CANTRIPS_GAINED[level]) choices.push(spellChoice(`emperor_cantrips_${level}`, CANTRIPS_GAINED[level], `Choose ${CANTRIPS_GAINED[level]} warlock cantrip${CANTRIPS_GAINED[level] > 1 ? 's' : ''}.`));
  if (SPELLS_KNOWN_GAINED[level]) choices.push(spellChoice(`emperor_spells_${level}`, SPELLS_KNOWN_GAINED[level], `Choose ${SPELLS_KNOWN_GAINED[level]} warlock spell${SPELLS_KNOWN_GAINED[level] > 1 ? 's' : ''} known.`));
  if ([4, 8, 12, 16, 19].includes(level)) choices.push(asiChoice(`emperor_asi_${level}`));
  return { level, hpDie: 8, grants, choices };
}
export const emperorWarlockProgression: ClassProgression = {
  classId: CLASS_ID,
  entries: Array.from({ length: 20 }, (_, i) => levelEntry(i + 1)),
};

export const EMPEROR_WARLOCK: CharClass = {
  id: CLASS_ID, name: 'Emperor Warlock', hitDie: 8, features: [],
  description: 'A battlefield commander whose power comes from the memories, ambitions, tactics, legends and magical echoes of great historical or mythological figures. (Playtest / demo-pack class.)',
  savingThrows: ['wis', 'cha'], armorProfs: ['light'], weaponProfs: ['simple'],
  spellcastingAbility: 'cha', spellcastingStyle: 'pact', pactSlotTable: EMPEROR_PACT_SLOTS, spellListClassId: 'warlock',
  subclassLabel: 'Bound Spirit',
  rawProgression: emperorWarlockProgression,
};

/** Everything the pack contains, for the Homebrew hub's "install" action and for tests. */
export const EMPEROR_PACK = { classes: [EMPEROR_WARLOCK] };
export { SRC as EMPEROR_SOURCE };
