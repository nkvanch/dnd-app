// ============================================================================
// FILE: src/content/classes2024/index.ts
// The twelve classes of the System Reference Document 5.2.1 (2024 rules / 5.5e), each with its one SRD
// subclass, registered as ordinary official content tagged rulesetId 'dnd5e-2024'. They sit beside the
// 2014 classes (which keep their ids); see builder.ts for the shared conventions.
// ============================================================================
import { CharClass, ClassProgression } from '../../engine/types';
import { buildClass2024, ClassDef, SubclassDef } from './builder';
import { barbarian2024 } from './barbarian';
import { bard2024 } from './bard';
import { cleric2024 } from './cleric';
import { druid2024 } from './druid';
import { fighter2024 } from './fighter';
import { monk2024 } from './monk';
import { paladin2024 } from './paladin';
import { ranger2024 } from './ranger';
import { rogue2024 } from './rogue';
import { sorcerer2024 } from './sorcerer';
import { warlock2024 } from './warlock';
import { wizard2024 } from './wizard';

const DEFS: ClassDef[] = [barbarian2024, bard2024, cleric2024, druid2024, fighter2024, monk2024, paladin2024, ranger2024, rogue2024, sorcerer2024, warlock2024, wizard2024];
const built = DEFS.map(buildClass2024);

export const CLASSES_2024: CharClass[] = built.map(b => b.cls);
export const SUBCLASSES_2024: (SubclassDef & ClassProgression)[] = built.map(b => b.subclass);
export const PROGRESSIONS_2024: ClassProgression[] = CLASSES_2024.map(c => c.rawProgression!);
