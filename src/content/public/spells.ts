import snapshot from './publicContent.json';
import type { Spell } from '../../engine/types';
import { ContentRegistry } from '../ContentRegistry';
export const ALL_SPELLS = snapshot.spells as Spell[];
export const FULL_SPELL_LIBRARY = ALL_SPELLS;
export const spellRegistry = new ContentRegistry<Spell>(() => ALL_SPELLS);
