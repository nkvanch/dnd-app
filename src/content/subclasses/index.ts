// ============================================================================
// FILE: src/content/subclasses/index.ts
// Registry of all subclass progressions, keyed by classId.
// ============================================================================
import { FIGHTER_SUBCLASSES }   from './fighter';
import { ROGUE_SUBCLASSES }     from './rogue';
import { WIZARD_SUBCLASSES }    from './wizard';
import { CLERIC_SUBCLASSES }    from './cleric';
import { BARBARIAN_SUBCLASSES } from './barbarian';
import { RANGER_SUBCLASSES }    from './ranger';
import { PALADIN_SUBCLASSES }   from './paladin';
import { DRUID_SUBCLASSES }     from './druid';
import { BARD_SUBCLASSES }      from './bard';
import { MONK_SUBCLASSES }      from './monk';
import { SORCERER_SUBCLASSES }  from './sorcerer';
import { WARLOCK_SUBCLASSES }   from './warlock';
import { ClassProgression }     from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

export const ALL_SUBCLASSES: SubclassProgression[] = [
  ...FIGHTER_SUBCLASSES,
  ...ROGUE_SUBCLASSES,
  ...WIZARD_SUBCLASSES,
  ...CLERIC_SUBCLASSES,
  ...BARBARIAN_SUBCLASSES,
  ...RANGER_SUBCLASSES,
  ...PALADIN_SUBCLASSES,
  ...DRUID_SUBCLASSES,
  ...BARD_SUBCLASSES,
  ...MONK_SUBCLASSES,
  ...SORCERER_SUBCLASSES,
  ...WARLOCK_SUBCLASSES,
];

/** Returns all subclasses for a given classId. */
export function getSubclassesForClass(classId: string): SubclassProgression[] {
  return ALL_SUBCLASSES.filter(s => s.classId === classId);
}
