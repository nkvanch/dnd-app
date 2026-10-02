// ============================================================================
// FILE: src/content/classes/emperorWarlock/progression.ts
// The Emperor Warlock's base class progression (levels 1-20), built once and parameterized for the
// two versions the design defines:
//   'demo' - the Bound Spirit is chosen ONCE at level 1 (subclass machinery, labelled "Bound Spirit").
//   'true' - Legacy Binding is real: the spirit is replaced every in-game month through a Mode Group,
//            with Council of Spirits, Two Voices and Crown of Legends as the selector's rules.
//
// Spec gaps filled by mirroring the standard Warlock (stated, not hidden): the spec says only
// "Warlock-style Pact Magic", so the slot table is the Warlock's and spells/cantrips known follow
// the Warlock's schedule. The one martial weapon of choice is a proficiency pick.
// ============================================================================
import {
  ChoiceDefinition, ChoiceOption, ClassProgression, Feature, Grant, LevelEntry, ModeGroup, ResourceGrant,
} from '../../../engine/types';
import { feature, activation, adv, stat } from '../../homebrewPack/helpers';
import { edictPool } from './edicts';
import { LEGACY_ARCANUM } from './spellData';
import { SPIRIT_TABLE_ORDER, spiritId } from './spirits';

export type EmperorVariant = 'demo' | 'true';

const SKILLS = ['animal_handling', 'history', 'insight', 'intimidation', 'investigation', 'persuasion', 'religion', 'survival'];
const label = (s: string) => s.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

const MARTIAL_WEAPONS = ['battleaxe', 'flail', 'glaive', 'greataxe', 'greatsword', 'halberd', 'lance', 'longsword', 'maul', 'morningstar',
  'pike', 'rapier', 'scimitar', 'shortsword', 'trident', 'war_pick', 'warhammer', 'whip', 'blowgun', 'hand_crossbow', 'heavy_crossbow', 'longbow', 'net'];

function asi(id: string): ChoiceDefinition {
  return { id, prompt: 'Choose an Ability Score Increase (+2 to one or +1 to two) or a Feat.', kind: 'asi', count: 1, pool: 'all', grants: [], required: true, resolved: false };
}
function spells(id: string, count: number, prompt: string): ChoiceDefinition {
  return { id, prompt, kind: 'spell', count, pool: 'all', grants: [], required: true, resolved: false };
}
function equip(id: string, prompt: string, options: { id: string; label: string; items: string[]; itemFilter?: ChoiceOption['itemFilter'] }[]): ChoiceDefinition {
  const hasFilter = options.some(o => o.itemFilter);
  return {
    id, prompt, kind: 'equipment', count: 1,
    pool: options.map(o => ({ id: o.id, label: o.label, value: o.items, itemFilter: o.itemFilter })),
    grants: [], required: true, resolved: false,
    ...(hasFilter ? { equipmentStyle: 'exact_options' as const, equipmentGroup: 'Weapons' } : {}),
  };
}

/** Spells known by class level (the Warlock schedule); cantrips known 2 / 3 at 4 / 4 at 10. */
const SPELLS_KNOWN = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15];

export function buildEmperorProgression(classId: string, variant: EmperorVariant): ClassProgression {
  const cls = { kind: 'class' as const, refId: classId };
  const f = (id: string, name: string, level: number, description: string, extra: Partial<Parameters<typeof feature>[0]> = {}): Grant =>
    ({ kind: 'feature', value: feature({ id, name, description, level, source: cls, ...extra }) });
  const isTrue = variant === 'true';
  const commandFeature = (name: string, level: number, die: string, upgradeOf?: string) => f('imperial_command', name, level,
    'You have Command Dice equal to your proficiency bonus. As a Bonus Action, give yourself or a creature within 60 feet that can see or hear you one Command Die; within the next minute it can add the die to one attack roll, ability check, saving throw, or weapon damage roll, and the die is consumed on use. All expended Command Dice return on a Long Rest. ' +
    `Your Command Die is a ${die}.`,
    { activation: activation('bonus_action', { resource: 'command_dice', range: '60 feet', target: 'single' }), tags: ['buff'], upgradeOf });

  const skillChoice: ChoiceDefinition = {
    id: `${classId}_skills_lvl_1`,
    prompt: 'Choose 2 skills from: Animal Handling, History, Insight, Intimidation, Investigation, Persuasion, Religion, Survival.',
    kind: 'skill', count: 2, pool: SKILLS.map(s => ({ id: s, label: label(s), value: s })),
    grants: [], required: true, resolved: false,
  };
  const martialPick: ChoiceDefinition = {
    id: `${classId}_martial_weapon`, prompt: 'Choose one martial weapon you are proficient with.', kind: 'feature_pool', count: 1,
    grants: [], required: true, resolved: false,
    pool: MARTIAL_WEAPONS.map(w => ({
      id: `martial_${w}`, label: label(w),
      value: feature({ id: `${classId}_prof_${w}`, name: `Weapon Proficiency: ${label(w)}`, description: `You are proficient with the ${label(w).toLowerCase()}.`, source: cls,
        effects: [{ type: 'grant_proficiency', target: `weapon:${w}`, operation: 'add', value: null, condition: null }] }),
    })),
  };
  const spiritChoice: ChoiceDefinition = {
    id: `${classId}_bound_spirit_choice`,
    prompt: isTrue
      ? 'Choose your first Bound Spirit. (Your first d12 result decides it; later, a new spirit answers every in-game month.)'
      : 'Choose your Bound Spirit.',
    kind: 'subclass', count: 1, pool: 'all', grants: [], required: true, resolved: false, subclassLabel: 'Bound Spirit',
  };
  const edictChoice = (id: string, count: number, prompt: string): ChoiceDefinition =>
    ({ id, prompt, kind: 'feature_pool', count, pool: edictPool(classId), grants: [], required: true, resolved: false });
  const expertiseChoice: ChoiceDefinition = {
    id: `${classId}_historical_expertise`,
    prompt: 'Historical Expertise: choose History or another Emperor Warlock class skill you are proficient in for expertise.',
    kind: 'expertise', count: 1, grants: [], required: true, resolved: false,
    pool: SKILLS.map(s => ({ id: s, label: label(s), value: s })),
  };
  const arcanumChoice = (a: typeof LEGACY_ARCANUM[number]): ChoiceDefinition => ({
    id: `${classId}_legacy_arcanum_${a.spellLevel}`,
    prompt: `Legacy Arcanum: choose one ${a.spellLevel}th-level spell (castable once per Long Rest). Favorites are marked with a star.`,
    kind: 'feature_pool', count: 1, grants: [], required: true, resolved: false,
    pool: a.spells.map(spell => ({
      id: `arcanum_${a.spellLevel}_${spell}`,
      label: `${a.favorites.includes(spell) ? '★ ' : ''}${label(spell)}`,
      value: feature({
        id: `${classId}_arcanum_${a.spellLevel}_${spell}`, name: `Legacy Arcanum: ${label(spell)}`,
        description: `Cast ${label(spell)} (${a.spellLevel}th level) without a spell slot, once per Long Rest.`,
        source: cls, level: a.level,
        activation: activation('action', { resource: `legacy_arcanum_${a.spellLevel}`, range: 'varies', target: 'single' }),
        abilityEffects: [{ type: 'cast_spell', spellId: spell }],
      }),
    })),
  });
  const arcanumResource = (a: typeof LEGACY_ARCANUM[number]): ResourceGrant =>
    ({ resourceId: `legacy_arcanum_${a.spellLevel}`, name: `Legacy Arcanum (${a.spellLevel}th level)`, maximum: 1, recharge: 'long_rest' });

  const entries: LevelEntry[] = [];
  const spellChoicesFor = (level: number): ChoiceDefinition[] => {
    const out: ChoiceDefinition[] = [];
    const gain = SPELLS_KNOWN[level] - SPELLS_KNOWN[level - 1];
    if (gain > 0 && level < 20) out.push(spells(`${classId}_spells_${level}`, gain, level === 1 ? 'Choose 2 Emperor Warlock spells known.' : `Choose ${gain} more Emperor Warlock spell known.`));
    if (level === 1) out.push(spells(`${classId}_cantrips_1`, 2, 'Choose 2 Emperor Warlock cantrips (Eldritch Blast is already known).'));
    if (level === 4 || level === 10) out.push(spells(`${classId}_cantrips_${level}`, 1, 'Choose 1 more Emperor Warlock cantrip.'));
    return out;
  };
  const add = (level: number, grants: Grant[] = [], choices: ChoiceDefinition[] = []) => {
    // spell_slots must follow init_spellcasting (same entry at level 1), so it goes last.
    entries.push({ level, hpDie: 8, grants: [...grants, { kind: 'spell_slots', value: { level } }], choices: [...spellChoicesFor(level), ...choices] });
  };

  // 1
  add(1, [
    { kind: 'proficiency', value: { armor: ['light'], weapons: ['simple'] } },
    f('legacy_binding', 'Legacy Binding', 1, isTrue
      ? 'At the start of every in-game month, roll a d12 and enter the result: that Bound Spirit answers for the month (1 Genghis Khan, 2 Stalin, 3 Hannibal, 4 Napoleon, 5 Alexander the Great, 6 Odysseus, 7 Julius Caesar, 8 Saladin, 9 Montezuma, 10 David IV the Builder, 11 Sun Tzu, 12 Joan of Arc). You gain every feature of that spirit you meet the level for; when the spirit changes, the old spirit\'s abilities disappear and the new spirit\'s replace them, and each spirit remembers its own spent resources. Use the Legacy Binding panel on the Features tab to change spirit. (The app never rolls for you and has no calendar.)'
      : 'You are bound to one Bound Spirit, chosen at level 1. (In the full class a new spirit answers every in-game month; this demo version keeps one.)'),
    commandFeature('Imperial Command', 1, 'd6 (a d8 from level 9, a d10 from level 17)'),
    f('spirit_pact_magic', 'Spirit Pact Magic', 1,
      'Charisma is your spellcasting ability: spell save DC 8 + proficiency bonus + Charisma modifier, spell attack modifier proficiency bonus + Charisma modifier. You have a few spell slots, all of the same level, that return on a Short or Long Rest. You know Eldritch Blast, and the spells your Bound Spirit grants are known only while it is bound and do not count against your spells known. Spells of 6th level and higher come from Legacy Arcanum.'),
    { kind: 'resource', value: { resourceId: 'command_dice', name: 'Command Dice', maximum: 2, recharge: 'long_rest', perProficiencyBonus: true } as ResourceGrant },
    { kind: 'init_spellcasting', value: { ability: 'cha' } },
    { kind: 'known_spells', value: { cantripIds: ['eldritch_blast'] } },
  ], [skillChoice, martialPick,
    equip(`${classId}_equip_a`, 'Choose: (a) a light crossbow and 20 bolts or (b) any simple weapon', [
      { id: 'crossbow', label: 'Light Crossbow & 20 bolts', items: ['light_crossbow', 'bolts_20'] },
      { id: 'simple', label: 'A simple weapon', items: [], itemFilter: { constraint: { category: 'weapon', weaponClass: 'simple' }, quantity: 1 } },
    ]),
    equip(`${classId}_equip_b`, 'Choose a focus: (a) a component pouch or (b) an arcane focus', [
      { id: 'pouch', label: 'Component Pouch', items: ['component_pouch'] },
      { id: 'focus', label: 'Arcane Focus', items: ['arcane_focus_orb'] },
    ]),
    equip(`${classId}_equip_c`, "Choose a pack: (a) scholar's or (b) dungeoneer's", [
      { id: 'scholar', label: "Scholar's Pack", items: ['scholars_pack'] },
      { id: 'dungeoneer', label: "Dungeoneer's Pack", items: ['dungeoneers_pack'] },
    ]),
    spiritChoice,
  ]);
  // 2
  add(2, [f('imperial_edicts', 'Imperial Edicts', 2,
    'Learn two Imperial Edicts now, and one more at levels 6, 10, 14 and 17 (six at level 20). Whenever you gain an Emperor Warlock level you may replace one Edict you know with another: remove the old Edict from the Features tab, then choose its replacement.')],
    [edictChoice(`${classId}_edicts_2`, 2, 'Choose 2 Imperial Edicts.')]);
  // 3
  add(3, [
    f('council_of_spirits', 'Council of Spirits', 3, isTrue
      ? 'Once per in-game month, after rolling for Legacy Binding, you may reject the result and roll again; you must keep the second result. (The Legacy Binding panel spends this for you and restores it at the start of each new month.)'
      : 'Once per in-game month the full class lets you reroll the Legacy Binding result. (Not used in this demo version, where your Bound Spirit is fixed.)'),
    f('historical_expertise', 'Historical Expertise', 3, 'Gain expertise in History or one Emperor Warlock class skill in which you are proficient.'),
    ...(isTrue ? [{ kind: 'resource', value: { resourceId: 'council_of_spirits', name: 'Council of Spirits (reroll)', maximum: 1, recharge: 'Once per in-game month (restored when a new month starts)' } as ResourceGrant } as Grant] : []),
  ], [expertiseChoice]);
  // 4
  add(4, [], [asi(`${classId}_asi_4`)]);
  // 5
  add(5, [f('extra_attack_emperor', 'Extra Attack', 5, 'You can attack twice when you take the Attack action.',
    { effects: [stat('extra_attack', 'set', 1)] })]);
  // 6
  add(6, [], [edictChoice(`${classId}_edicts_6`, 1, 'Choose 1 more Imperial Edict.')]);
  // 7
  add(7, [f('commanding_presence', 'Commanding Presence', 7,
    'You and allies within 10 feet have advantage on saving throws against being frightened. (30 feet at level 18; the allies\' share is table-resolved.)',
    { effects: [adv('saving throws against being frightened')] })]);
  // 8
  add(8, [], [asi(`${classId}_asi_8`)]);
  // 9
  add(9, [commandFeature('Improved Command', 9, 'd8 (a d10 from level 17)', 'imperial_command')]);
  // 10
  add(10, [], [edictChoice(`${classId}_edicts_10`, 1, 'Choose 1 more Imperial Edict.')]);
  // 11
  add(11, [
    f('two_voices', 'Two Voices', 11, isTrue
      ? 'When the month changes, roll two d12s and choose which spirit answers. Council of Spirits can reroll one of those dice. (The Legacy Binding panel asks for both results from now on.)'
      : 'The full class lets you roll two d12s for the monthly binding. (Not used in this demo version.)'),
    { kind: 'resource', value: arcanumResource(LEGACY_ARCANUM[0]) },
  ], [arcanumChoice(LEGACY_ARCANUM[0])]);
  // 12
  add(12, [], [asi(`${classId}_asi_12`)]);
  // 13
  add(13, [
    f('tireless_command', 'Tireless Command', 13, 'When you finish a Short Rest with no Command Dice remaining, regain one Command Die.',
      { trigger: 'You finish a Short Rest with no Command Dice left.', activation: activation('free'),
        abilityEffects: [{ type: 'restore_resource', resourceId: 'command_dice', amount: 1 }], tags: ['utility'] }),
    { kind: 'resource', value: arcanumResource(LEGACY_ARCANUM[1]) },
  ], [arcanumChoice(LEGACY_ARCANUM[1])]);
  // 14
  add(14, [], [edictChoice(`${classId}_edicts_14`, 1, 'Choose 1 more Imperial Edict.')]);
  // 15
  add(15, [{ kind: 'resource', value: arcanumResource(LEGACY_ARCANUM[2]) }], [arcanumChoice(LEGACY_ARCANUM[2])]);
  // 16
  add(16, [], [asi(`${classId}_asi_16`)]);
  // 17
  add(17, [
    commandFeature('Greater Command', 17, 'd10', 'imperial_command'),
    { kind: 'resource', value: arcanumResource(LEGACY_ARCANUM[3]) },
  ], [edictChoice(`${classId}_edicts_17`, 1, 'Choose 1 more Imperial Edict.'), arcanumChoice(LEGACY_ARCANUM[3])]);
  // 18
  add(18, [f('commanding_presence', 'Greater Presence', 18,
    'You and allies within 30 feet have advantage on saving throws against being frightened. (The allies\' share is table-resolved.)',
    { effects: [adv('saving throws against being frightened')], upgradeOf: 'commanding_presence' })]);
  // 19
  add(19, [], [asi(`${classId}_asi_19`)]);
  // 20
  add(20, [f('crown_of_legends', 'Crown of Legends', 20, isTrue
    ? 'No more random rolls unless you want them: each month, choose any of the twelve spirits (the Legacy Binding panel now lists them all), and unlock that spirit\'s level-20 feature.'
    : 'The full class lets you choose any spirit each month. (Not used in this demo version, where your Bound Spirit is fixed; you already have its level-20 feature.)')]);

  return { classId, srd: false, entries };
}

/** The Legacy Binding Mode Group (true version only): the d12 table, Two Voices, Council of Spirits and Crown of Legends. */
export function legacyBindingGroup(classId: string): ModeGroup {
  return {
    id: 'legacy_binding', name: 'Legacy Binding', optionLabel: 'Bound Spirit', periodLabel: 'month', classId,
    optionIds: SPIRIT_TABLE_ORDER.map(k => spiritId(classId, k)),
    selector: {
      die: 12,
      table: SPIRIT_TABLE_ORDER.map((k, i) => ({ value: i + 1, optionId: spiritId(classId, k) })),
      diceAtLevel: [{ level: 11, dice: 2 }],
      rerollResourceId: 'council_of_spirits', rerollFromLevel: 3,
      freeChoiceFromLevel: 20,
    },
    restoreOnSwitch: ['council_of_spirits'],
  };
}
