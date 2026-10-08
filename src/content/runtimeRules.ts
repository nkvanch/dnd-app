// ============================================================================
// FILE: src/content/runtimeRules.ts
// The rules tables the app reads while running: Wild Shape beast forms, the Artificer's infusions and the companions it summons.
// They come from the installed content packs (each pack's `rules.<key>.records`, via the official provider); only when no pack is
// the official source does the hardcoded catalog answer, which is the built-in fallback and is empty in the app builds
// (metro.config.js swaps those modules for empty ones).
// ============================================================================
import type { BeastForm, CharClass, Feat, Race } from '../engine/types';
import type { MonsterTemplate } from './monsters/types';
import type { CompanionTemplate } from '../engine/companion';
import { getOfficialContentProvider } from './officialSource';
import { ALL_BEAST_FORMS } from './beastforms';
import { ALL_INFUSIONS, Infusion } from './infusions';
import { COMPANION_TEMPLATES_BY_GRANT_FEATURE } from './companions';
import { ALL_MONSTER_TEMPLATES } from './monsters/srd';
import { ALL_CHAR_CLASSES } from './classes';
import { ALL_RACES } from './races';
import { ORIGIN_FEATS_2024 } from './feats/origin2024';

export function beastForms(): readonly BeastForm[] {
  const p = getOfficialContentProvider();
  return p ? (p.ruleRecords('beastForms') as BeastForm[]) : ALL_BEAST_FORMS;
}
export const findBeastForm = (id: string): BeastForm | undefined => beastForms().find(f => f.id === id);

export function infusions(): readonly Infusion[] {
  const p = getOfficialContentProvider();
  return p ? (p.ruleRecords('infusions') as Infusion[]) : ALL_INFUSIONS;
}
export const getInfusion = (id: string): Infusion | null => infusions().find(i => i.id === id) ?? null;

/** Companion templates by the id of the feature that grants them. */
export function companionTemplates(): Record<string, CompanionTemplate> {
  const p = getOfficialContentProvider();
  if (!p) return COMPANION_TEMPLATES_BY_GRANT_FEATURE;
  return Object.fromEntries((p.ruleRecords('companions') as { id: string; template: CompanionTemplate }[]).map(r => [r.id, r.template]));
}

/** The official monster templates (the installed packs', else the built-in fallback). */
export function officialMonsters(): readonly MonsterTemplate[] {
  const p = getOfficialContentProvider();
  return p ? p.monsters() : ALL_MONSTER_TEMPLATES;
}

/** The Origin feats of the 2024 rules. */
export function originFeats(): readonly Feat[] {
  const p = getOfficialContentProvider();
  return p ? p.feats().filter(f => f.category === 'origin') : ORIGIN_FEATS_2024;
}

/** The official classes and species (the installed packs', else the built-in fallback): the default content the engine reads when a caller passes none. */
export function officialClasses(): readonly CharClass[] {
  const p = getOfficialContentProvider();
  return p ? (p.classes() as CharClass[]) : ALL_CHAR_CLASSES;
}
export function officialRaces(): readonly Race[] {
  const p = getOfficialContentProvider();
  return p ? (p.races() as Race[]) : ALL_RACES;
}
