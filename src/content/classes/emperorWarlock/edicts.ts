// ============================================================================
// FILE: src/content/classes/emperorWarlock/edicts.ts
// The 17 Imperial Edicts (12 base + 5 Eldritch Blast edicts) as a feature_pool: "learn two at level
// 2, one more at 6, 10, 14 and 17". Authored once and shared by both Emperor Warlock versions;
// `classId` only sets each edict's source so it is attributed to the right class.
//
// Automated: skill proficiency/expertise-if-proficient (Scholar of Empires, Voice of Authority,
// Mounted Commander), +CHA to initiative (Battlefield Observer), advantage vs frightened (Iron
// Discipline), PB-per-Long-Rest and once-per-Long-Rest pools (Tactical Withdrawal, Unshaken),
// spending a Command Die (Rally), and Eldritch Blast range 300 ft / +CHA damage (Long-Range
// Artillery, Imperial Blast) through typed spell modifications. Everything positional or
// narrative stays text, per the spec's "Keep Manual" list.
// ============================================================================
import { ChoiceOption, Feature, Effect } from '../../../engine/types';
import { feature, adv, activation } from '../../homebrewPack/helpers';

const EB = 'eldritch_blast';

const skill = (name: string): Effect =>
  ({ type: 'grant_proficiency', target: `skill:${name}`, operation: 'add', value: 'expertise_if_proficient', condition: null });

export function buildEdicts(classId: string): Feature[] {
  const source = { kind: 'class' as const, refId: classId };
  const e = (n: number, id: string, name: string, description: string, extra: Partial<Parameters<typeof feature>[0]> = {}) =>
    feature({ id: `edict_${id}`, name: `Edict ${n}: ${name}`, description, source, ...extra });

  return [
    e(1, 'scholar_of_empires', 'Scholar of Empires', 'Gain History proficiency. If you are already proficient, gain expertise instead.',
      { effects: [skill('history')] }),
    e(2, 'voice_of_authority', 'Voice of Authority', 'Gain Persuasion proficiency. If you are already proficient, gain expertise instead.',
      { effects: [skill('persuasion')] }),
    e(3, 'battlefield_observer', 'Battlefield Observer', 'Add your Charisma modifier to your initiative rolls.',
      { effects: [{ type: 'stat_modifier', target: 'initiative', operation: 'add', value: 0, addAbilityModifier: 'cha', condition: null }] }),
    e(4, 'iron_discipline', 'Iron Discipline', 'You have advantage on saving throws against being frightened.',
      { effects: [adv('saving throws against being frightened')] }),
    e(5, 'mounted_commander', 'Mounted Commander',
      'Gain Animal Handling proficiency, or expertise if you are already proficient. You have advantage on Animal Handling checks made to control, calm, direct, or remain in control of a mount.',
      { effects: [skill('animal_handling'), adv('Animal Handling checks to control, calm, direct, or remain in control of a mount')] }),
    e(6, 'tactical_withdrawal', 'Tactical Withdrawal',
      'As a Bonus Action, take the Disengage action. You can do this a number of times equal to your proficiency bonus per Long Rest.',
      {
        activation: activation('bonus_action', { resource: 'edict_tactical_withdrawal' }),
        resources: [{ resourceId: 'edict_tactical_withdrawal', name: 'Tactical Withdrawal', maximum: 2, recharge: 'long_rest', perProficiencyBonus: true }],
        tags: ['movement', 'utility'],
      }),
    e(7, 'rally', 'Rally',
      'When you would grant a creature a Command Die using Imperial Command, you may instead expend that die to grant it temporary hit points equal to one roll of your Command Die + your Charisma modifier.',
      { activation: activation('bonus_action', { resource: 'command_dice', range: '60 feet', target: 'single' }), tags: ['healing', 'buff'] }),
    e(8, 'unbroken_line', 'Unbroken Line',
      'While you are not incapacitated, every ally within 5 feet of you gains +1 AC. (The aura is for your allies, so it is table-resolved.)'),
    e(9, 'forced_march', 'Forced March',
      'While traveling with you, your group can travel for one additional hour each day before normal forced-march consequences begin.'),
    e(10, 'commander_of_many', 'Commander of Many',
      'The range of Imperial Command increases from 60 feet to 120 feet. (The Imperial Command card keeps showing 60 feet; the app has no way to rewrite another feature\'s range.)'),
    e(11, 'historian', 'Historian',
      'After at least 10 minutes observing and investigating a settlement, ruin, fortress, battlefield, seat of government, or similarly important location, ask the DM for a concise account of its approximate military or political history. The answer reflects what could reasonably be inferred from evidence and common knowledge; it does not reveal unknowable or magically concealed secrets.'),
    e(12, 'unshaken', 'Unshaken',
      'When you fail a Wisdom or Charisma saving throw, reroll it and use the new result. Once per Long Rest. This does not consume your Reaction.',
      {
        trigger: 'You fail a Wisdom or Charisma saving throw.',
        activation: activation('free', { resource: 'edict_unshaken' }),
        resources: [{ resourceId: 'edict_unshaken', name: 'Unshaken', maximum: 1, recharge: 'long_rest' }],
        tags: ['utility'],
      }),
    e(13, 'imperial_blast', 'Imperial Blast',
      'When you hit with Eldritch Blast, add your Charisma modifier to the damage of that beam.',
      { effects: [{ type: 'stat_modifier', target: `spell_damage_bonus:${EB}`, operation: 'add', value: 0, addAbilityModifier: 'cha', condition: null }] }),
    e(14, 'commanding_repulsion', 'Commanding Repulsion',
      'Once on each of your turns when Eldritch Blast hits a creature, you may push that creature up to 10 feet directly away from you.'),
    e(15, 'suppressing_fire', 'Suppressing Fire',
      'When you damage a creature with Eldritch Blast, its speed is reduced by 10 feet until the start of your next turn. Multiple beams against the same target do not stack the reduction.'),
    e(16, 'long_range_artillery', 'Long-Range Artillery', 'Eldritch Blast range becomes 300 feet.',
      { effects: [{ type: 'stat_modifier', target: `spell_range:${EB}`, operation: 'set', value: 300, condition: null }] }),
    e(17, 'mark_of_the_emperor', 'Mark of the Emperor',
      'Once on each of your turns when you hit a creature with Eldritch Blast, mark it until the start of your next turn. The next ally other than you to make an attack roll against the marked creature gains one free Command Die for that attack roll. The die does not expend your pool and is consumed on use.'),
  ];
}

/** The Edict pool as ChoiceOptions, for a `feature_pool` ChoiceDefinition. */
export function edictPool(classId: string): ChoiceOption[] {
  return buildEdicts(classId).map(f => ({ id: f.id, label: f.name.replace(/^Edict \d+: /, ''), value: f }));
}
