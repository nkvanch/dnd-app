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

const DEFS: ClassDef[] = [barbarian2024, bard2024, cleric2024];
const built = DEFS.map(buildClass2024);

export const CLASSES_2024: CharClass[] = built.map(b => b.cls);
export const SUBCLASSES_2024: (SubclassDef & ClassProgression)[] = built.map(b => b.subclass);
export const PROGRESSIONS_2024: ClassProgression[] = CLASSES_2024.map(c => c.rawProgression!);
