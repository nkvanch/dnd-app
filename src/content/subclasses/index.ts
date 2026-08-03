// ============================================================================
// FILE: src/content/subclasses/index.ts
// Registry of all subclass progressions, keyed by classId.
//
// LEGAL FILTERING (see docs/ROADMAP_1.0.md Phase 1 Step 1.4): same
// build-target-aware pattern as spells (src/content/spells/index.ts, Step
// 1.3). Personal/dev/preview builds see every subclass; only the EAS
// `production` build profile (EXPO_PUBLIC_SRD_ONLY=true, set in eas.json)
// filters to srd === true.
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

/** Every subclass, unfiltered. Prefer ALL_SUBCLASSES below in app code. */
export const FULL_SUBCLASS_LIBRARY: SubclassProgression[] = [
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

const SRD_ONLY = process.env.EXPO_PUBLIC_SRD_ONLY === 'true';

/** The subclass list the app should use \u2014 filtered on public builds only. */
export const ALL_SUBCLASSES: SubclassProgression[] = SRD_ONLY
  ? FULL_SUBCLASS_LIBRARY.filter(s => s.srd === true)
  : FULL_SUBCLASS_LIBRARY;

/** Returns all subclasses for a given classId. */
export function getSubclassesForClass(classId: string): SubclassProgression[] {
  return ALL_SUBCLASSES.filter(s => s.classId === classId);
}
