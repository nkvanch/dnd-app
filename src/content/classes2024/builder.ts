// ============================================================================
// FILE: src/content/classes2024/builder.ts
// Shared constructors for the 2024 (5.5e) classes of the System Reference Document 5.2.1 (Creative
// Commons Attribution 4.0). Each class file declares its identity, its per-level features and its one
// SRD subclass; this file turns that into a CharClass + ClassProgression + subclass the existing class
// machinery (creation, level-up, multiclass, spell slots) already understands.
//
// Conventions shared by every class:
//   id             `<name>_2024` (the 2014 class keeps its own id); tagged rulesetId 'dnd5e-2024'
//   srd            false  (that flag in this app means SRD 5.1, which the public build is filtered by)
//   feature ids    `<classId>_<key>`
//   Ability Score Improvement at the class's ASI levels is the 2024 "ASI feat or another feat" choice;
//   Epic Boon is the same picker with the Epic Boon prompt.
// ============================================================================
import {
  Ability, CharClass, ChoiceDefinition, ChoiceOption, ClassProgression, Effect, Feature, FeatureActivation,
  Grant, LevelEntry, ResourceGrant, RulesetId, AbilityEffect, ActionCardTag, SpellPickFilter, Prerequisite, ChoiceReplacePolicy,
} from '../../engine/types';
import { feature, activation, stat, adv } from '../homebrewPack/helpers';
import type { MasteryEligibility } from '../weaponMastery';
import { FULL_CASTER_SLOTS, HALF_CASTER_SLOTS } from '../classes/spellSlotTables';

export const RULESET_2024 = 'dnd5e-2024' as RulesetId;
export { activation, stat, adv };

export type SubclassDef = ClassProgression & { name: string; id: string };

type FeatureOpts = {
  effects?: Effect[]; activation?: FeatureActivation; abilityEffects?: AbilityEffect[]; trigger?: string;
  tags?: ActionCardTag[]; upgradeOf?: string; resources?: ResourceGrant[]; grantsChoices?: ChoiceDefinition[];
  /** Only for `option`: requirements for taking it (see Prerequisite). */
  requires?: Prerequisite[];
};

/** Makes the feature/grant helpers for one class (so ids and sources are filled in). */
export function classKit(classId: string, subclassId?: string) {
  // A subclass's features carry the SUBCLASS as their source (that is what the subclass picker, removal and the
  // subclass-change flow key on); a class's own features carry the class.
  const source = subclassId ? { kind: 'subclass' as const, refId: subclassId } : { kind: 'class' as const, refId: classId };
  const f = (key: string, name: string, level: number, description: string, o: FeatureOpts = {}): Feature =>
    ({ ...feature({ id: `${classId}_${key}`, name, description, level, source, ...o, upgradeOf: o.upgradeOf ? `${classId}_${o.upgradeOf}` : undefined }),
      ...(o.grantsChoices ? { grantsChoices: o.grantsChoices } : {}) });
  const g = (key: string, name: string, level: number, description: string, o: FeatureOpts = {}): Grant =>
    ({ kind: 'feature', value: f(key, name, level, description, o) });
  const pool = (resourceId: string, name: string, maximum: number, recharge: ResourceGrant['recharge'] = 'long_rest', perProficiencyBonus = false): Grant =>
    ({ kind: 'resource', value: { resourceId, name, maximum, recharge, ...(perProficiencyBonus ? { perProficiencyBonus: true } : {}) } });
  const raise = (resourceId: string, newMaximum: number): Grant => ({ kind: 'resource_upgrade', value: { resourceId, newMaximum } });

  /** The Weapon Mastery feature: `count` weapon kinds, eligibility per class (see content/weaponMastery.ts). */
  const mastery = (level: number, count: number, rule: MasteryEligibility, description: string, first = false): Grant =>
    g('weapon_mastery', first ? 'Weapon Mastery' : `Weapon Mastery (${count})`, level, description, {
      effects: [stat('weapon_mastery_slots', 'add', count), stat(`weapon_mastery_rule:${rule}`, 'set', 1)],
      upgradeOf: first ? undefined : 'weapon_mastery',
    });

  const extraAttack = (level: number, description = 'You can attack twice instead of once whenever you take the Attack action on your turn.'): Grant =>
    g('extra_attack', 'Extra Attack', level, description, { effects: [stat('extra_attack', 'set', 1)] });

  const asi = (level: number): ChoiceDefinition => ({
    id: `${classId}_asi_${level}`, prompt: 'Ability Score Improvement: take the Ability Score Improvement feat or another feat you qualify for.',
    kind: 'asi', count: 1, pool: 'all', grants: [], required: true, resolved: false,
  });
  const epicBoon = (level: number): ChoiceDefinition => ({
    id: `${classId}_boon_${level}`, prompt: 'Epic Boon: choose an Epic Boon feat or another feat you qualify for.',
    kind: 'asi', count: 1, pool: 'all', grants: [], required: true, resolved: false,
  });
  const subclassChoice = (label: string): ChoiceDefinition => ({
    id: `${classId}_subclass`, prompt: `Choose your ${label}.`, kind: 'subclass', count: 1, pool: 'all',
    grants: [], required: true, resolved: false, forClassId: classId,
  });
  const skills = (count: number, options: string[]): ChoiceDefinition => ({
    id: `${classId}_skills`, prompt: `Choose ${count} skill${count > 1 ? 's' : ''}.`, kind: 'skill', count, grants: [], required: true, resolved: false,
    pool: options.map(o => ({ id: o, label: o.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), value: o })),
  });
  const expertise = (id: string, count: number, prompt: string): ChoiceDefinition =>
    ({ id: `${classId}_${id}`, prompt, kind: 'expertise', count, pool: 'all', grants: [], required: true, resolved: false });
  const spells = (id: string, count: number, prompt: string): ChoiceDefinition =>
    ({ id: `${classId}_${id}`, prompt, kind: 'spell', count, pool: 'all', grants: [], required: true, resolved: false });
  /** A spell choice with its own pool rules: spells from other classes' lists, exact levels, rituals only (see SpellPickFilter). */
  const spellsFrom = (id: string, count: number, prompt: string, filter: SpellPickFilter, required = true): ChoiceDefinition =>
    ({ id: `${classId}_${id}`, prompt, kind: 'spell', count, pool: 'all', grants: [], required, resolved: false, spellFilter: filter });
  const pick = (id: string, prompt: string, count: number, pool: ChoiceOption[], replace?: ChoiceReplacePolicy): ChoiceDefinition =>
    ({ id: `${classId}_${id}`, prompt, kind: 'feature_pool', count, pool, grants: [], required: true, resolved: false, ...(replace ? { replace } : {}) });
  const option = (key: string, name: string, level: number, description: string, o: FeatureOpts = {}): ChoiceOption =>
    ({ id: key, label: name, value: f(key, name, level, description, o), ...(o.requires ? { requires: o.requires } : {}) });
  const equip = (id: string, prompt: string, options: { id: string; label: string; items: string[] }[]): ChoiceDefinition => ({
    id: `${classId}_equip_${id}`, prompt, kind: 'equipment', count: 1, grants: [], required: true, resolved: false,
    pool: options.map(o => ({ id: o.id, label: o.label, value: o.items })),
  });

  return { source, f, g, pool, raise, mastery, extraAttack, asi, epicBoon, subclassChoice, skills, expertise, spells, spellsFrom, pick, option, equip };
}

export type LevelSpec = { grants?: Grant[]; choices?: ChoiceDefinition[] };

export type CasterSpec = {
  ability: Ability;
  style: 'full' | 'half' | 'pact';
  /** Cantrips known by level 1..20. */
  cantrips: number[];
  /** Spells prepared/known by level 1..20 (the SRD's Prepared Spells column). */
  prepared: number[];
  /** Spell slot rows by level; omit for the standard tables the engine already has for the style. */
  slotsTable?: { level: number; slots: number[] }[];
  policy: NonNullable<CharClass['spellPreparationPolicy']>;
  ritual?: CharClass['ritualCastingPolicy'];
  /** First class level with spellcasting (Ranger/Paladin/Warlock all start at 1 in 2024). */
  startLevel?: number;
  /** For classes that prepare from a list without picking a count in the creation flow (Cleric/Druid/Paladin/Wizard). */
  pickPrepared?: boolean;
  /** From this class level on, the prepared-spell picks draw on other lists too (Bard Magical Secrets at 10). */
  preparedFilterFromLevel?: { level: number; filter: SpellPickFilter };
};

export type ClassDef = {
  key: string;
  name: string;
  description: string;
  hitDie: 6 | 8 | 10 | 12;
  savingThrows: [Ability, Ability];
  armorProfs: string[];
  weaponProfs: string[];
  toolProfs?: string[];
  multiclass: NonNullable<CharClass['multiclassProficiencies']>;
  caster?: CasterSpec;
  /** Features and choices by class level. Levels with only an ASI/nothing need no entry. */
  levels: Record<number, LevelSpec>;
  asiLevels: number[];
  subclass: { id: string; name: string; entries: (kit: ReturnType<typeof classKit>) => { level: number; grants: Grant[]; choices?: ChoiceDefinition[] }[] };
  /** Level-1 choices (skills, equipment, ...) and grants (proficiencies) that are not in `levels[1]`. */
  startingProficiency: { armor?: string[]; weapons?: string[]; tools?: string[] };
};

/** Builds the CharClass (with its rawProgression) and the SRD subclass for a 2024 class definition. */
export function buildClass2024(def: ClassDef): { cls: CharClass; subclass: SubclassDef } {
  const classId = `${def.key}_2024`;
  const kit = classKit(classId);
  const caster = def.caster;
  const entries: LevelEntry[] = [];

  for (let level = 1; level <= 20; level++) {
    const spec = def.levels[level] ?? {};
    const grants: Grant[] = [];
    const choices: ChoiceDefinition[] = [];

    if (level === 1) grants.push({ kind: 'proficiency', value: def.startingProficiency });
    if (caster && level === (caster.startLevel ?? 1)) grants.push({ kind: 'init_spellcasting', value: { ability: caster.ability } });
    grants.push(...(spec.grants ?? []));
    choices.push(...(spec.choices ?? []));
    if (def.asiLevels.includes(level)) choices.push(level === 19 ? kit.epicBoon(level) : kit.asi(level));

    if (caster && level >= (caster.startLevel ?? 1)) {
      // The table travels with the grant, so these classes need no entry in the engine's by-class-id tables.
      // (Pact casters are the exception: the engine reads their pact slots from a registered table.)
      const table = caster.slotsTable ?? (caster.style === 'full' ? FULL_CASTER_SLOTS : caster.style === 'half' ? HALF_CASTER_SLOTS : undefined);
      grants.push({ kind: 'spell_slots', value: { level, ...(table ? { slotsTable: table } : {}) } });
      const prevC = level > 1 ? caster.cantrips[level - 2] : 0;
      const prevP = level > 1 ? caster.prepared[level - 2] : 0;
      const dc = caster.cantrips[level - 1] - prevC;
      const dp = caster.prepared[level - 1] - prevP;
      if (dc > 0) choices.push(kit.spells(`cantrips_${level}`, dc, level === 1 ? `Choose ${dc} cantrips.` : `Choose ${dc} more cantrip${dc > 1 ? 's' : ''}.`));
      if (dp > 0 && caster.pickPrepared !== false) {
        const pf = caster.preparedFilterFromLevel;
        const prompt = level === 1 ? `Choose ${dp} level 1 spells to prepare.` : `Choose ${dp} more spell${dp > 1 ? 's' : ''} to prepare.`;
        choices.push(pf && level >= pf.level
          ? kit.spellsFrom(`spells_${level}`, dp, `${prompt} ${pf.filter.label ? `(From ${pf.filter.label}.)` : ''}`, pf.filter)
          : kit.spells(`spells_${level}`, dp, prompt));
      }
    }
    entries.push({ level, hpDie: def.hitDie, grants, choices });
  }

  const subKit = classKit(classId, def.subclass.id);
  const subclass: SubclassDef = { ...subclassOf(def.subclass.id, def.subclass.name, def.subclass.entries(subKit)), classId } as SubclassDef;

  const cls: CharClass = {
    id: classId, name: def.name, hitDie: def.hitDie, features: [], description: def.description, rulesetId: RULESET_2024, srd: false,
    savingThrows: def.savingThrows, armorProfs: def.armorProfs, weaponProfs: def.weaponProfs, toolProfs: def.toolProfs,
    multiclassProficiencies: def.multiclass,
    ...(caster ? {
      spellcastingAbility: caster.ability, spellcastingStyle: caster.style === 'pact' ? 'pact' : caster.style,
      spellPreparationPolicy: caster.policy, ...(caster.ritual ? { ritualCastingPolicy: caster.ritual } : {}),
      ...(caster.startLevel && caster.startLevel > 1 ? { spellcastingStartLevel: caster.startLevel } : {}),
    } : {}),
    rawProgression: { classId, srd: false, rulesetId: RULESET_2024, entries },
  };
  return { cls, subclass };
}

/** A subclass shell: features by level, plus its name. */
export function subclassOf(id: string, name: string, entries: { level: number; grants: Grant[]; choices?: ChoiceDefinition[] }[]): Omit<SubclassDef, 'classId'> {
  return {
    id, name, srd: false, rulesetId: RULESET_2024,
    entries: entries.map(e => ({ level: e.level, hpDie: 0 as unknown as LevelEntry['hpDie'], grants: e.grants, choices: e.choices ?? [] })),
  } as Omit<SubclassDef, 'classId'>;
}

/** Selects an entry of a numeric-by-level table (levels are 1-based). */
export const at = <T,>(table: readonly T[], level: number): T => table[level - 1];
