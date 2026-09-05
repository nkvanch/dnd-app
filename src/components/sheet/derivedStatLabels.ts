// src/components/sheet/derivedStatLabels.ts
// Shared display-name map for DerivedStats' numeric fields, used by every
// preview modal that generically diffs DERIVED_NUMERIC_KEYS (Feat/
// Equipment/LevelUp preview) so a changed stat renders with the same
// human name everywhere instead of each modal inventing its own map.
import { DerivedStats } from '../../engine/types';

export const DERIVED_LABELS: Partial<Record<keyof DerivedStats, string>> = {
  // proficiencyBonus is irrelevant for Feat/Equipment (neither changes
  // character level) but genuinely changes at level-up breakpoints —
  // included here since the map is shared across all three consumers.
  proficiencyBonus: 'Proficiency Bonus',
  ac: 'AC',
  initiative: 'Initiative',
  speed: 'Speed',
  passivePerception: 'Passive Perception',
  passiveInvestigation: 'Passive Investigation',
  passiveInsight: 'Passive Insight',
  spellSaveDC: 'Spell Save DC',
  spellAttackBonus: 'Spell Attack Bonus',
  kiSaveDC: 'Ki Save DC',
};
