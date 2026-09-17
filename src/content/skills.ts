// src/content/skills.ts
// CHOICE-EXPANSION-1: a single canonical {id,label,value} skill option list,
// reused by TabFeatures.tsx's inline skill-choice UI, the Expertise picker,
// and app/creation/repeated-choice.tsx — item 24 ("if only skills currently
// have a proper registry, reuse it"). SkillName itself (engine/types.ts) is
// already the real canonical registry (a closed union); this is just its
// {id,label} presentation layer, matching the shape several near-duplicate
// local copies already used before this file existed (races/index.ts,
// TabFeatures.tsx, app/creation/skills.tsx) — those pre-existing copies are
// left as-is (a separate dedup cleanup, not required by this task); this
// file is what NEW code should import.
import { SkillName } from '../engine/types';

export const SKILL_LABELS: Record<SkillName, string> = {
  athletics: 'Athletics',
  acrobatics: 'Acrobatics',
  sleight_of_hand: 'Sleight of Hand',
  stealth: 'Stealth',
  arcana: 'Arcana',
  history: 'History',
  investigation: 'Investigation',
  nature: 'Nature',
  religion: 'Religion',
  animal_handling: 'Animal Handling',
  insight: 'Insight',
  medicine: 'Medicine',
  perception: 'Perception',
  survival: 'Survival',
  deception: 'Deception',
  intimidation: 'Intimidation',
  performance: 'Performance',
  persuasion: 'Persuasion',
};

export const ALL_SKILL_OPTIONS: { id: SkillName; label: string; value: SkillName }[] =
  (Object.keys(SKILL_LABELS) as SkillName[]).map(id => ({ id, label: SKILL_LABELS[id], value: id }));
