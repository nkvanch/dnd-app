// src/components/sheet/skillLabels.ts
// Shared display-name map for SkillName, used by every preview/row-builder
// that renders a skill proficiency diff (Feat/live-feature-grant/background-
// swap preview) so a skill renders with the same human name everywhere
// instead of each consumer inventing its own map — same "extract on the
// 2nd/3rd+ use" precedent already used for derivedStatLabels.ts.
import { SkillName } from '../../engine/types';

export const SKILL_LABELS: Record<SkillName, string> = {
  athletics: 'Athletics', acrobatics: 'Acrobatics', sleight_of_hand: 'Sleight of Hand',
  stealth: 'Stealth', arcana: 'Arcana', history: 'History', investigation: 'Investigation',
  nature: 'Nature', religion: 'Religion', animal_handling: 'Animal Handling',
  insight: 'Insight', medicine: 'Medicine', perception: 'Perception', survival: 'Survival',
  deception: 'Deception', intimidation: 'Intimidation', performance: 'Performance', persuasion: 'Persuasion',
};
