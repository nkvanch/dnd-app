// ============================================================================
// FILE: src/content/classes/library.ts
// Global content database — imports from all content sub-modules.
// ============================================================================
import { ContentDB } from '../../engine/types';
import { ALL_RACES } from '../races/index';
import { ALL_CHAR_CLASSES } from './index';
import { ALL_BACKGROUNDS } from '../backgrounds/index';
import { ALL_SPELLS } from '../spells/index';
import { ALL_ITEMS } from '../items/index';

export { ALL_RACES, ALL_CHAR_CLASSES, ALL_BACKGROUNDS, ALL_SPELLS, ALL_ITEMS };

export const globalContentDB: ContentDB = {
  races:       ALL_RACES,
  classes:     ALL_CHAR_CLASSES,
  backgrounds: ALL_BACKGROUNDS,
  spells:      ALL_SPELLS,
  items:       ALL_ITEMS,
  conditions:  [],
  features:    [],
};
