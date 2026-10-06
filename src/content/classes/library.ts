// ============================================================================
// FILE: src/content/classes/library.ts
// Global content database — imports from all content sub-modules.
// ============================================================================
import { CONDITIONS_2024 } from '../conditions/conditions2024';
import { ContentDB, Race, CharClass, Background, Feat, Condition } from '../../engine/types';
import { getOfficialContentProvider } from '../officialSource';
import { ALL_RACES } from '../races/index';
import { ALL_CHAR_CLASSES } from './index';
import { ALL_BACKGROUNDS } from '../backgrounds/index';
import { ALL_FEATS } from '../feats/index';
import { ALL_CONDITIONS } from '../conditions/index';

export { ALL_RACES, ALL_CHAR_CLASSES, ALL_BACKGROUNDS, ALL_FEATS, ALL_CONDITIONS };

// Official spell and item content are NOT part of globalContentDB — see
// src/content/spellRepo.ts / itemRepo.ts. Both are excluded from the native
// bundle (SQLite-backed there); on web they're still eager static arrays,
// just accessed via spellRepo/itemRepo's getIndex()/getXSync() instead of
// globalContentDB.spells/.items so both platforms share one call surface.
// races, classes, backgrounds and feats follow the official content source (officialSource.ts): the hardcoded
// catalog by default, or installed content packs once a provider is set. Conditions follow it too, with both editions' records.
export const globalContentDB: Omit<ContentDB, 'spells' | 'items'> = {
  get races(): Race[] { const p = getOfficialContentProvider(); return p ? (p.races() as Race[]) : ALL_RACES; },
  get classes(): CharClass[] { const p = getOfficialContentProvider(); return p ? (p.classes() as CharClass[]) : ALL_CHAR_CLASSES; },
  get backgrounds(): Background[] { const p = getOfficialContentProvider(); return p ? (p.backgrounds() as Background[]) : ALL_BACKGROUNDS; },
  // Every edition's condition records (same ids, told apart by rulesetId); getMergedContentDB resolves them per ruleset.
  get conditions(): Condition[] { const p = getOfficialContentProvider(); return p ? (p.conditionRecords() as Condition[]) : [...ALL_CONDITIONS, ...CONDITIONS_2024]; },
  features:    [],
  get feats(): Feat[] { const p = getOfficialContentProvider(); return p ? (p.feats() as Feat[]) : ALL_FEATS; },
};
