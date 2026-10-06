import type { Spell } from '../../engine/types';
import { ContentRegistry } from '../ContentRegistry';
export const ALL_SPELLS: Spell[] = [];
export const FULL_SPELL_LIBRARY: Spell[] = [];
export const spellRegistry = new ContentRegistry<Spell>(() => ALL_SPELLS);
