// ============================================================================
// FILE: src/content/feats/origin2024.ts
// The Origin feats of the 2024 rules (5.5e), from the System Reference Document 5.2.1
// (Creative Commons Attribution 4.0; "This work includes material from the System Reference Document
// 5.2.1 by Wizards of the Coast LLC"). Tagged rulesetId 'dnd5e-2024'. `srd` stays false because that
// flag in this app means "part of SRD 5.1", which the public SRD-only build is filtered by.
//
// Each is a real feat the 2024 backgrounds grant (see Background.originFeat and engine/originFeat.ts):
//   Alert           initiative + proficiency bonus (an effect that tracks PB as it grows).
//   Savage Attacker a trigger-text feature.
//   Skilled         three skill picks (the SRD also allows tools; only skills are offered, see below).
//   Magic Initiate  one feat per list (Cleric, Druid, Wizard): two cantrips and one 1st-level spell,
//                   picked from that list, the spell castable once per Long Rest without a slot.
//
// Stated gaps: the SRD lets you pick Intelligence, Wisdom OR Charisma as Magic Initiate's spellcasting
// ability; the app fixes it to the list's natural ability (Wisdom for Cleric/Druid, Intelligence for
// Wizard) because the ability must be known before the spells are granted. Skilled offers skills only.
// The "replace a spell whenever you gain a level" option is text.
// ============================================================================
import { Ability, ChoiceDefinition, Feat, Feature, RulesetId } from '../../engine/types';
import { feature, activation } from '../homebrewPack/helpers';
import { FULL_SPELL_LIBRARY } from '../spells/index';
import { SPELL_LIST_2024 } from '../classes2024/spellLists2024';

const SOURCE = 'System Reference Document 5.2.1 (2024 rules)';
const RULESET = 'dnd5e-2024' as RulesetId;
const bgSource = (id: string) => ({ kind: 'background' as const, refId: id });

function originFeat(id: string, name: string, description: string, f: Partial<Parameters<typeof feature>[0]>, extra: Partial<Feat> = {}): Feat {
  const featureId = `feat_${id}`;
  return {
    id, name, category: 'origin', prerequisite: null, description: `Origin Feat. ${description}`, source: SOURCE,
    rulesetId: RULESET, srd: false,
    feature: feature({ id: featureId, name, description, source: { kind: 'feat', refId: id }, ...f }),
    ...extra,
  };
}

const alert = originFeat('alert_2024', 'Alert',
  'Initiative Proficiency: when you roll Initiative, you can add your Proficiency Bonus to the roll. Initiative Swap: immediately after you roll Initiative, you can swap your Initiative with the Initiative of one willing ally in the same combat. You can\'t make this swap if you or the ally has the Incapacitated condition.',
  { effects: [{ type: 'stat_modifier', target: 'initiative', operation: 'add', value: 0, addProficiencyBonus: true, condition: null }] });

const savageAttacker = originFeat('savage_attacker_2024', 'Savage Attacker',
  'You\'ve trained to deal particularly damaging strikes. Once per turn when you hit a target with a weapon, you can roll the weapon\'s damage dice twice and use either roll against the target.',
  { trigger: 'You hit a target with a weapon (once per turn).' });

const skilled = originFeat('skilled_2024', 'Skilled',
  'You gain proficiency in any combination of three skills or tools of your choice. Repeatable: you can take this feat more than once. (The app offers skills; add a tool proficiency yourself if you prefer tools.)',
  {},
  {
    pendingChoices: [{
      id: 'skills', prompt: 'Skilled: choose three skills.', kind: 'skill', count: 3, pool: 'all',
      grants: [], required: true, resolved: false,
    }],
  });

// ── Magic Initiate (one feat per spell list) ─────────────────────────────────

const LISTS: { key: 'cleric' | 'druid' | 'wizard'; label: string; ability: Ability }[] = [
  { key: 'cleric', label: 'Cleric', ability: 'wis' },
  { key: 'druid',  label: 'Druid',  ability: 'wis' },
  { key: 'wizard', label: 'Wizard', ability: 'int' },
];

const slugName = (id: string) => id.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');

function magicInitiate(list: typeof LISTS[number]): Feat {
  const id = `magic_initiate_${list.key}_2024`;
  const poolId = `magic_initiate_${list.key}_2024_cast`;
  // The 2024 (SRD 5.2.1) spell list of that class, not the 2014 one, and the whole library rather than the build's filtered view,
  // so the feat reads the same in every build and in the pack generated from it.
  const onList = (level: number) => {
    const ids = new Set(SPELL_LIST_2024[list.key][level] ?? []);
    return FULL_SPELL_LIBRARY.filter(s => ids.has(s.id));
  };

  const cantripChoice: ChoiceDefinition = {
    id: 'cantrips', prompt: `Magic Initiate (${list.label}): choose two ${list.label} cantrips.`,
    kind: 'feature_pool', count: 2, grants: [], required: true, resolved: false,
    pool: onList(0).map(s => ({
      id: `mi_${list.key}_cantrip_${s.id}`, label: s.name,
      value: feature({
        id: `${id}_cantrip_${s.id}`, name: `${s.name} (Magic Initiate)`, source: bgSource(id),
        description: `You know the ${s.name} cantrip from Magic Initiate (${list.label}). ${list.ability === 'wis' ? 'Wisdom' : 'Intelligence'} is your spellcasting ability for it.`,
        effects: [{ type: 'grant_spell', target: '', operation: 'add', value: null, condition: null, cantripIds: [s.id], spellcastingAbility: list.ability }],
      }),
    })),
  };
  const spellChoice: ChoiceDefinition = {
    id: 'spell', prompt: `Magic Initiate (${list.label}): choose one 1st-level ${list.label} spell.`,
    kind: 'feature_pool', count: 1, grants: [], required: true, resolved: false,
    pool: onList(1).map(s => ({
      id: `mi_${list.key}_spell_${s.id}`, label: s.name,
      value: feature({
        id: `${id}_spell_${s.id}`, name: `${s.name} (Magic Initiate)`, source: bgSource(id),
        description: `You always have ${s.name} prepared. You can cast it once without a spell slot and regain that use when you finish a Long Rest; you can also cast it with a spell slot.`,
        effects: [{ type: 'grant_spell', target: '', operation: 'add', value: null, condition: null, spellIds: [s.id], spellcastingAbility: list.ability }],
        activation: activation('action', { resource: poolId, range: 'varies', target: 'single' }),
        abilityEffects: [{ type: 'cast_spell', spellId: s.id }],
      }),
    })),
  };

  return originFeat(id, `Magic Initiate (${list.label})`,
    `Two Cantrips: you learn two cantrips of your choice from the ${list.label} spell list. Level 1 Spell: choose a level 1 spell from the same list; you always have it prepared, can cast it once without a spell slot (regaining that on a Long Rest), and can also cast it with any spell slots you have. ${list.ability === 'wis' ? 'Wisdom' : 'Intelligence'} is your spellcasting ability for this feat's spells. Spell Change: whenever you gain a level you can replace one of these spells with a different spell of the same level from the ${list.label} list. Repeatable: you can take this feat more than once, but you must choose a different spell list each time.`,
    {},
    {
      pendingChoices: [cantripChoice, spellChoice],
      resources: [{ resourceId: poolId, name: `Magic Initiate (${list.label}) free cast`, maximum: 1, recharge: 'long_rest' }],
    });
}

export const ORIGIN_FEATS_2024: Feat[] = [alert, savageAttacker, skilled, ...LISTS.map(magicInitiate)];

export const ORIGIN_FEAT_IDS_2024 = new Set(ORIGIN_FEATS_2024.map(f => f.id));
export type { Feature };
