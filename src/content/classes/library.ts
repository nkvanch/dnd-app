// ============================================================================
// FILE: src/content/classes/library.ts
// Global content database — imports from all content sub-modules.
// ============================================================================
import { ContentDB } from '../../engine/types';
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
export const globalContentDB: Omit<ContentDB, 'spells' | 'items'> = {
  races:       ALL_RACES,
  classes:     ALL_CHAR_CLASSES,
  backgrounds: ALL_BACKGROUNDS,
  conditions:  ALL_CONDITIONS,
  features:    [],
  feats:       ALL_FEATS,
};
